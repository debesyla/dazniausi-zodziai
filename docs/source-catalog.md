# Curated source catalog decisions

This inventory covers every known collection in the maintained source folder. A source is published only when its meaning, rights, input shape, and browser delivery are clear enough to explain to a visitor. Deferred-source details and byte-level verification are in [source-contracts.md](source-contracts.md).

| Source collection | Decision | Evidence and implementation | Rationale / remaining question |
| --- | --- | --- | --- |
| Utka 2018 lemmatised word list | **Published** | Config: `utka-2018-lemmatized-totals`; 41,977 source and public rows; CC BY 4.0 record at [CLARIN-LT](https://clarin-repo.lt/items/2bf241af-42ab-4a68-8dd6-c119c2dd0e1e). | A normal lemma-plus-POS frequency list. Its config records a source snapshot and representative samples. Retained duplicate keys are intentional under `keep`. |
| Dadurkevičius DML6 vs JCL | **Reshape for a future comparison feature** | Contract: `dadurkevicius-dml6-vs-jcl-comparison`; input folder: `dadurkevicius-2020-06-30-DML6_vs_JCL`; public [CLARIN-LT record](https://clarin-repo.lt/items/b03a5f31-cd2b-4035-9c1b-d568e2524e37). | The `occurrence_in_dml6` values are dictionary-coverage codes (0–3), not frequency or POS. Its comparison and missing-word outputs need a distinct schema and labels before visitors can compare them safely. |
| Dadurkevičius JCL word list | **Published** | Config: `dadurkevicius-2020-jcl-lemmas`; 169,787 UTF-8 TSV lemma-plus-POS rows; total frequency 1,266,854,554; CC BY 4.0 [CLARIN-LT record](https://clarin-repo.lt/items/e61bfe1a-03a9-486a-bd5b-7d31d7102723). | A clean, launch-sized generic lemma frequency list. The importer validates all 16 documented POS codes, source checksum, totals, and manual samples. |
| Rimkutė morphemic dictionary | **No-go pending source review** | Contract: `rimkute-morphemic-dictionary`; input folder contains three PDFs only; canonical [landing record](https://hdl.handle.net/20.500.12259/249). | No reviewed machine-readable input or deterministic extraction specification is available here, and the reuse terms for a converted public dataset are not yet resolved. Do not publish PDFs or extracted rows until both are reviewed. |
| Utka CCLL word lists | **Deferred pending scalable delivery** | Contract: `utka-ccll-wordforms`; UTF-8 wordform frequency lists in `utka-2016-11-17-CCLL-Wordlists`; [CLARIN-LT record](https://clarin-repo.lt/items/a67d3e7a-c2f0-4d0b-9f69-72fdaf2e6c0b). | The full `freq-visas-dzn.txt` list has 1,733,157 rows. The contract defines a 10 KiB catalog, 64 KiB worker chunks, 50 rendered rows, and 100 ms p95 interaction budget. Do not sum the `visas` aggregate with its five subcorpora. |
| Utka CCLL2 vs war in Ukraine | **Reshape for a future comparison feature** | Contract: `utka-ccll2-war-ukraine-comparison`; input: `utka-2016-11-17-ccll2_vs_war_in_UA/original/ccll2_vs_war_in_UA.txt`; [CLARIN-LT record](https://clarin.vdu.lt/xmlui/handle/20.500.11821/57). | Its six metrics compare normalized counts and document counts across CCLL2, wartime media, and social networks. They are nullable, deliberately not a generic total frequency, and must remain labelled with their source denominators. |

## Published-source provenance

The approved configurations each record a source-root repository revision, relative source path, raw-byte SHA-256, UTF-8 assumption, source URL, licence, citation, POS mapping where applicable, expected totals, duplicate policy, and manual samples. Run `npm run data:verify -- --source-root /path/to/dazniausi-zodziai-sources` before committing generated data to confirm byte-for-byte reproducibility.

## Future publication gate

Before changing any deferred or comparative decision, document the visitor-facing meaning of every metric, confirm the public reuse licence, add a reviewed input configuration and snapshot, and prove the delivery model is appropriate for the dataset’s size.
