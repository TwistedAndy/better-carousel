import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { defaults } from '../src/scripts/options.js';
import { events, methods, options } from '../scripts/reference.js';
import { writeDocs } from '../scripts/docs.mjs';

// The code that has the public methods and emits the events: all source files
const source = ['index.js', ...readdirSync(new URL('../src/scripts/', import.meta.url)).map((file) => 'scripts/' + file)].map((file) => readFileSync(new URL('../src/' + file, import.meta.url), 'utf8')).join('\n');

// All names in code format of a text, such as "`goToSnap(index, instant)`" -> "goToSnap"
const names = (list) => list.flatMap((item) => [...item.name.matchAll(/`(?:BetterCarousel\.)?(\w[\w:]*)/g)].map((match) => match[1]));

test('docs: each option is in the reference, with its default value', () => {
	assert.deepEqual(options.map((option) => option.name).sort(), Object.keys(defaults).sort());
	for (const option of options) {
		assert.deepEqual(option.default, defaults[option.name], option.name);
	}
});

test('docs: each event that the code emits is in the reference', () => {
	// "interact" is for the features only: goToSnap(), a drag or a wheel step stops the autoplay and the auto scroll
	const emitted = [...source.matchAll(/emit\('([\w:]+)'\)/g)].map((match) => match[1]).filter((name) => name !== 'interact');
	const documented = names(events);
	emitted.push('init', 'reinit', 'autoplay:play', 'autoplay:stop', 'autoscroll:play', 'autoscroll:stop');
	assert.deepEqual([...new Set(emitted)].sort(), documented.sort());
});

test('docs: each method in the reference is in the code', () => {
	for (const name of names(methods)) {
		assert.match(source, new RegExp('\\b' + name + '\\b'), name);
	}
});

test('docs: the types have each option, each event and each method', () => {
	const types = readFileSync(new URL('../src/types/better-carousel.d.ts', import.meta.url), 'utf8'),
		list = types.match(/export interface Options \{[\s\S]*?\n\}/)[0],
		typed = [...list.matchAll(/^\t(\w+)\?:/gm)].map((match) => match[1]);
	assert.deepEqual(typed.sort(), Object.keys(defaults).sort());
	for (const name of names(events)) {
		assert.match(types, new RegExp("\\| '" + name + "'"), 'event ' + name);
	}
	for (const name of names(methods)) {
		assert.match(types, new RegExp('\\b' + name + '\\b'), 'method ' + name);
	}
});

test('docs: README.md and index.html are current. Run "npm run docs" if this test fails.', () => {
	assert.deepEqual(writeDocs(false), []);
});
