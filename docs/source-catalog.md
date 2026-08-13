# Curated source catalog decisions

This inventory covers every collection admitted to the public-product contract
or its explicit metadata-only exception. A source is published only when its
meaning, rights, input shape, and web delivery are clear enough to explain to a
visitor. Known sources that have not passed those gates are recorded separately
under [research candidates](#research-candidates-outside-the-publication-plan);
their presence in the maintained source workflow does not authorize import or
publication. The public artifact format is documented in
[data-products.md](data-products.md); source contracts and byte-level
verification are in [source-contracts.md](source-contracts.md).

| Source collection | Decision | Evidence and implementation | Rationale / remaining question |
| --- | --- | --- | --- |
| Utka 2018 lemmatised word list | **Published** | Config: `utka-2018-lemmatized-totals`; 41,977 source and public rows; CC BY 4.0 record at [CLARIN-LT](https://clarin-repo.lt/items/2bf241af-42ab-4a68-8dd6-c119c2dd0e1e). | A normal lemma-plus-POS frequency list. Its config records a source snapshot and representative samples. Retained duplicate keys are intentional under `keep`. |
| Dadurkevičius DML6 vs JCL | **Published as chunked comparison JSON and compact coverage profile** | Product: `dadurkevicius-dml6-vs-jcl-comparison`; CC BY 4.0 [CLARIN-LT record](https://clarin-repo.lt/items/b03a5f31-cd2b-4035-9c1b-d568e2524e37). | Three separate views preserve the JCL token count, DML6 coverage code, lemma/POS occurrences, and missing types. The `dml6-jcl-coverage-by-frequency-band` profile adds a small six-band summary and at most 50 ordered examples per band/category. The coverage codes (0–3) are labelled categories, never frequency or POS. |
| Dadurkevičius JCL word list | **Published** | Config: `dadurkevicius-2020-jcl-lemmas`; 169,787 UTF-8 TSV lemma-plus-POS rows; total frequency 1,266,854,554; CC BY 4.0 [CLARIN-LT record](https://clarin-repo.lt/items/e61bfe1a-03a9-486a-bd5b-7d31d7102723). | A clean, launch-sized generic lemma frequency list. The importer validates all 16 documented POS codes, source checksum, totals, and manual samples. |
| Petkevičius CCLL lemmatised frequency list | **Published** | Config: `petkevicius-2025-ccll-lemmas`; 142,228 UTF-8 lemma rows; total frequency 156,125,239; CC BY 4.0 [CLARIN-LT record](https://clarin-repo.lt/items/5671f65b-bdc2-41d5-ad04-cc57004f3c3b). | The selected source view is small enough for the browser catalog and is distinct from the source package's 15.2 million-row raw-token list, which remains outside this product scope. |
| Bielinskienė et al. Delfi.lt 1-gram list | **Published as chunked frequency JSON** | Product: `bielinskiene-2019-delfi-1grams`; 1,030,562 UTF-8 CSV rows and raw total 72,883,351; CC BY 4.0 [CLARIN-LT record](https://clarin-repo.lt/items/37a8bc68-1355-40cd-ba17-33958fbee697). | The source includes punctuation and non-alphabetic forms and uses integer-valued scientific notation for some counts. It is preserved as a raw one-gram product, not a lemmatised list, and is chunked rather than browser-loaded. |
| MATAS v3.0 | **Published as derived chunked frequency JSON** | Product: `rimkute-2024-matas-v3-frequencies`; original CC BY 4.0 CoNLL-U archive at [CLARIN-LT](https://clarin-repo.lt/items/298f8a26-20d6-44cf-ab33-e53538ec7df9). | Reproducible views aggregate non-punctuation integer-ID token rows by lemma/POS (56,420 rows) and wordform/POS (198,062 rows). Raw MATAS rows are not falsely presented as a pre-existing frequency list. |
| Žemrietė Lithuanian homoforms | **Published as chunked lexical JSON** | Product: `zemriete-2025-lithuanian-homoforms`; 177,226 UTF-8 TSV rows; CC BY 4.0 [CLARIN-LT record](https://clarin-repo.lt/items/c5e06f7b-364d-46e8-b4e8-6e5d48a0d2c3). | Each row retains the source homoform, lemma, morphology, MATAS frequency, component frequency, and type/subtype. The two counts stay distinct; source order is not presented as a rank. |
| Raškinis foreign-name transliteration pairs | **Published as chunked lexical JSON** | Product: `raskinis-2025-foreign-name-transliterations`; 68,167 UTF-8 source lines and 133,254 source matches; CC BY 4.0 [CLARIN-LT record](https://clarin-repo.lt/items/bf567c29-aa7a-4f0f-ad21-f13ba10e7f7d). | The product keeps the literal first and parenthesized source strings. The record warns of noisy or non-standard transliterations and inconsistent direction, so it is a candidate lexical resource rather than an authoritative spelling list. |
| Birvinskaitė Lithuanian basketball slang | **Published as chunked lexical JSON** | Product: `birvinskaite-2026-lithuanian-basketball-slang`; 223 parsed top-level NVH entries; CC BY 4.0 [CLARIN-LT record](https://clarin-repo.lt/items/6c15e277-4bc5-4a3f-a0c1-16d00aa8a4f6). | This crowdsourced 2020–2025 lexicon preserves source, definition, example, user-group, variant, and compiler fields where present. It is not corpus frequency data. The record page says 233 entries, while the retained NVH file has 223; the product exposes that discrepancy. |
| Lithuanian Treebank ALKSNIS v3.0 | **Published as prefix-chunked syntactic-context JSON** | Product: `rimkute-2019-alksnis-syntactic-context`; original CC BY 4.0 archive at [CLARIN-LT](https://clarin-repo.lt/items/a9db057d-de4e-45ee-9645-45f408592d76). | Relation and genre totals, all 8,656 non-punctuation source lemmas, and up to 12 source-order sentence contexts per lemma are published with relation, direction, document, genre, and sentence ID. The record's 3,643-sentence claim differs from the 3,642 delivered IDs and is preserved explicitly. It is not a general frequency or synonym dataset. |
| Rimkutė morphemic dictionary | **Published as chunked lexical JSON under rightsholder permission** | Product: `rimkute-morphemic-dictionary`; canonical [landing record](https://hdl.handle.net/20.500.12259/249); three PDF checksums plus a reviewed deterministic TSV and extraction summary. On 2026-08-13 the project owner confirmed full rightsholder permission for extraction/correction, publication and redistribution of the complete derivative and statistics, and downstream reuse with normal attribution. | The three PDFs yield 72,325 source-order rows and a source-frequency total of 310,012. That is 61 rows more than the later live Morfema database's reported 72,264 entries; the live count is context, not an extraction target. Rows retain wordform, literal analyses, volume, and printed page; duplicates are preserved. Public metadata includes attribution and a modification notice and does not expose private correspondence. This PDF derivative is not presented as a live-database export. |
| Utka CCLL word lists | **Published as chunked wordform JSON and a bounded genre-profile lookup** | Product: `utka-ccll-wordforms`; CC BY 4.0 [CLARIN-LT record](https://clarin-repo.lt/items/a67d3e7a-c2f0-4d0b-9f69-72fdaf2e6c0b/full). | The full aggregate has 1,733,157 rows. Seven manifest-led views provide frequency and alphabetical aggregate orders plus five subcorpora. `/zanru-profilis` joins only the five named lists for an exact wordform, retains nullable raw counts and separate token denominators, and derives per-million rates without a universal genre leaderboard. CCLL routing nodes and buckets are bounded to 64 KiB; do not sum the aggregate with its five subcorpora. |
| Utka CCLL2 vs war in Ukraine | **Published as chunked comparison JSON** | Product: `utka-ccll2-war-ukraine-comparison`; CC BY 4.0 [CLARIN-LT record](https://clarin-repo.lt/items/60607329-be91-4e04-8a74-62e12ae0078d). | Its six metrics compare normalized counts and document counts across CCLL2, wartime media, and social networks. They remain separate, are nullable, and expose their source denominators; none is a generic total frequency. |
| Lithuanian Parliament Corpus | **Published as corpus-wide aggregate frequency JSON** | Product: `kapociute-dzikiene-2017-parliament-frequency-aggregates`; CC BY 4.0 [CLARIN-LT record](https://clarin-repo.lt/items/18f3514c-1e02-4c60-bb7c-75926a289dd7). | Separate wordform and lemma totals provide a clearly labelled legislative-speech perspective. The public product contains no raw text, excerpts, document records, dates, source identifiers, speakers, authors, or rankings. Calendar and person-level analysis remain outside scope pending the disclosure review in [issue #68](https://github.com/debesyla/dazniausi-zodziai/issues/68). |
| Bendrasis lietuvių kalbos tekstynas (BLKT) | **Published as a privacy-safe exact-word profile** | Product: `vssa-2026-blkt-wordform-profile`; [CLARIN-LT record](https://clarin-repo.lt/items/2b51a918-55c3-4e62-8e45-e763fc7fc157). The audit found 8,267,437 NewGenLTU OpenRAIL-D rows and 170,718 `Vikipedija` rows under CC BY-SA 4.0. Both complete licence texts and the VSSA/Wikipedia attributions accompany the product. On 2026-08-02 the project owner confirmed project-specific permission to publish BLKT-derived aggregates and datasets for this Lithuanian-word project. | `/blkt-profilis` returns one normalized exact wordform at a time. It can show the whole corpus, five broad document types, and four periods, but never subtypes or crossed type-by-period cells. Every published positive cell has at least 100 tokens in at least 20 documents; a type or period family is withheld in full when any positive sibling misses either threshold. No raw text, document rows, titles, authors, URLs, source identifiers, publication dates, or personal data are published. Media and document texts dominate BLKT, so it is not representative of all Lithuanian language use. |

## Published-source provenance

The approved configurations each record a safe source artifact ID, raw-byte count and SHA-256, UTF-8 assumption, source URL, licence, citation, POS mapping where applicable, expected totals, duplicate policy, and manual samples. Run `npm run data:verify -- --source-root /path/to/reviewed-source-root` before committing generated data to confirm byte-for-byte reproducibility.

## Research candidates outside the publication plan

The machine-readable
[`data/research/source-candidates.json`](../data/research/source-candidates.json)
ledger records sources that have been researched but are not approved contracts
or public products. It contains only official public records, issue links,
decisions, and blockers—never raw data, credentials, transient transfer URLs,
or internal source locations.

| Candidate | Decision | Remaining gates | Tracking |
| --- | --- | --- | --- |
| Parallel and monolingual corpora – 1 vol. (Lithuanian monolingual portion) | **Do not import or publish yet** | The official record applies CC0, simplifying copyright reuse, but it does not provide the actual corpus as a versioned archive or immutable file/checksum manifest. Establish durable, credential-safe acquisition, then complete schema, rights, privacy, and disclosure review. | [Issue #63](https://github.com/debesyla/dazniausi-zodziai/issues/63) |

This candidate does not appear in `data/products/publication-plan.json` or the
visitor catalogue. Moving it into the publication plan requires resolving all
of its recorded blockers in a focused review. BLKT is no longer a research
candidate: its reviewed, permission-backed aggregate product is recorded in the
approved table above.

## Permission-backed PDF derivative

Rimkutė's morphemic dictionary is the catalogue's permission-backed PDF
derivative. Its complete canonical TSV is built in the reviewed source
workflow from the three exact PDF files, then consumed by the same static JSON
product pipeline as other large lexical collections. The public product carries
normal attribution and a modification notice; the private correspondence itself
is not publication evidence. A future interactive explorer for the large CCLL
product must additionally meet its documented worker and response budgets;
that does not block access to the published JSON artifacts.
