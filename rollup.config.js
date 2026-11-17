import terser from '@rollup/plugin-terser';
import * as sass from 'sass';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { writeDocs } from './scripts/docs.mjs';

const production = !process.env.ROLLUP_WATCH;

const input = 'src/index.js';

const terserOptions = {
	ecma: 2020,
	compress: {
		pure_getters: true,
		drop_console: true,
		unsafe: true,
		unsafe_arrows: true,
		unsafe_comps: true,
		unsafe_math: true,
		unsafe_methods: true,
		unsafe_undefined: true,
		passes: 3
	}
};

const stylesSource = 'src/styles/better-carousel.scss';
const demoSource = 'demo/styles/demo.scss';

/**
 * Compile the library and the demo styles.
 */
const styles = {
	name: 'styles',
	buildStart() {
		this.addWatchFile(stylesSource);
		this.addWatchFile('demo/styles');
	},
	writeBundle() {
		// The SCSS uses @import, so that node-sass can compile it. Dart Sass warns about @import.
		const options = { style: 'compressed', charset: false, loadPaths: ['src/styles'], silenceDeprecations: ['import'] };
		writeFileSync('dist/better-carousel.css', sass.compile(stylesSource, options).css + '\n');
		writeFileSync('demo/demo.css', sass.compile(demoSource, { ...options, style: 'expanded' }).css + '\n');
	}
};

/**
 * Print the sizes of the minified file.
 */
const size = {
	name: 'size',
	writeBundle(options) {
		const code = readFileSync(options.file);
		const gzip = gzipSync(code, { level: 9 }).length;
		const text = options.file + ': ' + (code.length / 1024).toFixed(2) + ' KB min, ' + (gzip / 1024).toFixed(2) + ' KB gzip';
		console.log(text);
	}
};

/**
 * Write the reference tables and the file sizes into README.md and index.html.
 */
const docs = {
	name: 'docs',
	writeBundle() {
		const changed = writeDocs();
		if (changed.length) {
			console.log('Docs: wrote ' + changed.join(', '));
		}
	}
};

const config = [
	{
		input,
		output: {
			format: 'es',
			file: 'dist/better-carousel.js'
		},
		plugins: [styles]
	}
];

if (production) {
	config.push({
		input,
		output: {
			format: 'iife',
			name: 'BetterCarousel',
			file: 'dist/better-carousel.min.js',
			exports: 'default'
		},
		plugins: [terser(terserOptions), size, docs]
	});
}

export default config;
