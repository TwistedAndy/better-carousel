/*
 * Write results/REPORT.md from results/sizes.json, results/runtime.json and the feature table in libs.mjs.
 * Run: node report.mjs. run.mjs calls it at the end.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { baseline, features, libs } from './libs.mjs';

const here = dirname(fileURLToPath(import.meta.url)),
	read = (name) => (existsSync(join(here, 'results', name)) ? JSON.parse(readFileSync(join(here, 'results', name), 'utf8')) : null);

const names = Object.fromEntries([...libs, baseline].map((lib) => [lib.id, lib.name]));

// The median, and the lowest and the highest value
function stats(values) {
	const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
	if (!sorted.length) {
		return null;
	}
	const middle = sorted.length >> 1;
	return { median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2, min: sorted[0], max: sorted[sorted.length - 1], n: sorted.length };
}

// "12.3 (11.8–13.0)": the median and the range of the rounds
function cell(values, digits = 1) {
	const value = stats(values);
	if (!value) {
		return '-';
	}
	const format = (number) => number.toFixed(digits);
	return value.n > 1 && format(value.min) !== format(value.max) ? format(value.median) + ' (' + format(value.min) + '–' + format(value.max) + ')' : format(value.median);
}

const table = (head, rows) => ['| ' + head.join(' | ') + ' |', '|' + head.map((_, index) => (index ? ' ---: ' : ' --- ')).join('|') + '|', ...rows.map((row) => '| ' + row.join(' | ') + ' |')].join('\n');

const kb = (bytes) => (bytes / 1024).toFixed(1);

function sizeSection(sizes) {
	const rows = sizes.libs.map((lib) => {
		const { core, typical, parity } = lib.sets;
		return [lib.name + ' ' + lib.version, kb(core.js.gzip), kb(typical.js.gzip), kb(typical.css.gzip), '**' + kb(typical.total.gzip) + '**', kb(typical.total.brotli), parity ? kb(parity.total.gzip) : 'no', kb(lib.cdn.js.gzip)];
	});
	return [
		'## Bundle size',
		'',
		'KB after gzip (level 9), from esbuild ' + sizes.esbuild + ' with the same settings for all libraries: ' + sizes.settings.format + ', ' + sizes.settings.target + ', minified, tree shaken.',
		'',
		'- **Core**: the smallest import that makes a carousel that the user can drag.',
		'- **Typical**: loop, drag, arrows, dots, autoplay, and the accessibility module if the library has one. For Embla, the arrows and the dots are the script and the CSS of the Embla examples, and the ClassNames plugin gives the state classes.',
		'- **Parity**: the typical set, with the mouse wheel, the auto scroll, the auto height, the free drag, the sync and the lazy load. For Embla, the sync and the lazy load are the scripts of the Embla examples. "no" means that the library does not have these features.',
		'- **Shipped files**: the minified files that the package gives for a script tag, as they are, for all the features of the parity set. For Embla, the core file and the files of the Autoplay, ClassNames, AutoScroll, AutoHeight and WheelGestures plugins, each compressed separately.',
		'',
		table(['Library', 'Core JS', 'Typical JS', 'Typical CSS', 'Typical JS + CSS', 'Typical, brotli', 'Parity JS + CSS', 'Shipped files JS'], rows)
	].join('\n');
}

// The metrics of each scenario: [title, getter, digits]
const columns = {
	load: [
		['Main-thread time, ms', (r) => r.task],
		['Total Blocking Time, ms', (r) => r.tbt, 0],
		['Mount call, ms', (r) => r.init],
		['Layouts', (r) => r.layouts, 0],
		['Layout shift', (r) => r.cls, 3],
		['DOM nodes', (r) => r.nodes, 0],
		['JS heap, KB', (r) => r.heap, 0]
	],
	motion: [
		['CPU, %', (r) => r.cpu],
		['Script, ms', (r) => r.script, 0],
		['Layouts', (r) => r.layouts, 0],
		['Style recalcs', (r) => r.styles, 0],
		['Paints', (r) => r.paints, 0],
		['Frames shown', (r) => r.frames.updates, 0],
		// Less than 20 frames with an update give no useful share
		['Frames dropped or late, %', (r) => (r.frames.updates >= 20 ? ((r.frames.dropped + r.frames.partial) / r.frames.updates) * 100 : NaN)]
	]
};

// A carousel moved if the selected slide changed in each scenario with an action
const moved = (r) => r.scenario === 'load' || r.scenario === 'idle' || r.lib === 'none' || new Set(r.indexes).size > 1;

// The share of the frames that were dropped or late. Less than 20 frames with an update give no useful share.
const badFrames = (r) => (r.frames.updates >= 20 ? ((r.frames.dropped + r.frames.partial) / r.frames.updates) * 100 : NaN);

// The summary columns: [title, scenario, value, digits]. Less is better in all columns.
const summaryColumns = [
	['Load ms', 'load', (r) => r.task, 0],
	['TBT ms', 'load', (r) => r.tbt, 0],
	['CLS', 'load', (r) => r.cls, 3],
	['Idle CPU %', 'idle', (r) => r.cpu, 1],
	['Navigate ms', 'navigate', (r) => r.task, 0],
	['Nav. paints', 'navigate', (r) => r.paints, 0],
	['Autoplay CPU %', 'autoplay', (r) => r.cpu, 1],
	['Drag ms', 'drag', (r) => r.task, 0],
	['Drag paints', 'drag', (r) => r.paints, 0],
	['Busy bad frames %', 'busy', badFrames, 1]
];

/**
 * Get the summary of one profile: the median of the main values of each scenario.
 *
 * @returns {{head: string[], rows: string[][]}}
 */
export function summary(runtime, profile) {
	const list = runtime.results.filter((r) => r.profile === profile),
		ids = runtime.settings.libs.filter((id) => list.some((r) => r.lib === id)).sort((a, b) => (a === 'none') - (b === 'none'));
	const rows = ids.map((id) => [
		names[id],
		...summaryColumns.map(([, scenario, get, digits]) => {
			const own = list.filter((r) => r.lib === id && r.scenario === scenario);
			if (own.some((r) => !moved(r))) {
				return 'did not move';
			}
			const value = stats(own.map(get));
			return value ? value.median.toFixed(digits) : '-';
		})
	]);
	return { head: ['Library', ...summaryColumns.map(([title]) => title)], rows };
}

// The size rows: KB after gzip, JS and CSS
function sizeSummary(sizes) {
	const rows = sizes.libs.map((lib) => [lib.name + ' ' + lib.version, kb(lib.sets.core.total.gzip), kb(lib.sets.typical.total.gzip), lib.sets.parity ? kb(lib.sets.parity.total.gzip) : 'no', kb(lib.cdn.total.gzip)]);
	return { head: ['Library', 'Core', 'Typical', 'All features', 'Shipped files'], rows };
}

// A table for the console: the first column at the left, the other columns at the right
function textTable({ head, rows }) {
	const widths = head.map((title, index) => Math.max(title.length, ...rows.map((row) => String(row[index]).length))),
		line = (row) => row.map((value, index) => (index ? String(value).padStart(widths[index]) : String(value).padEnd(widths[index]))).join('  ');
	return [line(head), widths.map((width) => '-'.repeat(width)).join('  '), ...rows.map(line)].join('\n');
}

function profileTitle(runtime, profile) {
	const p = runtime.settings.profiles[profile];
	return profile[0].toUpperCase() + profile.slice(1) + ': ' + p.viewport.width + ' × ' + p.viewport.height + ', ' + (p.cpu > 1 ? 'CPU ' + p.cpu + ' times slower' : 'no CPU throttling') + ', ' + p.per + (p.per > 1 ? ' slides' : ' slide') + ' in view';
}

const summaryNote = 'Load: main-thread time, Total Blocking Time (TBT) and Cumulative Layout Shift (CLS) of a page with 10 carousels. Navigate: 6 calls of next(). Drag: 5 drags. Busy: the frames that were dropped or late during navigate, while another script blocks the main thread. The values are the medians of all rounds. Less is better in all columns.';

const descriptions = {
	load: '10 carousels on one page. The values are from the start of the page to 1 s after the load event. Main-thread time includes the parse of the page and the decode of the images: compare each library to "No carousel".',
	idle: 'One carousel at rest for 2 s, after the page is at rest. A carousel that does nothing must cost nothing.',
	navigate: 'One carousel. The runner calls next() 6 times, one time each 700 ms. A motion takes 400 ms where the library has a duration option.',
	autoplay: 'One carousel with the autoplay at 1500 ms, for 4.5 s.',
	drag: 'One carousel. 5 drags of 70% of the width, in 18 moves of about 16 ms each, then a release and a wait of 700 ms. Mobile uses touch events, desktop uses the mouse.',
	busy: 'The navigate scenario while another script blocks the main thread for 35 ms of each 50 ms. A motion that needs the main thread on each frame drops frames here.'
};

function runtimeSection(runtime) {
	const out = ['## Runtime'];
	const { environment: env, settings } = runtime;

	for (const profile of Object.keys(settings.profiles)) {
		const p = settings.profiles[profile];
		out.push('', '### ' + profile[0].toUpperCase() + profile.slice(1) + ': ' + p.viewport.width + ' × ' + p.viewport.height + ', ' + (p.cpu > 1 ? 'CPU ' + p.cpu + ' times slower' : 'no CPU throttling') + ', ' + p.per + (p.per > 1 ? ' slides' : ' slide') + ' in view');
		for (const scenario of settings.scenarios ? Object.keys(settings.scenarios) : []) {
			const list = runtime.results.filter((r) => r.profile === profile && r.scenario === scenario);
			if (!list.length) {
				continue;
			}
			const cols = columns[scenario === 'load' ? 'load' : 'motion'],
				ids = [...new Set(list.map((r) => r.lib))].sort((a, b) => (a === 'none') - (b === 'none') || settings.libs.indexOf(a) - settings.libs.indexOf(b));
			const rows = ids.map((id) => {
				const own = list.filter((r) => r.lib === id),
					moved = scenario === 'load' || scenario === 'idle' || id === 'none' || own.every((r) => new Set(r.indexes).size > 1),
					errors = own.reduce((sum, r) => sum + r.errors.length, 0);
				return [names[id] + (moved ? '' : ' ⚠ did not move') + (errors ? ' ⚠ ' + errors + ' errors' : ''), ...cols.map(([, get, digits]) => cell(own.map(get), digits ?? 1))];
			});
			out.push('', '#### ' + scenario[0].toUpperCase() + scenario.slice(1), '', descriptions[scenario] || '', '', table(['Library', ...cols.map(([title]) => title)], rows));
		}
	}

	out.push('', 'Each cell is the median of ' + settings.rounds + ' rounds, with the lowest and the highest value in parentheses.');
	return out.join('\n');
}

function environmentSection(sizes, runtime) {
	const env = runtime?.environment || {};
	const rows = [
		['Date', env.date || sizes?.built],
		['Browser', (env.browser || '-') + (env.headless ? ', headless' : ', with a window')],
		['OS', env.os],
		['CPU', env.cpu],
		['Memory', env.memory],
		['Node.js', env.node],
		['puppeteer-core', env.puppeteer],
		['esbuild', sizes?.esbuild],
		['Better Carousel commit', env.commit ? env.commit + (env.dirty ? ' with changes that are not committed' : '') : '-'],
		['Rounds, seed', runtime ? runtime.settings.rounds + ', ' + runtime.settings.seed : '-'],
		['Libraries', sizes?.libs.map((lib) => lib.name + ' ' + lib.version + (lib.released ? ' (' + lib.released + ')' : '')).join(', ')]
	];
	return ['## Environment', '', table(['Item', 'Value'], rows.map(([a, b]) => [a, b ?? '-']))].join('\n');
}

function featureSection() {
	return ['## Features', '', 'From the documentation and the type files of each package, at the versions above.', '', table(['Feature', ...libs.map((lib) => lib.name)], features)].join('\n');
}

/**
 * Make a horizontal bar chart as SVG, with the lowest value at the top. Better Carousel has its own color.
 *
 * @param {string} title
 * @param {string} unit
 * @param {Array<[string, number]>} entries The library ID and the value.
 * @param {number} digits
 * @returns {string}
 */
function barChart(title, unit, entries, digits = 0) {
	const list = entries.filter(([, value]) => Number.isFinite(value)).sort((a, b) => a[1] - b[1]),
		max = Math.max(...list.map(([, value]) => value)) || 1,
		width = 640,
		label = 120,
		bar = 22,
		gap = 8,
		top = 36,
		room = width - label - 80,
		height = top + list.length * (bar + gap);
	const rows = list.map(([id, value], index) => {
		const y = top + index * (bar + gap),
			length = Math.max(2, (value / max) * room),
			color = id === 'better' ? '#7c3aed' : '#9ca3af';
		return '<text x="' + (label - 8) + '" y="' + (y + 15) + '" text-anchor="end">' + names[id] + '</text>' +
			'<rect x="' + label + '" y="' + y + '" width="' + length.toFixed(1) + '" height="' + bar + '" rx="3" fill="' + color + '"/>' +
			'<text x="' + (label + length + 6).toFixed(1) + '" y="' + (y + 15) + '">' + value.toFixed(digits) + ' ' + unit + '</text>';
	});
	return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="13" fill="#6b7280">' +
		'<text x="0" y="18" font-size="15" font-weight="600">' + title + '</text>' + rows.join('') + '</svg>\n';
}

/**
 * Write the charts of the main README to results/charts/.
 */
function charts(sizes, runtime) {
	const folder = join(here, 'results', 'charts'),
		ids = libs.map((lib) => lib.id),
		median = (profile, scenario, get) => (id) => {
			const own = runtime.results.filter((r) => r.lib === id && r.profile === profile && r.scenario === scenario);
			return own.length && own.every(moved) ? stats(own.map(get))?.median ?? NaN : NaN;
		},
		list = [];
	mkdirSync(folder, { recursive: true });
	if (sizes) {
		list.push(['size', barChart('All features: JS + CSS, gzip (Glide: typical setup)', 'KB', sizes.libs.map((lib) => [lib.id, (lib.sets.parity || lib.sets.typical).total.gzip / 1024]), 1)]);
	}
	if (runtime && runtime.settings.profiles.mobile) {
		const chart = (name, title, unit, scenario, get, digits) => list.push([name, barChart(title, unit, ids.map((id) => [id, median('mobile', scenario, get)(id)]), digits)]);
		chart('navigate', 'Mobile: main-thread time of 6 slide changes', 'ms', 'navigate', (r) => r.task, 0);
		chart('drag', 'Mobile: main-thread time of 5 drags', 'ms', 'drag', (r) => r.task, 0);
		chart('autoplay', 'Mobile: CPU load of the autoplay', '%', 'autoplay', (r) => r.cpu, 1);
		chart('blocking', 'Mobile: Total Blocking Time of a page with 10 carousels', 'ms', 'load', (r) => r.tbt, 0);
	}
	list.forEach(([name, svg]) => writeFileSync(join(folder, name + '.svg'), svg));
}

export function report() {
	const sizes = read('sizes.json'),
		runtime = read('runtime.json');
	const parts = ['# Carousel benchmark results', '', 'Made by `bench/run.mjs` and `bench/report.mjs`. See `bench/README.md` for the method and the steps to run it again.'];
	parts.push('', environmentSection(sizes, runtime));
	if (runtime) {
		parts.push('', '## Summary');
		for (const profile of Object.keys(runtime.settings.profiles)) {
			const { head, rows } = summary(runtime, profile);
			parts.push('', '### ' + profileTitle(runtime, profile), '', table(head, rows));
		}
		parts.push('', summaryNote);
	}
	if (sizes) {
		parts.push('', sizeSection(sizes));
	}
	if (runtime) {
		parts.push('', runtimeSection(runtime));
	}
	parts.push('', featureSection(), '');
	writeFileSync(join(here, 'results', 'REPORT.md'), parts.join('\n'));
	charts(sizes, runtime);

	// The same summary in the console
	const out = [];
	if (sizes) {
		out.push('Bundle size, KB after gzip, JS + CSS', '', textTable(sizeSummary(sizes)));
	}
	if (runtime) {
		for (const profile of Object.keys(runtime.settings.profiles)) {
			out.push('', profileTitle(runtime, profile), '', textTable(summary(runtime, profile)));
		}
		out.push('', summaryNote);
	}
	out.push('', 'All values and the feature table: ' + join(here, 'results', 'REPORT.md'));
	console.log('\n' + out.join('\n'));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	report();
}
