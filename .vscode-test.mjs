import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	// Integration tests only; unit tests run in plain Node via `npm run test:unit`.
	files: 'out/test/*.test.js',
	mocha: { ui: 'tdd', timeout: 20000 },
});
