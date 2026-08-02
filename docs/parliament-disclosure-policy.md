# Parliament corpus disclosure policy

The public Parliament product is quarantined at **corpus-wide aggregate**
granularity. It publishes only separate word-form and lemma frequency totals.
It does not authorize calendar, session, document, source-group, speaker,
author, or person-level analysis.

The machine-readable policy is
[`data/policies/parliament-disclosure.json`](../data/policies/parliament-disclosure.json).
`npm run disclosure:verify` walks the complete public product—not only its
manifest—and rejects an extra view, an unapproved file, identity-bearing or
temporal object keys, a record with more than the approved word/lemma and count
fields, a non-lexical string payload, or a mismatch between index and chunk
record totals. Aggregate tokens must match the source pipeline's Unicode-letter
rule and are capped at 64 code points; the reviewed outputs currently have a
maximum of 27. The same verifier runs inside `npm run public:verify` and
therefore in pull-request CI.

Source-author names in the citation are required CC BY attribution. They do
not identify corpus speakers and are not record fields. A word or surname that
occurs in a corpus-wide frequency row is likewise an unattributed aggregate
token, not a speaker mapping; the verifier protects structure rather than
mistaking ordinary lexical values for identity metadata.

## Why temporal publication is blocked

Each source filename contains a structurally valid `YYYY-MM-DD` label, but the
official record and paper do not define that label's semantic relationship to
the speech. It must not be described as a speech date, session date, or
publication date without authoritative documentation or provider confirmation.

No minimum-cell threshold has been invented while that prerequisite is
missing. A number chosen without an empirical disclosure-risk review would not
make an otherwise undefined grouping safe. The machine policy therefore keeps
the temporal status `blocked`, the minimum-cell status
`pending-disclosure-review`, and its threshold `null`.

Before any time view can be proposed, a focused review must record all of the
following:

1. An authoritative definition of the source label used for grouping.
2. The exact grouping, universe, numerator, denominator, tokenizer, missing
   value, and zero semantics.
3. The cell-size distribution and a justified minimum-cell threshold, plus
   primary and secondary suppression rules that prevent differencing.
4. A proof that no text, excerpt, document row or identifier, archive path,
   source group, speaker/author identity, or person ranking reaches a generated
   artifact.
5. Attribution, licence, privacy, product-size, and visitor-claim review, with
   tests for every approved field and output file.

Person-level statistics, authorship attribution, politician rankings,
quotations, and document browsing remain prohibited rather than pending. Any
change to these decisions requires separate maintainer authorization; issue
[#68](https://github.com/debesyla/dazniausi-zodziai/issues/68) tracks the
unresolved research boundary.
