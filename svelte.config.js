import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { loadEnv } from 'vite';
import { normalizeBasePath } from './scripts/site-config.mjs';

const mode = process.env.NODE_ENV ?? (process.argv.includes('build') ? 'production' : 'development');
const fileEnvironment = loadEnv(mode, process.cwd(), '');
const basePath = normalizeBasePath(process.env.BASE_PATH ?? fileEnvironment.BASE_PATH);

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// The generated build can be served from a domain root or an explicitly
		// configured subpath on any static web server.
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: undefined,
			precompress: false,
			strict: true
		}),
		paths: {
			base: basePath
		}
	}
};

export default config;
