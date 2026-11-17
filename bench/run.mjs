/*
 * Measure the runtime cost of each library in Chrome: CPU time, layout and style work, paints, frames, layout shift and memory.
 *
 * Run "node build.mjs" first, or "npm start" for both. Then: node run.mjs [--quick] [--rounds 5] [--profiles mobile,desktop] [--libs better,swiper] [--scenarios load,idle] [--seed 1] [--headed]
 * Set CHROME to the path of Chrome if the script does not find it.
 *
 * Each measurement uses a new incognito context, so no cache, storage or JIT state carries over.
 * In each round, the order of the libraries is shuffled with a seeded random function. The seed is in the results.
 */

import { execSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import os from 'node:os';
import { basename, dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { baseline, libs } from './libs.mjs';
import { report } from './report.mjs';

const here = dirname(fileURLToPath(import.meta.url)),
	root = join(here, '..');

// The command line options
const argv = process.argv.slice(2),
	arg = (name, fallback) => {
		const index = argv.indexOf('--' + name);
		return index < 0 ? fallback : argv[index + 1];
	};

const settings = {
	// --quick: one round, for a first look. The full run uses 3 rounds and gives the median.
	rounds: +arg('rounds', argv.includes('--quick') ? 1 : 3),
	seed: +arg('seed', 1),
	profiles: arg('profiles', 'mobile,desktop').split(','),
	libs: arg('libs', [...libs, baseline].map((lib) => lib.id).join(',')).split(','),
	scenarios: arg('scenarios', 'load,idle,navigate,autoplay,drag,busy').split(','),
	headless: !argv.includes('--headed'),
	chrome: findChrome()
};

if (argv.includes('--help')) {
	console.log('node run.mjs [--quick] [--rounds 3] [--seed 1] [--profiles mobile,desktop] [--libs ' + settings.libs.join(',') + '] [--scenarios ' + settings.scenarios.join(',') + '] [--headed]');
	process.exit(0);
}
if (!settings.chrome) {
	console.error('Chrome was not found. Set the CHROME environment variable to the path of Chrome or Chromium.');
	process.exit(1);
}
if (!existsSync(join(here, 'dist', settings.libs[0] + '.js'))) {
	console.error('The test pages are not built. Run "node build.mjs" first, or "npm start" for both steps.');
	process.exit(1);
}

/**
 * Find Chrome or Chromium in the usual places, if the CHROME environment variable does not give it.
 *
 * @returns {string|undefined}
 */
function findChrome() {
	if (process.env.CHROME) {
		return process.env.CHROME;
	}
	const env = process.env,
		paths = {
			win32: [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter(Boolean).map((folder) => folder + '\\Google\\Chrome\\Application\\chrome.exe'),
			darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'],
			linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium']
		};
	return (paths[process.platform] || []).find((path) => existsSync(path));
}

/*
 * The device profiles. The mobile profile is the Lighthouse mobile setting: a Moto G Power screen and a CPU 4 times slower.
 * The slow CPU is an emulation: Chrome pauses the renderer main thread. The compositor and the GPU keep the speed of this computer.
 */
const profiles = {
	mobile: {
		viewport: { width: 412, height: 823, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true },
		userAgent: 'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
		cpu: 4,
		per: 1
	},
	desktop: {
		viewport: { width: 1350, height: 940, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
		userAgent: null,
		cpu: 1,
		per: 3
	}
};

/*
 * The scenarios. Each one opens the page, waits until the page is at rest, and measures one action.
 * count: the number of carousels on the page. autoplay: the delay in ms. settle: the wait in ms before the measure.
 */
const scenarios = {
	// 10 carousels, as on a shop page: the work to start them, the blocking time and the layout shift
	load: { count: 10, autoplay: 0, settle: 1000 },
	// One carousel at rest for 2 s: a carousel that does nothing must cost nothing
	idle: { count: 1, autoplay: 0, settle: 1000, action: (page) => sleep(2000) },
	// 6 calls of next(), one each 700 ms. A motion takes 400 ms.
	navigate: { count: 1, autoplay: 0, settle: 1000, action: (page) => steps(page, 6, 700) },
	// The autoplay with a delay of 1500 ms, for 4.5 s
	autoplay: { count: 1, autoplay: 1500, settle: 1000, action: (page) => sleep(4500) },
	// 5 drags from 85% to 15% of the width, in about 300 ms each, then a release. 70% of a slide passes the swipe threshold of all libraries.
	drag: { count: 1, autoplay: 0, settle: 1000, action: (page, profile) => drags(page, profile, 5) },
	// The navigate scenario while other scripts block the main thread for 35 ms of each 50 ms, as during the hydration of a page
	busy: { count: 1, autoplay: 0, settle: 1000, busy: true, action: (page) => steps(page, 6, 700) }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Call next() a number of times, and record the selected slide after each call.
 */
async function steps(page, count, interval) {
	const list = [];
	for (let index = 0; index < count; index++) {
		await page.evaluate(() => window.bench.next());
		await sleep(interval);
		list.push(await page.evaluate(() => window.bench.index()));
	}
	return list;
}

/**
 * Drag the first carousel with the touch screen (mobile) or the mouse (desktop). Each move is one event, each 16 ms.
 */
async function drags(page, profile, count) {
	const box = await page.evaluate(() => window.bench.box()),
		y = box.y + Math.min(box.height / 2, 150),
		touch = profile.viewport.hasTouch,
		cdp = await page.createCDPSession(),
		list = [];

	const send = (type, x) =>
		touch
			? cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
			: cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });

	for (let drag = 0; drag < count; drag++) {
		const from = box.x + box.width * 0.85,
			to = box.x + box.width * 0.15,
			moves = 18;
		await send(touch ? 'touchStart' : 'mousePressed', from);
		for (let step = 1; step <= moves; step++) {
			await sleep(16);
			await send(touch ? 'touchMove' : 'mouseMoved', from + ((to - from) * step) / moves);
		}
		await send(touch ? 'touchEnd' : 'mouseReleased', to);
		await sleep(700);
		list.push(await page.evaluate(() => window.bench.index()));
	}
	await cdp.detach();
	return list;
}

/**
 * Serve the project folder, with no cache and no compression. The page sizes are in build.mjs.
 */
function serve() {
	const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
	const server = createServer((request, response) => {
		const path = normalize(join(root, decodeURIComponent(new URL(request.url, 'http://x').pathname)));
		if (!path.startsWith(root) || !existsSync(path) || !statSync(path).isFile()) {
			response.writeHead(404).end();
			return;
		}
		response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
		createReadStream(path).pipe(response);
	});
	return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// A seeded random function (mulberry32), for an order that the next run can repeat
function random(seed) {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}

function shuffle(list, next) {
	const result = [...list];
	for (let index = result.length - 1; index > 0; index--) {
		const other = Math.floor(next() * (index + 1));
		[result[index], result[other]] = [result[other], result[index]];
	}
	return result;
}

// The Performance.getMetrics values of the renderer, by name
async function metrics(cdp) {
	const { metrics: list } = await cdp.send('Performance.getMetrics');
	return Object.fromEntries(list.map((item) => [item.name, item.value]));
}

/**
 * Count the paints and the frames in a trace.
 * The frames come from the PipelineReporter events: one for each frame that the compositor starts, with the state of the frame.
 * - updates: the frames that had something to show.
 * - presented: the frames that showed all of their updates.
 * - dropped: the frames that Chrome did not show, and that it counts against smoothness (affects_smoothness).
 * - partial: the frames that showed the compositor update, but not the late update of the main thread, and that count against smoothness.
 */
function parseTrace(buffer) {
	const events = JSON.parse(Buffer.from(buffer).toString()).traceEvents,
		main = new Set(events.filter((event) => event.name === 'thread_name' && event.args.name === 'CrRendererMain').map((event) => event.pid + ':' + event.tid)),
		frames = { updates: 0, presented: 0, partial: 0, dropped: 0 };
	let paints = 0;

	for (const event of events) {
		if (event.name === 'Paint' && main.has(event.pid + ':' + event.tid) && event.ph === 'X') {
			paints++;
		}
		// The top event of each frame has the frame state. Its nested events have no state.
		const reporter = event.name === 'PipelineReporter' && event.ph === 'b' && (event.args?.frame_reporter || event.args?.chrome_frame_reporter);
		if (reporter && reporter.state !== 'STATE_NO_UPDATE_DESIRED') {
			frames.updates++;
			if (reporter.state === 'STATE_PRESENTED_ALL') {
				frames.presented++;
			} else if (reporter.affects_smoothness && reporter.state === 'STATE_PRESENTED_PARTIAL') {
				frames.partial++;
			} else if (reporter.affects_smoothness && reporter.state === 'STATE_DROPPED') {
				frames.dropped++;
			}
		}
	}
	return { paints, frames };
}

/**
 * Open one page in a new incognito context and measure one scenario.
 */
async function measure(browser, origin, libId, profileName, scenarioName) {
	const profile = profiles[profileName],
		scenario = scenarios[scenarioName],
		context = await browser.createBrowserContext(),
		page = await context.newPage(),
		cdp = await page.createCDPSession(),
		errors = [];

	page.on('pageerror', (error) => errors.push(error.message));
	await page.setViewport(profile.viewport);
	if (profile.userAgent) {
		await page.setUserAgent(profile.userAgent);
	}
	await page.emulateCPUThrottling(profile.cpu > 1 ? profile.cpu : null);
	await cdp.send('Network.enable');
	await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
	// The default time domain is the wall time. It includes the CPU throttling, which pauses the thread.
	await cdp.send('Performance.enable');

	const url = origin + '/' + basename(here) + '/page.html?lib=' + libId + '&count=' + scenario.count + '&per=' + profile.per + '&autoplay=' + scenario.autoplay;
	await page.goto(url, { waitUntil: 'load' });
	await page.waitForFunction(() => window.bench);
	await sleep(scenario.settle);

	const result = { lib: libId, profile: profileName, scenario: scenarioName, errors };

	if (!scenario.action) {
		// The load scenario: the values from the start of the page
		await cdp.send('HeapProfiler.collectGarbage');
		const values = await metrics(cdp);
		Object.assign(result, await page.evaluate(() => ({ init: window.bench.init, tbt: window.bench.tbt(), cls: window.bench.cls() })), {
			script: values.ScriptDuration * 1000,
			task: values.TaskDuration * 1000,
			layouts: values.LayoutCount,
			styles: values.RecalcStyleCount,
			layoutTime: values.LayoutDuration * 1000,
			styleTime: values.RecalcStyleDuration * 1000,
			nodes: values.Nodes,
			heap: values.JSHeapUsedSize / 1024
		});
	} else {
		if (scenario.busy) {
			await page.evaluate(() => {
				window.busy = setInterval(() => {
					const end = performance.now() + 35;
					while (performance.now() < end);
				}, 50);
			});
		}
		// Only the two categories for the paints and the frames, to keep the cost of the trace low. The cost is the same for all libraries, and the "none" page shows it.
		await page.tracing.start({ categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline.frame'] });
		const before = await metrics(cdp),
			start = Date.now(),
			startIndex = await page.evaluate(() => window.bench.index());
		const indexes = await scenario.action(page, profile);
		const after = await metrics(cdp),
			seconds = (Date.now() - start) / 1000,
			trace = parseTrace(await page.tracing.stop());

		Object.assign(result, {
			seconds,
			// The CPU time of the renderer main thread, in ms for each second and as a share of the time
			task: (after.TaskDuration - before.TaskDuration) * 1000,
			script: (after.ScriptDuration - before.ScriptDuration) * 1000,
			layoutTime: (after.LayoutDuration - before.LayoutDuration) * 1000,
			styleTime: (after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000,
			layouts: after.LayoutCount - before.LayoutCount,
			styles: after.RecalcStyleCount - before.RecalcStyleCount,
			paints: trace.paints,
			frames: trace.frames,
			// The selected slide before and after each step. The run checks that the carousel moved.
			indexes: [startIndex, ...(indexes || [await page.evaluate(() => window.bench.index())])]
		});
		result.cpu = (result.task / (seconds * 1000)) * 100;
	}

	await context.close();
	return result;
}

// The environment of the run, for the results file
function environment(browserVersion) {
	const git = (command) => {
		try {
			return execSync('git ' + command, { cwd: root, encoding: 'utf8' }).trim();
		} catch {
			return null;
		}
	};
	const pkg = (name) => JSON.parse(readFileSync(join(here, 'node_modules', name, 'package.json'), 'utf8')).version;
	return {
		date: new Date().toISOString(),
		browser: browserVersion,
		headless: settings.headless,
		os: os.type() + ' ' + os.release() + ' ' + os.arch(),
		cpu: os.cpus()[0].model.trim() + ', ' + os.cpus().length + ' threads',
		memory: Math.round(os.totalmem() / 1024 ** 3) + ' GB',
		node: process.version,
		puppeteer: pkg('puppeteer-core'),
		esbuild: pkg('esbuild'),
		commit: git('rev-parse --short HEAD'),
		dirty: !!git('status --porcelain'),
		power: 'Not measured. Run on mains power, with other apps closed.'
	};
}

const server = await serve(),
	origin = 'http://127.0.0.1:' + server.address().port,
	browser = await puppeteer.launch({
		executablePath: settings.chrome,
		headless: settings.headless,
		// Keep the timers and the frames of a page at full speed when its window is not in front
		args: ['--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--mute-audio']
	});

const results = [],
	next = random(settings.seed),
	total = settings.rounds * settings.profiles.length * settings.libs.length * settings.scenarios.length;
let done = 0;

// One page per library before the measure, so that the disk cache of the OS and the start of Chrome do not affect the first library
process.stdout.write((await browser.version()).replace('/', ' ') + ', ' + settings.rounds + (settings.rounds > 1 ? ' rounds' : ' round') + '. Warm-up...');
for (const lib of settings.libs) {
	await measure(browser, origin, lib, settings.profiles[0], 'load');
}
const began = Date.now();

for (let round = 0; round < settings.rounds; round++) {
	for (const profileName of settings.profiles) {
		for (const scenarioName of settings.scenarios) {
			for (const lib of shuffle(settings.libs, next)) {
				const result = await measure(browser, origin, lib, profileName, scenarioName);
				result.round = round;
				results.push(result);
				done++;
				const left = Math.ceil((((Date.now() - began) / done) * (total - done)) / 60000);
				process.stdout.write('\r' + done + ' of ' + total + ' measurements, about ' + left + ' min left   ');
			}
		}
	}
}

const output = { environment: environment(await browser.version()), settings: { ...settings, profiles: Object.fromEntries(settings.profiles.map((name) => [name, profiles[name]])), scenarios: Object.fromEntries(settings.scenarios.map((name) => [name, { ...scenarios[name], action: scenarios[name].action?.toString() }])) }, results };

await browser.close();
server.close();

mkdirSync(join(here, 'results'), { recursive: true });
writeFileSync(join(here, 'results', 'runtime.json'), JSON.stringify(output, null, '\t') + '\n');
console.log('\nWrote results/runtime.json');
report();
