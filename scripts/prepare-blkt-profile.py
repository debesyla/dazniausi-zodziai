#!/usr/bin/env python3
"""Build and verify the privacy-safe BLKT wordform profile source artifact.

Raw BLKT Parquet rows never leave the private source workspace. The only
publishable row artifact is a thresholded, aggregate-only TSV. The program
uses per-document token histograms so document support is exact without
reading or retaining source IDs.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import platform
from pathlib import Path
import re
import stat
import sys
import time
import unicodedata


SCHEMA_VERSION = 1
PARTIAL_FORMAT_VERSION = 2
EXPECTED_SOURCE_ID = "vssa-2026-04-21-general-lithuanian-corpus"
EXPECTED_REVISION = "4fa6c3894fd9f1f9f8db773ae844e126fa61f61d"
EXPECTED_MANIFEST_BYTES = 9_040
EXPECTED_MANIFEST_SHA256 = "573d57238f8ca82b43c5b5095d4fab286c03d1294d43c0279b2722e3f172650a"
EXPECTED_FILE_COUNT = 25
EXPECTED_SOURCE_BYTES = 12_570_497_752
EXPECTED_DOCUMENTS = 8_438_155
EXPECTED_SOURCE_ALPHA_WORDS = 3_941_476_219
EXPECTED_LICENCE_TOTALS = {
    "NewGenLTU OpenRAIL-D": {"documents": 8_267_437, "sourceAlphaWords": 3_906_734_476},
    "CC BY-SA 4.0": {"documents": 170_718, "sourceAlphaWords": 34_741_743},
}
EXPECTED_DUCKDB_VERSION = "1.5.5"
EXPECTED_PYTHON_IMPLEMENTATION = "CPython"
EXPECTED_PYTHON_MAJOR_MINOR = (3, 14)
EXPECTED_UNICODE_VERSION = "16.0.0"
MINIMUM_TOKEN_COUNT = 100
MINIMUM_DOCUMENT_SUPPORT = 20
MAXIMUM_TOKEN_LENGTH = 64
OUTPUT_FILENAME = "wordform-profile.tsv"
SUMMARY_FILENAME = "aggregation-summary.json"

TYPE_DEFINITIONS = (
    ("gro", "fiction", "Grožinė literatūra"),
    ("neg", "non-fiction", "Negrožinė literatūra"),
    ("zin", "media", "Žiniasklaida"),
    ("sak", "speech", "Sakytinė kalba"),
    ("dok", "documents", "Dokumentai"),
)
PERIOD_DEFINITIONS = (
    ("1", "1922-1940", "1922–1940"),
    ("2", "1941-1990", "1941–1990"),
    ("3", "1990-2004", "1990–2004"),
    ("4", "2008-2026", "2008–2026"),
)
SUBTYPE_PARENTS = {
    "port": "zin",
    "prdk": "zin",
    "sste": "sak",
    "intt": "neg",
    "moks": "neg",
    "kiti": "neg",
    "proz": "gro",
    "poez": "gro",
    "dkes": "dok",
    "dklt": "dok",
    "dkad": "dok",
}
SOURCE_COLUMNS = (
    "id",
    "text",
    "url",
    "title",
    "author",
    "source_id",
    "source_name",
    "publication_date",
    "record_created",
    "license",
    "document_type",
    "document_subtype",
    "period",
    "alpha_word_count",
    "language",
    "text_char_count",
    "source_file",
)
TOKENIZER = {
    "id": "blkt-unicode-letter-lower-v1",
    "engine": f"DuckDB {EXPECTED_DUCKDB_VERSION}",
    "normalization": "NFC before segmentation, DuckDB simple Unicode lowercase per code point, then NFC for each token",
    "boundary": "A token is a maximal contiguous sequence matched by RE2 Unicode \\p{L}+.",
    "hyphenPolicy": "Hyphens and apostrophes are separators.",
    "digitPolicy": "Digits are separators.",
    "length": {"minimumCodePoints": 1, "maximumCodePoints": MAXIMUM_TOKEN_LENGTH},
}
PERMISSION = {
    "status": "confirmed-by-project-owner",
    "confirmedOn": "2026-08-02",
    "scope": "Publication of BLKT-derived aggregate results and derived datasets for this Lithuanian word project.",
    "privateCorrespondencePublished": False,
}
SOURCE_LICENCES = {
    "inventory": [
        {
            "sourceLabel": "NewGenLTU OpenRAIL-D",
            "name": "NewGenLTU OpenRAIL-D v1.0",
            "url": "https://sitti.vdu.lt/newgenltu-openrail-d-license/",
            **EXPECTED_LICENCE_TOTALS["NewGenLTU OpenRAIL-D"],
        },
        {
            "sourceLabel": "CC BY-SA 4.0",
            "name": "Creative Commons Attribution-ShareAlike 4.0 International",
            "url": "https://creativecommons.org/licenses/by-sa/4.0/",
            "attribution": "Wikipedia contributors (BLKT source_name: Vikipedija).",
            **EXPECTED_LICENCE_TOTALS["CC BY-SA 4.0"],
        },
    ],
    "application": "The combined aggregate retains the notices and conditions of both source licence groups.",
}
FAMILY_RULE = (
    "Publish every type or period cell for a word only when every positive sibling meets both thresholds; "
    "otherwise publish no cells for that family."
)
PRIVACY = {
    "rawTextPublished": False,
    "documentRowsPublished": False,
    "documentSubtypesPublished": False,
    "jointDimensionsPublished": False,
    "titlesPublished": False,
    "authorsPublished": False,
    "urlsPublished": False,
    "sourceIdentifiersPublished": False,
    "publicationDatesPublished": False,
    "personalDataPublished": False,
}
SUBTYPE_VALIDATION = {
    "count": len(SUBTYPE_PARENTS),
    "parentMappingsValidated": True,
    "documentTotalsReconciled": True,
    "sourceAlphaWordTotalsReconciled": True,
}
BUILD_ENVIRONMENT = {
    "duckdbVersion": EXPECTED_DUCKDB_VERSION,
    "partialFormatVersion": PARTIAL_FORMAT_VERSION,
    "pythonImplementation": EXPECTED_PYTHON_IMPLEMENTATION,
    "pythonMajorMinor": ".".join(str(value) for value in EXPECTED_PYTHON_MAJOR_MINOR),
    "pythonUnicodeVersion": EXPECTED_UNICODE_VERSION,
}


def fail(message: str) -> None:
    raise RuntimeError(f"BLKT profile preparation failed: {message}")


def type_field(code: str, metric: str) -> str:
    return f"type{code.title()}{metric}"


def period_field(code: str, metric: str) -> str:
    return f"period{code}{metric}"


OUTPUT_HEADER = (
    "word",
    "corpusTokenCount",
    "corpusDocumentCount",
    *(type_field(code, metric) for code, _, _ in TYPE_DEFINITIONS for metric in ("TokenCount", "DocumentCount")),
    *(period_field(code, metric) for code, _, _ in PERIOD_DEFINITIONS for metric in ("TokenCount", "DocumentCount")),
)


def read_json(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        fail(f"cannot read {path.name}: {error}")
    if not isinstance(value, dict):
        fail(f"{path.name} must contain an object")
    return value


def atomic_write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    try:
        temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def sha256_file(path: Path) -> tuple[int, str]:
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
            size += len(chunk)
    return size, digest.hexdigest()


def require_owned_directory(path: Path, description: str, *, create: bool) -> None:
    if create:
        path.mkdir(parents=True, exist_ok=True, mode=0o700)
    try:
        metadata = path.lstat()
    except OSError as error:
        fail(f"cannot inspect {description}: {error}")
    if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISDIR(metadata.st_mode):
        fail(f"{description} must be a real directory, not a link")
    if metadata.st_uid != os.getuid():
        fail(f"{description} must be owned by the current user")


def secure_owned_directory(path: Path, description: str, *, create: bool) -> None:
    require_owned_directory(path, description, create=create)
    path.chmod(0o700)


def require_owned_regular_file(path: Path, description: str) -> None:
    try:
        metadata = path.lstat()
    except OSError as error:
        fail(f"cannot inspect {description}: {error}")
    if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISREG(metadata.st_mode):
        fail(f"{description} must be a real regular file, not a link")
    if metadata.st_uid != os.getuid():
        fail(f"{description} must be owned by the current user")


def secure_owned_regular_file(path: Path, description: str) -> None:
    require_owned_regular_file(path, description)
    path.chmod(0o600)


def secure_private_work_tree(path: Path) -> None:
    secure_owned_directory(path, "private work directory", create=True)
    for candidate in path.rglob("*"):
        metadata = candidate.lstat()
        if stat.S_ISLNK(metadata.st_mode) or metadata.st_uid != os.getuid():
            fail("private work directory contains a link or an entry owned by another user")
        if stat.S_ISDIR(metadata.st_mode):
            candidate.chmod(0o700)
        elif stat.S_ISREG(metadata.st_mode):
            candidate.chmod(0o600)
        else:
            fail("private work directory contains an unsupported special file")


def resolve_without_links(path: Path, description: str, *, must_exist: bool) -> Path:
    candidate = Path(os.path.abspath(path))
    try:
        resolved = candidate.resolve(strict=must_exist)
    except OSError as error:
        fail(f"cannot resolve {description}: {error}")
    if resolved != candidate:
        fail(f"{description} must not contain symbolic-link path components")
    if must_exist:
        metadata = candidate.lstat()
        if stat.S_ISLNK(metadata.st_mode):
            fail(f"{description} must not be a symbolic link")
    return resolved


def paths_overlap(left: Path, right: Path) -> bool:
    return left == right or left in right.parents or right in left.parents


def validate_private_path_separation(source_directory: Path, output_directory: Path, work_directory: Path) -> None:
    pairs = (
        (source_directory, output_directory, "raw source and aggregate output"),
        (source_directory, work_directory, "raw source and private work"),
        (output_directory, work_directory, "aggregate output and private work"),
    )
    for left, right, description in pairs:
        if paths_overlap(left, right):
            fail(f"{description} directories must be separate and non-nested")


def require_exact_output_files(output_directory: Path) -> None:
    require_owned_directory(output_directory, "aggregate output directory", create=False)
    expected = {OUTPUT_FILENAME, SUMMARY_FILENAME}
    entries = list(output_directory.iterdir())
    if {entry.name for entry in entries} != expected or len(entries) != len(expected):
        fail("aggregate output directory must contain exactly the reviewed TSV and summary")
    for entry in entries:
        metadata = entry.lstat()
        if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISREG(metadata.st_mode):
            fail("aggregate output files must be regular files, not links")
        if metadata.st_uid != os.getuid():
            fail("aggregate output files must be owned by the current user")


def directory_bytes(directory: Path) -> int:
    return sum(candidate.lstat().st_size for candidate in directory.rglob("*") if candidate.is_file())


def sql_literal(path: Path) -> str:
    return "'" + str(path).replace("'", "''") + "'"


def require_duckdb():
    try:
        import duckdb  # type: ignore
    except ImportError:
        fail(
            "DuckDB is required; install the pinned dependency from "
            "scripts/requirements-blkt-profile.txt in an isolated environment"
        )
    if duckdb.__version__ != EXPECTED_DUCKDB_VERSION:
        fail(f"DuckDB {EXPECTED_DUCKDB_VERSION} is required, received {duckdb.__version__}")
    return duckdb


def validate_python_runtime() -> None:
    if platform.python_implementation() != EXPECTED_PYTHON_IMPLEMENTATION:
        fail(f"{EXPECTED_PYTHON_IMPLEMENTATION} is required")
    if sys.version_info[:2] != EXPECTED_PYTHON_MAJOR_MINOR:
        fail(f"Python {BUILD_ENVIRONMENT['pythonMajorMinor']} is required")
    if unicodedata.unidata_version != EXPECTED_UNICODE_VERSION:
        fail(f"Python Unicode data {EXPECTED_UNICODE_VERSION} is required")


def validate_manifest(manifest: dict) -> list[dict]:
    if manifest.get("schemaVersion") != SCHEMA_VERSION or manifest.get("id") != EXPECTED_SOURCE_ID:
        fail("source manifest identity is not the reviewed BLKT snapshot")
    if manifest.get("upstream", {}).get("revision") != EXPECTED_REVISION:
        fail("source manifest revision is not the reviewed immutable revision")
    data = manifest.get("data")
    if not isinstance(data, dict):
        fail("source manifest has no data declaration")
    expected_data = {
        "files": EXPECTED_FILE_COUNT,
        "bytes": EXPECTED_SOURCE_BYTES,
        "documents": EXPECTED_DOCUMENTS,
        "sourceAlphaWords": EXPECTED_SOURCE_ALPHA_WORDS,
    }
    for key, expected in expected_data.items():
        if data.get(key) != expected:
            fail(f"source manifest {key} must be {expected}")
    if tuple(data.get("columns", ())) != SOURCE_COLUMNS:
        fail("source manifest columns do not match the reviewed schema")

    files = manifest.get("files")
    if not isinstance(files, list) or len(files) != EXPECTED_FILE_COUNT:
        fail(f"source manifest must contain exactly {EXPECTED_FILE_COUNT} files")
    seen_paths: set[str] = set()
    total_bytes = 0
    for index, descriptor in enumerate(files):
        if not isinstance(descriptor, dict):
            fail(f"source file {index} descriptor is invalid")
        expected_name = f"BLKT_corpus-{index:05d}.parquet"
        source_path = descriptor.get("sourcePath")
        local_path = descriptor.get("localPath")
        if source_path != f"data/{expected_name}" or local_path != f"original/{expected_name}":
            fail(f"source file {index} path is not the reviewed path")
        if local_path in seen_paths:
            fail(f"source file {index} duplicates a local path")
        seen_paths.add(local_path)
        byte_count = descriptor.get("bytes")
        checksum = descriptor.get("sha256")
        if not isinstance(byte_count, int) or byte_count < 1:
            fail(f"source file {index} byte count is invalid")
        if not isinstance(checksum, str) or not re.fullmatch(r"[a-f0-9]{64}", checksum):
            fail(f"source file {index} SHA-256 is invalid")
        total_bytes += byte_count
    if total_bytes != EXPECTED_SOURCE_BYTES:
        fail("source file byte counts do not reconcile with the reviewed total")
    return files


def verify_raw_files(files: list[dict], source_directory: Path) -> list[tuple[dict, Path]]:
    secure_owned_directory(source_directory, "raw source directory", create=False)
    verified: list[tuple[dict, Path]] = []
    for descriptor in files:
        name = Path(descriptor["localPath"]).name
        path = source_directory / name
        if not path.is_file() or path.is_symlink():
            fail(f"reviewed raw file is missing or not a regular file: {name}")
        secure_owned_regular_file(path, f"raw source file {name}")
        byte_count, checksum = sha256_file(path)
        if byte_count != descriptor["bytes"] or checksum != descriptor["sha256"]:
            fail(f"reviewed raw file does not match its pinned identity: {name}")
        verified.append((descriptor, path.resolve()))
    return verified


def configure_connection(duckdb, database: Path | None, temporary_directory: Path, threads: int, memory: str):
    temporary_directory.mkdir(parents=True, exist_ok=True)
    connection = duckdb.connect(str(database) if database is not None else ":memory:")
    escaped_memory = memory.replace("'", "''")
    connection.execute("PRAGMA disable_progress_bar")
    connection.execute(f"SET threads={threads}")
    connection.execute(f"SET memory_limit='{escaped_memory}'")
    connection.execute(f"SET temp_directory={sql_literal(temporary_directory)}")
    connection.execute("SET preserve_insertion_order=false")
    return connection


def inspect_structure(connection, source_path: Path) -> list[tuple]:
    query = f"""
        SELECT
            document_type,
            document_subtype,
            period,
            license,
            count(*)::UBIGINT AS documents,
            sum(alpha_word_count)::UBIGINT AS source_alpha_words,
            count_if(text IS NULL)::UBIGINT AS null_texts,
            count_if(text = '')::UBIGINT AS empty_texts,
            count_if(
                license = 'CC BY-SA 4.0'
                AND source_name IS DISTINCT FROM 'Vikipedija'
            )::UBIGINT AS invalid_cc_attributions
        FROM read_parquet({sql_literal(source_path)})
        GROUP BY ALL
        ORDER BY document_type, document_subtype, period
    """
    return connection.execute(query).fetchall()


def add_inventory_rows(inventory: dict, rows: list[tuple]) -> None:
    for document_type, subtype, period, licence, documents, alpha_words, null_texts, empty_texts, invalid_cc_attributions in rows:
        if document_type not in {code for code, _, _ in TYPE_DEFINITIONS}:
            fail(f"source contains an unreviewed document type: {document_type!r}")
        if subtype not in SUBTYPE_PARENTS or SUBTYPE_PARENTS[subtype] != document_type:
            fail("source contains an unreviewed document subtype or parent mapping")
        if period not in {code for code, _, _ in PERIOD_DEFINITIONS}:
            fail(f"source contains an unreviewed period: {period!r}")
        if licence not in EXPECTED_LICENCE_TOTALS:
            fail(f"source contains an unreviewed licence: {licence!r}")
        if invalid_cc_attributions:
            fail("CC BY-SA 4.0 rows are not exclusively attributed to Vikipedija")
        if null_texts or empty_texts:
            fail("source contains a null or empty text row")
        inventory["documents"] += int(documents)
        inventory["sourceAlphaWords"] += int(alpha_words)
        licence_cell = inventory["licences"].setdefault(licence, {"documents": 0, "sourceAlphaWords": 0})
        licence_cell["documents"] += int(documents)
        licence_cell["sourceAlphaWords"] += int(alpha_words)
        for dimension, key in (
            ("documentTypes", document_type),
            ("documentSubtypes", subtype),
            ("periods", period),
        ):
            cell = inventory[dimension].setdefault(key, {"documents": 0, "sourceAlphaWords": 0})
            cell["documents"] += int(documents)
            cell["sourceAlphaWords"] += int(alpha_words)


def partial_descriptor(path: Path, connection) -> dict:
    byte_count, checksum = sha256_file(path)
    rows, words, accepted_tokens, overlength_tokens = connection.execute(
        """
        SELECT
            count(*)::UBIGINT,
            count(DISTINCT word)::UBIGINT,
            coalesce(sum(token_count) FILTER (WHERE word IS NOT NULL), 0)::UBIGINT,
            coalesce(sum(token_count) FILTER (WHERE word IS NULL), 0)::UBIGINT
        FROM read_parquet(?)
        """,
        [str(path)],
    ).fetchone()
    return {
        "bytes": byte_count,
        "sha256": checksum,
        "rows": int(rows),
        "wordTypes": int(words),
        "acceptedTokens": int(accepted_tokens),
        "overlengthTokens": int(overlength_tokens),
    }


def build_partial(connection, source_path: Path, destination: Path) -> dict:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(f".{destination.name}.{os.getpid()}.tmp")
    temporary.unlink(missing_ok=True)
    query = f"""
        COPY (
            WITH documents AS (
                SELECT
                    document_type,
                    period,
                    map_entries(
                        list_histogram(
                            list_transform(
                                regexp_extract_all(nfc_normalize(text), '\\p{{L}}+'),
                                token -> nfc_normalize(lower(nfc_normalize(token)))
                            )
                        )
                    ) AS entries
                FROM read_parquet({sql_literal(source_path)})
            ),
            document_words AS (
                SELECT
                    document_type,
                    period,
                    CASE
                        WHEN length(entry.key) <= {MAXIMUM_TOKEN_LENGTH} THEN entry.key
                        ELSE NULL
                    END AS word,
                    entry.value::UBIGINT AS document_tokens
                FROM documents, UNNEST(entries) AS item(entry)
            )
            SELECT
                word,
                document_type,
                period,
                sum(document_tokens)::UBIGINT AS token_count,
                count(*)::UBIGINT AS document_count
            FROM document_words
            GROUP BY ALL
            ORDER BY word NULLS LAST, document_type, period
        ) TO {sql_literal(temporary)} (FORMAT PARQUET, COMPRESSION ZSTD)
    """
    try:
        connection.execute(query)
        descriptor = partial_descriptor(temporary, connection)
        temporary.replace(destination)
        return descriptor
    finally:
        temporary.unlink(missing_ok=True)


def partial_is_reusable(state: dict, name: str, raw_sha256: str, path: Path, connection) -> bool:
    expected = state.get("partials", {}).get(name)
    if not isinstance(expected, dict) or expected.get("rawSha256") != raw_sha256 or not path.is_file():
        return False
    actual = partial_descriptor(path, connection)
    return actual == expected.get("output")


def create_partial_state() -> dict:
    return {
        "schemaVersion": SCHEMA_VERSION,
        "partialFormatVersion": PARTIAL_FORMAT_VERSION,
        "sourceRevision": EXPECTED_REVISION,
        "duckdbVersion": EXPECTED_DUCKDB_VERSION,
        "tokenizer": TOKENIZER,
        "partials": {},
    }


def load_partial_state(path: Path) -> dict:
    if not path.is_file():
        return create_partial_state()
    state = read_json(path)
    expected = create_partial_state()
    for key in ("schemaVersion", "partialFormatVersion", "sourceRevision", "duckdbVersion", "tokenizer"):
        if state.get(key) != expected[key]:
            return expected
    if not isinstance(state.get("partials"), dict):
        return expected
    return state


def create_inventory() -> dict:
    return {
        "documents": 0,
        "sourceAlphaWords": 0,
        "licences": {},
        "documentTypes": {},
        "documentSubtypes": {},
        "periods": {},
    }


def denominator_rows(connection) -> tuple[int, int, dict[str, int], dict[str, int]]:
    accepted, overlength = connection.execute(
        """
        SELECT
            coalesce(sum(token_count) FILTER (WHERE word IS NOT NULL), 0)::UBIGINT,
            coalesce(sum(token_count) FILTER (WHERE word IS NULL), 0)::UBIGINT
        FROM partials
        """
    ).fetchone()
    by_type = {
        str(code): int(tokens)
        for code, tokens in connection.execute(
            """
            SELECT document_type, sum(token_count)::UBIGINT
            FROM partials WHERE word IS NOT NULL GROUP BY document_type ORDER BY document_type
            """
        ).fetchall()
    }
    by_period = {
        str(code): int(tokens)
        for code, tokens in connection.execute(
            """
            SELECT period, sum(token_count)::UBIGINT
            FROM partials WHERE word IS NOT NULL GROUP BY period ORDER BY period
            """
        ).fetchall()
    }
    return int(accepted), int(overlength), by_type, by_period


def write_profile_tsv(connection, destination: Path) -> dict:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(f".{destination.name}.{os.getpid()}.tmp")
    temporary.unlink(missing_ok=True)

    connection.execute(
        """
        CREATE OR REPLACE TEMP TABLE global_words AS
        SELECT
            word,
            sum(token_count)::UBIGINT AS token_count,
            sum(document_count)::UBIGINT AS document_count
        FROM partials
        WHERE word IS NOT NULL
        GROUP BY word
        """
    )
    type_expressions = []
    for code, _, _ in TYPE_DEFINITIONS:
        type_expressions.extend(
            (
                f"max(token_count) FILTER (WHERE document_type = '{code}') AS {code}_tokens",
                f"max(document_count) FILTER (WHERE document_type = '{code}') AS {code}_documents",
            )
        )
    connection.execute(
        f"""
        CREATE OR REPLACE TEMP TABLE type_words AS
        WITH cells AS (
            SELECT
                word,
                document_type,
                sum(token_count)::UBIGINT AS token_count,
                sum(document_count)::UBIGINT AS document_count
            FROM partials
            WHERE word IS NOT NULL
            GROUP BY word, document_type
        )
        SELECT
            word,
            bool_and(token_count >= {MINIMUM_TOKEN_COUNT} AND document_count >= {MINIMUM_DOCUMENT_SUPPORT}) AS safe,
            {', '.join(type_expressions)}
        FROM cells
        GROUP BY word
        """
    )
    period_expressions = []
    for code, _, _ in PERIOD_DEFINITIONS:
        period_expressions.extend(
            (
                f"max(token_count) FILTER (WHERE period = '{code}') AS p{code}_tokens",
                f"max(document_count) FILTER (WHERE period = '{code}') AS p{code}_documents",
            )
        )
    connection.execute(
        f"""
        CREATE OR REPLACE TEMP TABLE period_words AS
        WITH cells AS (
            SELECT
                word,
                period,
                sum(token_count)::UBIGINT AS token_count,
                sum(document_count)::UBIGINT AS document_count
            FROM partials
            WHERE word IS NOT NULL
            GROUP BY word, period
        )
        SELECT
            word,
            bool_and(token_count >= {MINIMUM_TOKEN_COUNT} AND document_count >= {MINIMUM_DOCUMENT_SUPPORT}) AS safe,
            {', '.join(period_expressions)}
        FROM cells
        GROUP BY word
        """
    )

    selected_fields = [
        "g.word AS word",
        "g.token_count AS corpusTokenCount",
        "g.document_count AS corpusDocumentCount",
    ]
    for code, _, _ in TYPE_DEFINITIONS:
        selected_fields.extend(
            (
                f"CASE WHEN t.safe THEN coalesce(t.{code}_tokens, 0) END AS {type_field(code, 'TokenCount')}",
                f"CASE WHEN t.safe THEN coalesce(t.{code}_documents, 0) END AS {type_field(code, 'DocumentCount')}",
            )
        )
    for code, _, _ in PERIOD_DEFINITIONS:
        selected_fields.extend(
            (
                f"CASE WHEN p.safe THEN coalesce(p.p{code}_tokens, 0) END AS {period_field(code, 'TokenCount')}",
                f"CASE WHEN p.safe THEN coalesce(p.p{code}_documents, 0) END AS {period_field(code, 'DocumentCount')}",
            )
        )
    query = f"""
        COPY (
            SELECT {', '.join(selected_fields)}
            FROM global_words AS g
            LEFT JOIN type_words AS t USING (word)
            LEFT JOIN period_words AS p USING (word)
            WHERE g.token_count >= {MINIMUM_TOKEN_COUNT}
              AND g.document_count >= {MINIMUM_DOCUMENT_SUPPORT}
            ORDER BY g.word
        ) TO {sql_literal(temporary)} (
            FORMAT CSV,
            HEADER,
            DELIMITER '\t',
            NULL ''
        )
    """
    try:
        connection.execute(query)
        descriptor = inspect_profile_tsv(temporary)
        temporary.replace(destination)
        return descriptor
    finally:
        temporary.unlink(missing_ok=True)


def parse_optional_integer(value: str, description: str) -> int | None:
    if value == "":
        return None
    if not re.fullmatch(r"0|[1-9][0-9]*", value):
        fail(f"{description} must be a non-negative integer")
    parsed = int(value)
    if parsed > 9_007_199_254_740_991:
        fail(f"{description} exceeds the JSON safe-integer range")
    return parsed


def inspect_family(values: list[int | None], total_tokens: int, total_documents: int, description: str) -> bool:
    if all(value is None for value in values):
        return False
    if any(value is None for value in values):
        fail(f"{description} must be entirely published or entirely suppressed")
    concrete = [int(value) for value in values if value is not None]
    token_values = concrete[0::2]
    document_values = concrete[1::2]
    for token_count, document_count in zip(token_values, document_values, strict=True):
        if (token_count == 0) != (document_count == 0):
            fail(f"{description} zero token/document values must occur together")
        if token_count > 0 and (token_count < MINIMUM_TOKEN_COUNT or document_count < MINIMUM_DOCUMENT_SUPPORT):
            fail(f"{description} contains a cell below the disclosure threshold")
        if document_count > token_count:
            fail(f"{description} document support cannot exceed token count")
    if sum(token_values) != total_tokens or sum(document_values) != total_documents:
        fail(f"{description} does not reconcile with the corpus word total")
    return True


def inspect_profile_tsv(path: Path) -> dict:
    byte_count, checksum = sha256_file(path)
    rows = 0
    previous_word: str | None = None
    numeric_totals = {field: 0 for field in OUTPUT_HEADER[1:]}
    missing_counts = {field: 0 for field in OUTPUT_HEADER[1:]}
    published_type_families = 0
    published_period_families = 0
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle, delimiter="\t")
        try:
            header = tuple(next(reader))
        except StopIteration:
            fail("wordform profile TSV is empty")
        if header != OUTPUT_HEADER:
            fail("wordform profile TSV header is invalid")
        for row_number, row in enumerate(reader, start=2):
            if len(row) != len(OUTPUT_HEADER):
                fail(f"wordform profile TSV row {row_number} has the wrong width")
            word = row[0]
            if (
                not word
                or len(word) > MAXIMUM_TOKEN_LENGTH
                or unicodedata.normalize("NFC", word) != word
                or word.lower() != word
                or not all(character.isalpha() for character in word)
            ):
                fail(f"wordform profile TSV row {row_number} has an invalid word")
            if previous_word is not None and word <= previous_word:
                fail("wordform profile TSV words must be unique and strictly ascending")
            previous_word = word

            values = [
                parse_optional_integer(value, f"wordform profile TSV row {row_number} field {OUTPUT_HEADER[index]}")
                for index, value in enumerate(row[1:], start=1)
            ]
            total_tokens, total_documents = values[:2]
            if total_tokens is None or total_tokens < MINIMUM_TOKEN_COUNT:
                fail(f"wordform profile TSV row {row_number} is below the corpus token threshold")
            if total_documents is None or total_documents < MINIMUM_DOCUMENT_SUPPORT:
                fail(f"wordform profile TSV row {row_number} is below the corpus document threshold")
            if total_documents > total_tokens:
                fail(f"wordform profile TSV row {row_number} document support exceeds token count")
            type_values = values[2 : 2 + len(TYPE_DEFINITIONS) * 2]
            period_values = values[2 + len(TYPE_DEFINITIONS) * 2 :]
            published_type_families += int(inspect_family(type_values, total_tokens, total_documents, f"row {row_number} type family"))
            published_period_families += int(inspect_family(period_values, total_tokens, total_documents, f"row {row_number} period family"))
            for field, value in zip(OUTPUT_HEADER[1:], values, strict=True):
                if value is None:
                    missing_counts[field] += 1
                else:
                    numeric_totals[field] += value
            rows += 1
    if rows == 0:
        fail("wordform profile TSV has no released rows")
    return {
        "file": OUTPUT_FILENAME,
        "rows": rows,
        "columns": len(OUTPUT_HEADER),
        "bytes": byte_count,
        "sha256": checksum,
        "numericTotals": numeric_totals,
        "missingCounts": missing_counts,
        "publishedTypeFamilies": published_type_families,
        "publishedPeriodFamilies": published_period_families,
    }


def dimension_summary(inventory: dict, derived_by_type: dict[str, int], derived_by_period: dict[str, int], accepted: int) -> dict:
    types = []
    for code, public_id, label in TYPE_DEFINITIONS:
        source = inventory["documentTypes"].get(code)
        if not source:
            fail(f"source inventory is missing document type {code}")
        types.append({"sourceCode": code, "id": public_id, "label": label, **source, "derivedTokens": derived_by_type.get(code, 0)})
    periods = []
    for code, public_id, label in PERIOD_DEFINITIONS:
        source = inventory["periods"].get(code)
        if not source:
            fail(f"source inventory is missing period {code}")
        periods.append({"sourceCode": code, "id": public_id, "label": label, **source, "derivedTokens": derived_by_period.get(code, 0)})
    subtypes = []
    for code in sorted(SUBTYPE_PARENTS):
        source = inventory["documentSubtypes"].get(code)
        if not source:
            fail(f"source inventory is missing document subtype {code}")
        subtypes.append({"sourceCode": code, "parentType": SUBTYPE_PARENTS[code], **source})
    if sum(item["documents"] for item in types) != inventory["documents"]:
        fail("document-type denominators do not reconcile")
    if sum(item["documents"] for item in periods) != inventory["documents"]:
        fail("period denominators do not reconcile")
    if sum(item["documents"] for item in subtypes) != inventory["documents"]:
        fail("subtype validation totals do not reconcile")
    if sum(item["sourceAlphaWords"] for item in types) != inventory["sourceAlphaWords"]:
        fail("document-type source-alpha-word denominators do not reconcile")
    if sum(item["sourceAlphaWords"] for item in periods) != inventory["sourceAlphaWords"]:
        fail("period source-alpha-word denominators do not reconcile")
    if sum(item["sourceAlphaWords"] for item in subtypes) != inventory["sourceAlphaWords"]:
        fail("subtype source-alpha-word validation totals do not reconcile")
    if sum(item["derivedTokens"] for item in types) != accepted:
        fail("document-type derived-token denominators do not reconcile")
    if sum(item["derivedTokens"] for item in periods) != accepted:
        fail("period derived-token denominators do not reconcile")
    return {
        "corpus": {
            "documents": inventory["documents"],
            "sourceAlphaWords": inventory["sourceAlphaWords"],
            "derivedTokens": accepted,
        },
        "documentTypes": types,
        "periods": periods,
        "validatedDocumentSubtypesNotPublished": {
            "count": len(subtypes),
            "parentMappingsValidated": True,
            "documentTotalsReconciled": True,
            "sourceAlphaWordTotalsReconciled": True,
        },
    }


def build(args: argparse.Namespace) -> tuple[dict, dict]:
    os.umask(0o077)
    started = time.monotonic()
    validate_python_runtime()
    manifest_path = resolve_without_links(args.manifest, "source manifest", must_exist=True)
    source_directory = resolve_without_links(args.source_dir, "raw source directory", must_exist=True)
    output_directory = resolve_without_links(args.output_dir, "aggregate output directory", must_exist=False)
    work_directory = resolve_without_links(args.work_dir, "private work directory", must_exist=False)
    require_owned_regular_file(manifest_path, "source manifest")
    validate_private_path_separation(source_directory, output_directory, work_directory)
    secure_private_work_tree(work_directory)
    secure_owned_directory(source_directory, "raw source directory", create=False)
    secure_owned_directory(output_directory, "aggregate output directory", create=True)
    manifest_bytes, manifest_sha256 = sha256_file(manifest_path)
    if manifest_bytes != EXPECTED_MANIFEST_BYTES or manifest_sha256 != EXPECTED_MANIFEST_SHA256:
        fail("source manifest does not match the reviewed immutable manifest")
    manifest = read_json(manifest_path)
    files = validate_manifest(manifest)
    verified = verify_raw_files(files, source_directory)
    duckdb = require_duckdb()
    connection = configure_connection(
        duckdb,
        work_directory / "partials.duckdb",
        work_directory / "spill",
        args.threads,
        args.memory,
    )
    state_path = work_directory / "partial-state.json"
    state = load_partial_state(state_path)
    inventory = create_inventory()
    partial_paths: list[Path] = []
    partial_seconds = 0.0
    rebuilt_partials = 0
    for index, (descriptor, source_path) in enumerate(verified):
        add_inventory_rows(inventory, inspect_structure(connection, source_path))
        partial_path = work_directory / "partials" / f"{index:05d}.parquet"
        name = source_path.name
        if not partial_is_reusable(state, name, descriptor["sha256"], partial_path, connection):
            before = time.monotonic()
            output = build_partial(connection, source_path, partial_path)
            partial_seconds += time.monotonic() - before
            rebuilt_partials += 1
            state["partials"][name] = {"rawSha256": descriptor["sha256"], "output": output}
            atomic_write_json(state_path, state)
        partial_paths.append(partial_path)
    if inventory["documents"] != EXPECTED_DOCUMENTS or inventory["sourceAlphaWords"] != EXPECTED_SOURCE_ALPHA_WORDS:
        fail("source structural totals do not match the reviewed manifest")
    if inventory["licences"] != EXPECTED_LICENCE_TOTALS:
        fail("source licence totals do not match the reviewed mixed-licence inventory")

    connection.close()
    merge_database = work_directory / "merge.duckdb"
    merge_database.unlink(missing_ok=True)
    merge = configure_connection(duckdb, merge_database, work_directory / "merge-spill", args.threads, args.memory)
    partial_list = ", ".join(sql_literal(path) for path in partial_paths)
    merge.execute(f"CREATE TEMP VIEW partials AS SELECT * FROM read_parquet([{partial_list}])")
    accepted, overlength, derived_by_type, derived_by_period = denominator_rows(merge)
    output = write_profile_tsv(merge, output_directory / OUTPUT_FILENAME)
    dimensions = dimension_summary(inventory, derived_by_type, derived_by_period, accepted)
    merge.close()

    summary = {
        "schemaVersion": SCHEMA_VERSION,
        "id": "vssa-blkt-privacy-safe-wordform-profile",
        "source": {
            "manifestId": EXPECTED_SOURCE_ID,
            "manifestBytes": EXPECTED_MANIFEST_BYTES,
            "manifestSha256": EXPECTED_MANIFEST_SHA256,
            "revision": EXPECTED_REVISION,
            "files": EXPECTED_FILE_COUNT,
            "bytes": EXPECTED_SOURCE_BYTES,
            "documents": EXPECTED_DOCUMENTS,
            "sourceAlphaWords": EXPECTED_SOURCE_ALPHA_WORDS,
        },
        "permission": PERMISSION,
        "sourceLicences": SOURCE_LICENCES,
        "tokenizer": TOKENIZER,
        "disclosure": {
            "minimumTokenCount": MINIMUM_TOKEN_COUNT,
            "minimumDocumentSupport": MINIMUM_DOCUMENT_SUPPORT,
            "familyRule": FAMILY_RULE,
            "overlengthTokenOccurrencesExcluded": overlength,
        },
        "dimensions": dimensions,
        "output": output,
        "privacy": PRIVACY,
        "build": BUILD_ENVIRONMENT,
    }
    atomic_write_json(output_directory / SUMMARY_FILENAME, summary)
    verify_outputs(output_directory)
    run = {
        "threads": args.threads,
        "memoryLimit": args.memory,
        "rebuiltPartials": rebuilt_partials,
        "reusedPartials": EXPECTED_FILE_COUNT - rebuilt_partials,
        "partialBuildSeconds": round(partial_seconds, 3),
        "totalSeconds": round(time.monotonic() - started, 3),
        "privateWorkBytes": directory_bytes(work_directory),
    }
    return summary, run


def is_safe_integer(value: object, *, positive: bool) -> bool:
    minimum = 1 if positive else 0
    return type(value) is int and minimum <= value <= 9_007_199_254_740_991


def require_exact_keys(value: object, expected: set[str], description: str) -> dict:
    if not isinstance(value, dict) or set(value) != expected:
        fail(f"{description} has an invalid or open-ended schema")
    return value


def same_typed_json(left: object, right: object) -> bool:
    if type(left) is not type(right):
        return False
    if isinstance(left, dict):
        return set(left) == set(right) and all(same_typed_json(left[key], right[key]) for key in left)
    if isinstance(left, list):
        return len(left) == len(right) and all(same_typed_json(a, b) for a, b in zip(left, right, strict=True))
    return left == right


def validate_dimension_metadata(dimensions: object) -> None:
    value = require_exact_keys(
        dimensions,
        {"corpus", "documentTypes", "periods", "validatedDocumentSubtypesNotPublished"},
        "aggregation summary dimensions",
    )
    corpus = require_exact_keys(
        value["corpus"], {"documents", "sourceAlphaWords", "derivedTokens"}, "aggregation summary corpus dimension"
    )
    if corpus["documents"] != EXPECTED_DOCUMENTS or corpus["sourceAlphaWords"] != EXPECTED_SOURCE_ALPHA_WORDS:
        fail("aggregation summary corpus source denominators are invalid")
    if not is_safe_integer(corpus["derivedTokens"], positive=True):
        fail("aggregation summary corpus derived-token denominator is invalid")

    def validate_records(records: object, definitions: tuple, description: str) -> list[dict]:
        if not isinstance(records, list) or len(records) != len(definitions):
            fail(f"aggregation summary {description} dimensions are invalid")
        validated = []
        for index, (record, (source_code, public_id, label)) in enumerate(zip(records, definitions, strict=True)):
            cell = require_exact_keys(
                record,
                {"sourceCode", "id", "label", "documents", "sourceAlphaWords", "derivedTokens"},
                f"aggregation summary {description}[{index}]",
            )
            if cell["sourceCode"] != source_code or cell["id"] != public_id or cell["label"] != label:
                fail(f"aggregation summary {description}[{index}] identity is invalid")
            for field in ("documents", "sourceAlphaWords", "derivedTokens"):
                if not is_safe_integer(cell[field], positive=True):
                    fail(f"aggregation summary {description}[{index}].{field} is invalid")
            validated.append(cell)
        return validated

    document_types = validate_records(value["documentTypes"], TYPE_DEFINITIONS, "documentTypes")
    periods = validate_records(value["periods"], PERIOD_DEFINITIONS, "periods")
    for records, description in ((document_types, "documentTypes"), (periods, "periods")):
        for field in ("documents", "sourceAlphaWords", "derivedTokens"):
            if sum(record[field] for record in records) != corpus[field]:
                fail(f"aggregation summary {description} {field} values do not reconcile")
    if not same_typed_json(value["validatedDocumentSubtypesNotPublished"], SUBTYPE_VALIDATION):
        fail("aggregation summary subtype privacy boundary is invalid")


def verify_outputs(output_directory: Path) -> dict:
    validate_python_runtime()
    require_exact_output_files(output_directory)
    summary = read_json(output_directory / SUMMARY_FILENAME)
    require_exact_keys(
        summary,
        {"schemaVersion", "id", "source", "permission", "sourceLicences", "tokenizer", "disclosure", "dimensions", "output", "privacy", "build"},
        "aggregation summary",
    )
    if type(summary["schemaVersion"]) is not int or summary["schemaVersion"] != SCHEMA_VERSION \
        or summary["id"] != "vssa-blkt-privacy-safe-wordform-profile":
        fail("aggregation summary identity is invalid")
    if not same_typed_json(summary["source"], {
        "manifestId": EXPECTED_SOURCE_ID,
        "manifestBytes": EXPECTED_MANIFEST_BYTES,
        "manifestSha256": EXPECTED_MANIFEST_SHA256,
        "revision": EXPECTED_REVISION,
        "files": EXPECTED_FILE_COUNT,
        "bytes": EXPECTED_SOURCE_BYTES,
        "documents": EXPECTED_DOCUMENTS,
        "sourceAlphaWords": EXPECTED_SOURCE_ALPHA_WORDS,
    }):
        fail("aggregation summary source identity is invalid")
    if not same_typed_json(summary["permission"], PERMISSION):
        fail("aggregation summary permission record is invalid")
    if not same_typed_json(summary["sourceLicences"], SOURCE_LICENCES):
        fail("aggregation summary mixed-licence inventory is invalid")
    if not same_typed_json(summary["tokenizer"], TOKENIZER):
        fail("aggregation summary tokenizer is invalid")
    disclosure = require_exact_keys(
        summary["disclosure"],
        {"minimumTokenCount", "minimumDocumentSupport", "familyRule", "overlengthTokenOccurrencesExcluded"},
        "aggregation summary disclosure policy",
    )
    if type(disclosure["minimumTokenCount"]) is not int or disclosure["minimumTokenCount"] != MINIMUM_TOKEN_COUNT \
        or type(disclosure["minimumDocumentSupport"]) is not int \
        or disclosure["minimumDocumentSupport"] != MINIMUM_DOCUMENT_SUPPORT \
        or disclosure["familyRule"] != FAMILY_RULE \
        or not is_safe_integer(disclosure["overlengthTokenOccurrencesExcluded"], positive=False):
        fail("aggregation summary disclosure policy is invalid")
    if not same_typed_json(summary["privacy"], PRIVACY):
        fail("aggregation summary does not preserve the aggregate-only privacy boundary")
    if not same_typed_json(summary["build"], BUILD_ENVIRONMENT):
        fail("aggregation summary build environment is invalid")
    validate_dimension_metadata(summary["dimensions"])
    actual = inspect_profile_tsv(output_directory / OUTPUT_FILENAME)
    if not same_typed_json(actual, summary["output"]):
        fail("wordform profile TSV does not match its aggregation summary")
    return summary


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--build", action="store_true", help="verify all raw shards and build aggregate-only outputs")
    action.add_argument("--verify", action="store_true", help="verify existing aggregate-only outputs")
    parser.add_argument("--manifest", type=Path, help="path to the pinned BLKT source-manifest.json")
    parser.add_argument("--source-dir", type=Path, help="directory containing the 25 raw Parquet files")
    parser.add_argument("--output-dir", type=Path, required=True, help="directory for the safe TSV and summary")
    parser.add_argument("--work-dir", type=Path, help="private resumable DuckDB workspace")
    parser.add_argument("--threads", type=int, default=6)
    parser.add_argument("--memory", default="6GB")
    args = parser.parse_args(argv)
    if args.build and (args.manifest is None or args.source_dir is None or args.work_dir is None):
        parser.error("--build requires --manifest, --source-dir, and --work-dir")
    if args.threads < 1 or args.threads > 32:
        parser.error("--threads must be between 1 and 32")
    if not re.fullmatch(r"[1-9][0-9]*(?:MB|GB)", args.memory):
        parser.error("--memory must look like 4096MB or 6GB")
    return args


def main() -> None:
    args = parse_args(sys.argv[1:])
    if args.build:
        summary, run = build(args)
        print(
            json.dumps(
                {
                    "built": summary["id"],
                    "rows": summary["output"]["rows"],
                    "derivedTokens": summary["dimensions"]["corpus"]["derivedTokens"],
                    "run": run,
                },
                ensure_ascii=False,
            )
        )
    else:
        output_directory = resolve_without_links(args.output_dir, "aggregate output directory", must_exist=True)
        summary = verify_outputs(output_directory)
        print(json.dumps({"verified": summary["id"], "rows": summary["output"]["rows"]}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
