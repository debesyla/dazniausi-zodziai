import { sveltekit } from '@sveltejs/kit/vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	build: {
		minify: 'esbuild',
		target: 'es2020',
		cssMinify: true,
	},
	test: {
		globals: true,
		environment: 'happy-dom',
		include: ['tests/unit/**/*.{js,ts}'],
		setupFiles: ['tests/setup.js'],
		deps: {
			optimizer: {
				web: {
					include: ['@testing-library/svelte']
				}
			}
		}
	}
});
