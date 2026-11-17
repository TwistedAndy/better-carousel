/*
 * The test page script. It makes the carousels of one library with the same slides and options, and gives the runner the values that it reads.
 * The URL parameters: lib, count (carousels), slides, per (slides in view), autoplay (delay in ms, 0 for no autoplay), gap (px).
 */

const params = new URLSearchParams(location.search);

export const config = {
	lib: params.get('lib'),
	count: +params.get('count') || 1,
	slides: +params.get('slides') || 10,
	per: +params.get('per') || 3,
	gap: params.has('gap') ? +params.get('gap') : 16,
	autoplay: +params.get('autoplay') || 0,
	// The duration of one motion in ms, for the libraries that have this option
	speed: 400
};

// The 400 x 400 images of the demo
const images = [11, 12, 13, 14, 16, 17, 18, 19, 21, 22, 23, 24, 26, 27, 28, 29];

/**
 * Get the HTML of the slides.
 *
 * @param {string} tag The tag of a slide.
 * @param {string} className The class of a slide.
 * @returns {string}
 */
export function slides(tag, className) {
	let html = '';
	for (let index = 0; index < config.slides; index++) {
		const image = images[index % images.length];
		html += '<' + tag + ' class="' + className + '"><div class="card"><img src="../demo/images/' + image + '-400x400.jpg" width="400" height="400" alt="Photo ' + (index + 1) + '"><p>Slide ' + (index + 1) + '</p></div></' + tag + '>';
	}
	return html;
}

// The layout shifts and the long tasks from the start of the page
const shifts = [],
	longTasks = [];
new PerformanceObserver((list) => list.getEntries().forEach((entry) => !entry.hadRecentInput && shifts.push(entry.value))).observe({ type: 'layout-shift', buffered: true });
new PerformanceObserver((list) => list.getEntries().forEach((entry) => longTasks.push(entry.duration))).observe({ type: 'longtask', buffered: true });

/**
 * Make the carousels and give the values to the runner in window.bench.
 *
 * @param {{markup: (root: HTMLElement) => void, mount: (root: HTMLElement, config: object) => object}} adapter
 */
export function run(adapter) {
	const app = document.getElementById('app'),
		roots = [];

	document.documentElement.style.setProperty('--per', config.per);
	document.documentElement.style.setProperty('--gap', config.gap + 'px');

	for (let index = 0; index < config.count; index++) {
		const root = document.createElement('section');
		root.className = 'bench';
		adapter.markup(root);
		app.append(root);
		roots.push(root);
	}

	// The time of the mount calls. The forced layout of the first measure is in this time.
	const start = performance.now();
	const instances = roots.map((root) => adapter.mount(root, config));
	const init = performance.now() - start;

	window.bench = {
		config,
		init,
		instances,
		next: () => instances.forEach((instance) => instance.next()),
		prev: () => instances.forEach((instance) => instance.prev()),
		index: () => instances[0]?.index() ?? 0,
		cls: () => shifts.reduce((sum, value) => sum + value, 0),
		// Total Blocking Time: the part of each long task that is more than 50 ms
		tbt: () => longTasks.reduce((sum, value) => sum + Math.max(0, value - 50), 0),
		// The box of the first carousel, for the drag
		box: () => {
			const rect = roots[0].getBoundingClientRect();
			return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
		}
	};
}
