import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function readRepositoryFile(filename) {
	return readFile(path.join(repositoryRoot, filename), 'utf8');
}

describe('project hygiene', () => {
	it('ships a declared GPL licence for the application code', async () => {
		await expect(access(path.join(repositoryRoot, 'LICENSE'))).resolves.toBeUndefined();
		const license = await readRepositoryFile('LICENSE');
		expect(license).toContain('GNU GENERAL PUBLIC LICENSE');
		expect(license).toContain('Version 3');
	});

	it('keeps the application shell free of client-side telemetry', async () => {
		const appShell = await readRepositoryFile('src/app.html');

		expect(appShell).not.toMatch(/localStorage|document\.referrer|analytics/i);
	});

	it('documents the supported maintainer dataset command', async () => {
		const readme = await readRepositoryFile('README.md');

		expect(readme).toContain('data/datasets/utka-2018-lemmatized-totals.json');
		expect(readme).toContain('npm run data:verify');
		expect(readme).not.toContain('data/datasets/example.json');
		expect(readme).not.toContain('test:e2e');
	});

	it('tracks every approved source collection in the public contract catalog', async () => {
		const sourceCatalog = await readRepositoryFile('docs/source-catalog.md');

		for (const collection of [
			'Utka 2018 lemmatised word list',
			'Dadurkevičius DML6 vs JCL',
			'Dadurkevičius JCL word list',
			'Petkevičius CCLL lemmatised frequency list',
			'Bielinskienė et al. Delfi.lt 1-gram list',
			'MATAS v3.0',
			'Žemrietė Lithuanian homoforms',
			'Raškinis foreign-name transliteration pairs',
			'Birvinskaitė Lithuanian basketball slang',
			'Lithuanian Treebank ALKSNIS v3.0',
			'Rimkutė morphemic dictionary',
			'Utka CCLL word lists',
			'Utka CCLL2 vs war in Ukraine',
			'Lithuanian Parliament Corpus',
			'Bendrasis lietuvių kalbos tekstynas (BLKT)'
		]) {
			expect(sourceCatalog).toContain(collection);
		}
		expect(sourceCatalog).toContain('byte-for-byte reproducibility');
	});

	it('tracks externally gated research candidates without authorizing products', async () => {
		const sourceCatalog = await readRepositoryFile('docs/source-catalog.md');
		const ledger = JSON.parse(await readRepositoryFile('data/research/source-candidates.json'));
		const plan = JSON.parse(await readRepositoryFile('data/products/publication-plan.json'));

		expect(ledger.schemaVersion).toBe(1);
		expect(new Set(ledger.candidates.map((candidate) => candidate.id)).size).toBe(ledger.candidates.length);
		expect(ledger.candidates).toEqual([
			expect.objectContaining({
				id: 'tilde-2026-parallel-and-monolingual-corpora',
				status: 'blocked-external',
				trackingIssue: 'https://github.com/debesyla/dazniausi-zodziai/issues/63',
				rawImportAuthorized: false,
				publicProductAuthorized: false
			})
		]);
		for (const candidate of ledger.candidates) {
			expect(Object.keys(candidate).sort()).toEqual([
				'blockers',
				'id',
				'licence',
				'publicProductAuthorized',
				'rawImportAuthorized',
				'sourceUrl',
				'status',
				'title',
				'trackingIssue'
			]);
			expect(candidate.id).toMatch(/^[a-z0-9][a-z0-9-]+$/);
			expect(candidate.sourceUrl).toMatch(/^https:\/\/clarin-repo\.lt\/items\/[a-f0-9-]+$/);
			expect(candidate.trackingIssue).toMatch(/^https:\/\/github\.com\/debesyla\/dazniausi-zodziai\/issues\/\d+$/);
			expect(candidate.licence).toEqual(expect.any(String));
			expect(candidate.licence.length).toBeGreaterThan(0);
			expect(candidate.status).toBe('blocked-external');
			expect(candidate.rawImportAuthorized).toBe(false);
			expect(candidate.publicProductAuthorized).toBe(false);
			expect(candidate.blockers.length).toBeGreaterThan(0);
			for (const blocker of candidate.blockers) {
				expect(Object.keys(blocker).sort()).toEqual(['kind', 'summary']);
				expect(blocker.kind).toMatch(/^[a-z][a-z-]+$/);
				expect(blocker.summary).toEqual(expect.any(String));
				expect(blocker.summary.length).toBeGreaterThan(20);
			}
			expect(sourceCatalog).toContain(candidate.title);
			expect(sourceCatalog).toContain(candidate.trackingIssue);
		}

		const productContractIds = plan.contractProducts.map((product) => product.contractId);
		expect(productContractIds).toContain('vssa-2026-blkt-wordform-profile');
		expect(productContractIds).not.toContain('tilde-2026-parallel-and-monolingual-corpora');
		expect(ledger.candidates.map((candidate) => candidate.id)).not.toContain('vssa-2026-general-lithuanian-corpus');
		expect(sourceCatalog).not.toContain('The only maintained collection without public rows');
	});

	it('assigns every collection a public JSON product or an explicit metadata-only decision', async () => {
		const plan = JSON.parse(await readRepositoryFile('data/products/publication-plan.json'));

		expect(plan.genericProducts.map((product) => product.datasetFile)).toEqual([
			'datasets/utka-2018-lemmatized-totals.json',
			'datasets/dadurkevicius-2020-jcl-lemmas.json',
			'datasets/petkevicius-2025-ccll-lemmas.json'
		]);
		expect(plan.contractProducts.map((product) => product.contractId)).toEqual([
			'utka-ccll-wordforms',
			'dadurkevicius-dml6-vs-jcl-comparison',
			'utka-ccll2-war-ukraine-comparison',
			'bielinskiene-2019-delfi-1grams',
			'rimkute-2024-matas-v3-frequencies',
			'zemriete-2025-lithuanian-homoforms',
			'raskinis-2025-foreign-name-transliterations',
			'birvinskaite-2026-lithuanian-basketball-slang',
			'rimkute-2019-alksnis-syntactic-context',
			'kapociute-dzikiene-2017-parliament-frequency-aggregates',
			'vssa-2026-blkt-wordform-profile',
			'rimkute-morphemic-dictionary'
		]);
		expect(plan.contractProducts.find((product) => product.contractId === 'rimkute-2019-alksnis-syntactic-context')).toMatchObject({
			productType: 'chunked-syntactic-context',
			publication: { status: 'published' },
			syntaxContext: { maxExamplesPerLemma: 12, contextPrefixCodePoints: 3 }
		});
		expect(plan.contractProducts.find((product) => product.contractId === 'kapociute-dzikiene-2017-parliament-frequency-aggregates')).toMatchObject({
			productType: 'chunked-frequency-list',
			publication: { status: 'published' },
			views: [{ id: 'wordforms-by-frequency' }, { id: 'lemmas-by-frequency' }]
		});
		expect(plan.contractProducts.find((product) => product.contractId === 'vssa-2026-blkt-wordform-profile')).toMatchObject({
			productType: 'chunked-comparison',
			publication: { status: 'published' },
			views: [{ id: 'wordform-scope-metrics', lookup: { type: 'exact-string-range' } }],
			wordformProfile: { validatedSubtypes: { count: 11, published: false } }
		});
		expect(plan.contractProducts.find((product) => product.contractId === 'rimkute-morphemic-dictionary')).toMatchObject({
			productType: 'chunked-lexical-collection',
			publication: { status: 'published' },
			views: [{
				id: 'entries-by-source-order',
				ordering: { field: 'source', direction: 'as-stored' },
				fields: [
					{ id: 'wordform' },
					{ id: 'frequency', type: 'raw-token-count' },
					{ id: 'morphemicAnalysis' },
					{ id: 'lemmaAndMorphology' },
					{ id: 'volume' },
					{ id: 'sourcePage' }
				]
			}]
		});
	});

	it('pins the reviewed Rimkute source identities through the public product', async () => {
		const contracts = JSON.parse(await readRepositoryFile('data/contracts/deferred-sources.json'));
		const manifest = JSON.parse(await readRepositoryFile('static/data-products/rimkute-morphemic-dictionary/manifest.json'));
		const index = JSON.parse(await readRepositoryFile('static/data-products/rimkute-morphemic-dictionary/views/entries-by-source-order/index.json'));
		const contract = contracts.contracts.find((candidate) => candidate.id === 'rimkute-morphemic-dictionary');
		const expectedFiles = [
			{ artifactId: 'rimkute-morphemic-dictionary-volume-one', volume: 'I', format: 'binary', bytes: 2404144, sha256: '982b0080e08b314246d2aa0995248bf10a6b0d9a1424b593d56e410e34547dfa', pages: 801 },
			{ artifactId: 'rimkute-morphemic-dictionary-volume-two', volume: 'II', format: 'binary', bytes: 1065088, sha256: '546ada8c3e99cd978b25e4edcadc7958d4f6c0ecf38bc3ee4825db767838cdbc', pages: 357 },
			{ artifactId: 'rimkute-morphemic-dictionary-volume-three', volume: 'III', format: 'binary', bytes: 2670927, sha256: '016f23e6bffba91ee53de74871793221177091fd8e950c60901e921efd6f266e', pages: 961 },
			{ artifactId: 'rimkute-morphemic-dictionary-entries', role: 'morphemic-entries', format: 'text', bytes: 6351453, sha256: '5a579304382a6f4a3447d1e36b5b638ad890d33fb8df9076976c01e3eade9dca', rows: 72325 },
			{ artifactId: 'rimkute-morphemic-dictionary-extraction-summary', format: 'rimkute-extraction-summary', bytes: 4848, sha256: '845bcc9cf3609305492472b777dd29f6a1077023df424f59ee4478b6ee4832b4' }
		];
		const identity = ({ artifactId, volume, role, format, bytes, sha256, pages, rows }) => ({
			artifactId,
			...(volume === undefined ? {} : { volume }),
			...(role === undefined ? {} : { role }),
			format,
			bytes,
			sha256,
			...(pages === undefined ? {} : { pages }),
			...(rows === undefined ? {} : { rows })
		});

		expect(contract.source.files.map(identity)).toEqual(expectedFiles);
		expect(manifest.provenance.files.map(identity)).toEqual(expectedFiles);
		expect(contract.source.extraction).toMatchObject({ rows: 72325, frequencyTotal: 310012 });
		expect(manifest.provenance.extraction).toEqual(contract.source.extraction);
		expect(index.sourceFile).toMatchObject(expectedFiles[3]);
		expect(index.summary).toMatchObject({ sourceRows: 72325, recordCount: 72325, numericTotals: { frequency: 310012 } });
	});

	it('documents which statistical explorations the reviewed data can support', async () => {
		const roadmap = await readRepositoryFile('docs/statistical-exploration-roadmap.md');

		expect(roadmap).toContain('## Capability matrix');
		expect(roadmap).toContain('DML6 coverage profile');
		expect(roadmap).toContain('Wartime lexical contrast');
		expect(roadmap).toContain('MATAS concordance and co-occurrence');
		expect(roadmap).toContain('zero populated `HEAD` values and zero populated `DEPREL` values');
		expect(roadmap).toContain('No time trend');
	});
});
