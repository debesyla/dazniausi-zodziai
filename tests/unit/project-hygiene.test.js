import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function readRepositoryFile(filename) {
	return readFile(path.join(repositoryRoot, filename), 'utf8');
}

describe('project hygiene', () => {
	it('ships a declared MIT licence', async () => {
		await expect(access(path.join(repositoryRoot, 'LICENSE'))).resolves.toBeUndefined();
		expect(await readRepositoryFile('LICENSE')).toContain('MIT License');
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

	it('tracks a curation decision for every known source collection', async () => {
		const sourceCatalog = await readRepositoryFile('docs/source-catalog.md');

		for (const collection of [
			'Utka 2018 lemmatised word list',
			'Dadurkevičius DML6 vs JCL',
			'Dadurkevičius JCL word list',
			'Petkevičius CCLL lemmatised frequency list',
			'Bielinskienė et al. Delfi.lt 1-gram list',
			'MATAS v3.0',
			'Rimkutė morphemic dictionary',
			'Utka CCLL word lists',
			'Utka CCLL2 vs war in Ukraine'
		]) {
			expect(sourceCatalog).toContain(collection);
		}
		expect(sourceCatalog).toContain('byte-for-byte reproducibility');
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
			'rimkute-morphemic-dictionary'
		]);
		expect(plan.contractProducts.find((product) => product.contractId === 'rimkute-morphemic-dictionary')).toMatchObject({
			productType: 'metadata-only',
			publication: { status: 'metadata-only' },
			blockedBy: ['https://github.com/debesyla/dazniausi-zodziai/issues/41']
		});
	});
});
