// Write the reference tables and the file sizes into README.md and index.html, and the Options interface into the types.
//
// Each file marks a generated part with <!-- generated:name --> ... <!-- /generated -->. In the types, each marker is in a // comment.
// Run "node scripts/docs.mjs" to write the files, or "node scripts/docs.mjs --check" to find the files that are not current.
// The build runs this script after it writes the minified file.

import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { classes, embla, events, methods, options, site } from './reference.js';

const root = fileURLToPath(new URL('..', import.meta.url));

const files = ['README.md', 'index.html', 'src/types/better-carousel.d.ts'];

const marker = /(\t\/\/ )?<!-- generated:(\w+) -->[\s\S]*?<!-- \/generated -->/g;

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Get the GitHub anchors of the headings in a Markdown text.
 *
 * @param {string} text
 * @returns {Set<string>}
 */
function anchors(text) {
	const list = text.match(/^#{1,6} .+$/gm) || [];
	return new Set(list.map((line) => line.replace(/^#+ /, '').toLowerCase().replace(/[^\w\- ]/g, '').replace(/ /g, '-')));
}

/**
 * Convert the text format of the reference to Markdown or to HTML.
 *
 * @param {string} text
 * @param {boolean} html
 * @param {Set<string>} local The anchors of README.md.
 * @returns {string}
 */
function inline(text, html, local) {
	if (!html) {
		return text.replace(/\|/g, '\\|').replace(/\]\(#([\w-]+)\)/g, (all, id) => local.has(id) ? all : '](' + site + '#' + id + ')');
	}
	return escape(text).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\[([^\]]+)\]\(#([\w-]+)\)/g, '<a href="#$2">$1</a>');
}

/**
 * Show a default value as code.
 *
 * @param {object} option
 * @returns {string}
 */
function shown(option) {
	if ('shown' in option) {
		return option.shown;
	}
	const value = option.default;
	return '`' + (typeof value === 'string' ? "'" + value + "'" : JSON.stringify(value)) + '`';
}

/**
 * Make a table.
 *
 * @param {string[]} head
 * @param {string[][]} rows Each cell in the text format of the reference.
 * @param {boolean} html
 * @param {Set<string>} local
 * @returns {string}
 */
function table(head, rows, html, local) {
	if (html) {
		const body = rows.map((row) => '<tr>' + row.map((cell) => '<td>' + inline(cell, true, local) + '</td>').join('') + '</tr>').join('\n');
		return '<div class="table table_reference"><table><thead><tr>' + head.map((cell) => '<th>' + cell + '</th>').join('') + '</tr></thead><tbody>\n' + body + '\n</tbody></table></div>';
	}
	const lines = [head, head.map(() => '---'), ...rows.map((row) => row.map((cell) => inline(cell, false, local)))];
	return lines.map((row) => '| ' + row.join(' | ') + ' |').join('\n');
}

/**
 * Get the sizes of a file in KB: minified, gzip and brotli.
 *
 * @param {string} file
 * @returns {number[]}
 */
function sizes(file) {
	const code = readFileSync(root + file);
	return [code.length, gzipSync(code, { level: 9 }).length, brotliCompressSync(code).length].map((bytes) => bytes / 1024);
}

/**
 * Make the members of the Options interface of the types.
 *
 * @returns {string}
 */
function members() {
	return options.map((option) => {
		const type = option.ts || option.type.replace(/`/g, '').replace(/, /g, ' | ') + (option.default === null ? ' | null' : ''),
			text = option.text.replace(/\[([^\]]+)\]\(#[\w-]+\)/g, '$1') + ('shown' in option ? '' : ' @default ' + shown(option).slice(1, -1)) + (option.example ? ' @see {@link ' + site + '#' + option.example + ' | example}' : '');
		return '\t/** ' + text + ' */\n\t' + option.name + '?: ' + type + ';';
	}).join('\n');
}

/**
 * Make the generated parts of a file.
 *
 * @param {boolean} html
 * @param {Set<string>} local
 * @returns {Object<string, string>}
 */
function parts(html, local) {
	const example = (id) => id ? ' ([example](#' + id + '))' : '';
	const js = sizes('dist/better-carousel.min.js'),
		css = sizes('dist/better-carousel.css'),
		kb = (value) => value.toFixed(1) + ' KB';

	const result = {
		options: table(['Option', 'Type', 'Default', 'Description'], options.map((option) => [
			html ? option.name : '`' + option.name + '`',
			option.type,
			shown(option),
			option.text + example(option.example)
		]), html, local),
		methods: table(['Method', 'Returns', 'Description'], methods.map((item) => [item.name, item.returns || '-', item.text]), html, local),
		events: table(['Event', 'When'], events.map((item) => [item.name, item.text]), html, local),
		classes: table(['Class', 'Element'], classes.map((item) => [item.name, item.text]), html, local),
		embla: table(['Embla', 'Embla name', 'Better Carousel'], embla.map((item) => [item.version, item.name, item.text]), html, local),
		sizes: table(['File', 'Minified', 'Gzip', 'Brotli'], [
			['`better-carousel.min.js`', ...js.map(kb)],
			['`better-carousel.css`', ...css.map(kb)],
			['Total', ...js.map((value, index) => kb(value + css[index]))]
		], html, local),
		gzip: kb(js[1])
	};

	// The option names in HTML get an anchor for the links from the examples
	if (html) {
		result.options = result.options.replace(/<tr><td>(\w+)<\/td>/g, '<tr><td><code id="option-$1">$1</code></td>');
	}

	return result;
}

/**
 * Find the files that are not current, and write them.
 *
 * @param {boolean} [write] false: only find the files.
 * @returns {string[]} The files that were not current.
 */
export function writeDocs(write = true) {
	const changed = [];

	for (const file of files) {
		const before = readFileSync(root + file, 'utf8'),
			types = file.endsWith('.ts'),
			list = types ? { options: members() } : parts(file.endsWith('.html'), anchors(before));

		let after = before.replace(marker, (all, prefix = '', name) => {
			if (!(name in list)) {
				throw new Error(file + ': unknown generated part "' + name + '"');
			}
			const value = name === 'gzip' ? list.gzip : '\n' + list[name] + '\n' + prefix;
			return prefix + '<!-- generated:' + name + ' -->' + value + '<!-- /generated -->';
		});

		// The size badge has no room for a marker
		after = types ? after : after.replace(/static\/gzip\/[\d.]+%20KB/g, 'static/gzip/' + list.gzip.replace(' ', '%20')).replace(/alt="[\d.]+ KB gzipped"/g, 'alt="' + list.gzip + ' gzipped"');

		if (after !== before) {
			changed.push(file);
			if (write) {
				writeFileSync(root + file, after);
			}
		}
	}

	return changed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const check = process.argv.includes('--check'),
		changed = writeDocs(!check);
	if (check && changed.length) {
		console.error('Not current: ' + changed.join(', ') + '. Run "npm run docs".');
		process.exit(1);
	}
	console.log(changed.length ? 'Docs: wrote ' + changed.join(', ') : 'Docs: no change');
}
