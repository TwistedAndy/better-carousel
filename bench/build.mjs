/*
 * Build the test pages and measure the bundle sizes.
 *
 * - dist/<id>.js and dist/<id>.css: the test page of each library, for run.mjs.
 * - results/sizes.json: the sizes of the core, typical and parity sets, and of the files that each package ships.
 *
 * All libraries go through the same esbuild settings: ES2020, minified, tree shaken, one IIFE file.
 * Better Carousel is built from ../src, not from its own terser build, so that the minifier is the same for all.
 * Run "npm run build" in the project root first: the CSS of Better Carousel comes from ../dist.
 */

import * as esbuild from 'esbuild';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { baseline, libs } from './libs.mjs';

const here = dirname(fileURLToPath(import.meta.url));
process.chdir(here);
if (!existsSync('../dist/better-carousel.css')) {
	console.error('Run "npm run build" in the project root first. The CSS of Better Carousel comes from ../dist.');
	process.exit(1);
}
mkdirSync('dist', { recursive: true });
mkdirSync('results', { recursive: true });

const shared = {
	bundle: true,
	minify: true,
	format: 'iife',
	target: 'es2020',
	platform: 'browser',
	legalComments: 'none',
	logLevel: 'warning',
	define: { 'process.env.NODE_ENV': '"production"' }
};

/**
 * Get the sizes of a text: minified bytes, gzip level 9 and brotli quality 11.
 *
 * @param {string|Buffer} code
 * @returns {{min: number, gzip: number, brotli: number}}
 */
function sizes(code) {
	const buffer = Buffer.from(code);
	return {
		min: buffer.length,
		gzip: gzipSync(buffer, { level: 9 }).length,
		brotli: brotliCompressSync(buffer, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length
	};
}

// Add the sizes of separate files: a page loads each file on its own
const sum = (list) => list.reduce((total, item) => ({ min: total.min + item.min, gzip: total.gzip + item.gzip, brotli: total.brotli + item.brotli }), { min: 0, gzip: 0, brotli: 0 });

// The CSS files of a set, joined and minified as one file
async function css(files) {
	const text = files.map((file) => readFileSync(file, 'utf8')).join('\n');
	return (await esbuild.transform(text, { loader: 'css', minify: true, target: 'chrome100' })).code;
}

// For the sizes, the harness is a stub: the markup of the test page is not part of a library
const stub = {
	name: 'stub-harness',
	setup(build) {
		build.onResolve({ filter: /harness\.js$/ }, () => ({ path: 'harness', namespace: 'stub' }));
		build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const slides = () => ""; export const config = {};', loader: 'js' }));
	}
};

// Bundle a JS entry from a string, in this folder
async function bundle(contents, plugins = []) {
	const result = await esbuild.build({ ...shared, stdin: { contents, resolveDir: here, loader: 'js' }, write: false, plugins });
	return result.outputFiles[0].text;
}

const report = { built: new Date().toISOString(), esbuild: esbuild.version, settings: { ...shared, gzip: 'level 9', brotli: 'quality 11' }, libs: [] };

for (const lib of [...libs, baseline]) {
	// The test page
	writeFileSync('dist/' + lib.id + '.js', await bundle("import * as adapter from './adapters/" + lib.id + ".js'; import { run } from './harness.js'; run(adapter);"));
	writeFileSync('dist/' + lib.id + '.css', await css(lib.css.typical));

	if (lib === baseline) {
		continue;
	}

	const pkg = JSON.parse(readFileSync(lib.package, 'utf8')),
		entry = { name: lib.name, id: lib.id, version: pkg.version, released: lib.released || null, sets: {} };

	for (const set of ['core', 'typical', 'parity']) {
		if (!lib[set]) {
			entry.sets[set] = null;
			continue;
		}
		const js = sizes(await bundle(lib[set], [stub])),
			style = sizes(await css(lib.css[set] || lib.css.typical));
		entry.sets[set] = { js, css: style, total: sum([js, style]) };
	}

	// The files that the package ships for a script tag, as they are. Each file is compressed separately, as a browser loads it.
	const shipped = (files) => sum(files.map((file) => sizes(readFileSync(file)))),
		cdnJs = shipped(lib.cdn.js),
		cdnCss = shipped(lib.cdn.css);
	entry.cdn = { files: lib.cdn.js.map((file) => file.replace(/^.*node_modules\//, '')), js: cdnJs, css: cdnCss, total: sum([cdnJs, cdnCss]) };

	report.libs.push(entry);
}

writeFileSync('results/sizes.json', JSON.stringify(report, null, '\t') + '\n');

console.log('Built the test pages in dist/ and the sizes in results/sizes.json, with esbuild ' + esbuild.version + '.');
