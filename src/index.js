import { classNames, dataOptions, defaults, merge } from './options.js';
import { emitter } from './events.js';
import { cleanStyle, create, setClass, setStyle, translate } from './dom.js';
import { readLayout, readRects } from './measure.js';
import { activeSlide, bounds, distance, fits, inView, nearestSnap, progress, snapOfSlide, snaps, targetLocation } from './geometry.js';
import { canLoop, cloneCount, normalize, pathFits, period, placement, steps } from './loop.js';
import { animator, EASE, GLIDE, WHEEL, goToDuration, releaseDuration, releaseTarget, resist } from './motion.js';
import { drag } from './drag.js';
import { nav } from './nav.js';
import { sync } from './sync.js';
import { autoplay, controller } from './autoplay.js';

// The instance of each root, viewport and container
const registry = new WeakMap();

// One ResizeObserver for all carousels. Each callback first reads the layout of all carousels, then writes. Thus the reads of one carousel do not
// come after the writes of another carousel, and the browser does one layout for all of them.
const owners = new WeakMap();

// The clones that the library made
const ours = new WeakSet();

// The attributes that the library added: element => names
const marked = new WeakMap();

// A counter for container ids
let uid = 0;

/**
 * Set an attribute that the page did not set. The library removes it in destroy().
 *
 * @param {Element} node
 * @param {string} name
 * @param {string} value
 */
function own(node, name, value) {
	const list = marked.get(node) || new Set();
	if (list.has(name) || !node.hasAttribute(name)) {
		list.add(name);
		marked.set(node, list);
		if (node.getAttribute(name) !== value) {
			node.setAttribute(name, value);
		}
	}
}

/**
 * Remove the attributes that own() added.
 *
 * @param {Element} node
 */
function disown(node) {
	marked.get(node)?.forEach((name) => node.removeAttribute(name));
	marked.delete(node);
}

// Slides that are a control keep their own role and name
const controls = 'a[href],button,input,select,textarea,[tabindex],[role]';

// The slides that can get the "group" role. An element with its own role, such as an article or a list item, does not permit "group".
const generic = 'div,span,section';

let sharedObserver;

function resizeObserver() {
	return sharedObserver ||= new ResizeObserver((entries) => {
		const list = new Set(entries.map((entry) => owners.get(entry.target)));
		[...list].filter((owner) => owner && owner.read()).forEach((owner) => owner.write());
	});
}

// The lazy option: one IntersectionObserver for each margin, the callback of each element that waits, and the boxes that initAll() read
const watchers = new Map(),
	waiters = new WeakMap(),
	boxes = new WeakMap();

/**
 * Call a function when an element comes near the screen.
 *
 * @param {Element} node
 * @param {string} margin The rootMargin of the IntersectionObserver.
 * @param {Function} callback
 * @returns {Function} A function that stops the watch.
 */
function watch(node, margin, callback) {
	let observer = watchers.get(margin);
	if (!observer) {
		observer = new IntersectionObserver((entries) => entries.forEach((entry) => entry.isIntersecting && waiters.get(entry.target)?.()), { rootMargin: margin });
		watchers.set(margin, observer);
	}
	waiters.set(node, callback);
	observer.observe(node);
	return () => {
		observer.unobserve(node);
		waiters.delete(node);
	};
}

/**
 * Make a carousel.
 *
 * @param {HTMLElement} element The container of the slides, or its viewport.
 * @param {object} [userOptions]
 * @returns {object} The carousel API.
 */
export default function BetterCarousel(element, userOptions = {}) {
	const found = registry.get(element);

	if (found) {
		return found;
	}

	let options,
		cls,
		root,
		viewport,
		container,
		slides = [],
		nodes = [],
		created = false,
		added = [],
		geo = null,
		location = 0,
		selected = 0,
		previous = 0,
		requested = -1,
		followed = -1,
		written = { axis: '', container: 0, slides: [] },
		observed = [],
		mutationObserver,
		queries = [],
		ready = false,
		started = false,
		changed = false,
		visible = [],
		signature = '',
		motion,
		removeDrag,
		lastDown = 0,
		dragFrom = 0,
		dragging = false,
		lastWindow = 0,
		wheelTime = 0,
		wheelMoved = 0,
		wheelTimer = 0,
		wheelSnap = 0,
		wheelDirection = 0,
		dragSnap = 0,
		clones = [],
		pending = -1,
		parts = [],
		scroll = null,
		scrollTimer = 0,
		scroller = null,
		scrollOptions;

	const api = {
		goTo: (index, instant) => go(physical(index), instant),
		goToNext: (instant) => api.canGoToNext() && go(wrap(selected + 1), instant, -1, 1),
		goToPrev: (instant) => api.canGoToPrev() && go(wrap(selected - 1), instant, -1, -1),
		goToSlide: (index, instant) => go(physical(api.snapOfSlide(index)), instant, index),
		canGoToNext: () => !!geo && !geo.fit && (!!geo.period || selected < geo.snaps.length - 1),
		canGoToPrev: () => !!geo && !geo.fit && (!!geo.period || selected > 0),
		selectedSnap: () => logical(selected),
		previousSnap: () => logical(previous),
		selectedSlide,
		snapOfSlide: (index) => geo ? logical(snapOfSlide(geo.snaps, geo.slides, index, geo.view, geo.align, geo.period)) : index,
		snapList: () => geo ? geo.logical.map((index) => progress(geo.snaps[index].location, geo.min, geo.max, geo.period)) : [],
		scrollProgress: () => geo ? progress(current(), geo.min, geo.max, geo.period) : 0,
		slideNodes: () => slides.slice(),
		slidesInView: () => visible.slice(),
		rootNode: () => root,
		viewportNode: () => viewport,
		containerNode: () => container,
		isFit: () => !geo || geo.fit,
		options: () => options,
		reInit,
		destroy
	};

	const events = emitter(api),
		owner = { read: measure, write: measured },
		hooks = {
			enabled: () => !!geo && !geo.fit && options.draggable,
			axis: () => ({ x: geo.axis === 'x', sign: geo.rtl ? -1 : 1, threshold: options.dragThreshold }),
			down: () => {
				lastDown = performance.now();
			},
			begin: () => {
				interrupt();
				const at = halt();
				dragFrom = at;
				dragSnap = selected;
				dragging = true;
				write(at);
				setClass(root, cls.dragging, true);
				events.emit('pointerdown');
				return at;
			},
			move: (value) => {
				location = geo.period ? value : resist(value, geo.min, geo.max);
				frame(location);
				if (select(nearestSnap(geo.snaps, location, geo.period))) {
					render(true);
					events.emit('select');
				}
			},
			release: (speed) => {
				const target = releaseTarget({ location, from: dragFrom, velocity: speed, current: dragSnap, snaps: geo.snaps, min: geo.min, max: geo.max, period: geo.period, skipSnaps: options.skipSnaps, dragFree: options.dragFree }),
					curve = options.dragFree === true ? GLIDE : EASE;
				setClass(root, cls.dragging, false);
				dragging = false;
				events.emit('pointerup');
				requested = -1;
				move(target.snap, target.location, releaseDuration(target.location - location, speed, curve, options.duration), curve);
			}
		};

	api.on = events.on;
	api.off = events.off;

	// The lazy option: a carousel that is not near the screen waits. A carousel near the screen starts now: a start after the first paint
	// adds the arrows and the dots in view, and this moves the page (CLS).
	let waiting = null;
	const lazy = merge(defaults, BetterCarousel.defaults, userOptions, dataOptions(element)).lazy;

	if (lazy) {
		const margin = lazy === true ? innerHeight : lazy,
			rect = boxes.get(element) || element.getBoundingClientRect();
		if (!rect.height || rect.bottom < -margin || rect.top > innerHeight + margin) {
			registry.set(element, api);
			waiting = watch(element, lazy === true ? '100%' : lazy + 'px', reInit);
		}
	}

	if (!waiting) {
		setup();
	}

	return api;

	/**
	 * Read the options, add the markup and start the observers. The first ResizeObserver callback measures the layout.
	 */
	function setup() {
		const base = merge(defaults, BetterCarousel.defaults, userOptions, dataOptions(element)),
			points = base.breakpoints || {};

		queries = Object.keys(points).map((query) => {
			const list = matchMedia(query);
			list.addEventListener('change', onQuery);
			return list;
		});

		options = merge(base, ...queries.filter((list) => list.matches).map((list) => points[list.media]));

		if (!options.active) {
			return;
		}

		cls = classNames(options.classes, options.state);

		container = options.container ? element.querySelector(options.container) : element;

		if (container.classList.contains(cls.viewport)) {
			container = container.firstElementChild;
		}

		if (!created) {
			viewport = container.parentElement;
			if (!viewport.classList.contains(cls.viewport) && options.wrap) {
				root = create('div');
				viewport = create('div');
				container.before(root);
				root.append(viewport);
				viewport.append(container);
				created = true;
			} else {
				root = viewport.parentElement;
			}
		}

		addClass(root, cls.root);
		addClass(viewport, cls.viewport);
		addClass(container, cls.container);

		// The carousel pattern of the WAI-ARIA Authoring Practices
		own(root, 'role', 'region');
		own(root, 'aria-roledescription', 'carousel');
		if (!root.hasAttribute('aria-labelledby')) {
			own(root, 'aria-label', options.labels.carousel);
		}
		own(container, 'id', container.id || 'carousel-' + ++uid);
		own(container, 'aria-live', 'polite');

		for (const node of [root, viewport, container]) {
			registry.set(node, api);
		}

		slides = readSlides();
		nodes = slides;

		observe();

		motion = animator(container, css, frame, settle);
		removeDrag = drag(viewport, hooks);
		container.addEventListener('focusin', onFocus);
		viewport.addEventListener('scroll', onScroll);
		if (options.loop && options.clones === 'fill') {
			addEventListener('resize', onWindow);
		}

		parts = [nav(api, root, cls, options)];

		const live = (value) => own(container, 'aria-live', value);

		if (options.autoplay) {
			api.autoplay = autoplay(api, options.autoplay, cls, options.labels, events.emit, live);
			parts.push(api.autoplay.remove);
		}

		if (options.autoScroll) {
			const value = options.autoScroll;
			scrollOptions = { speed: 120, direction: 'forward', startDelay: 1000, stopOnInteraction: true, stopOnMouseEnter: false, stopOnFocusIn: true, playOnInit: true, ...(value > 0 ? { speed: value } : value) };
			api.autoScroll = scroller = controller(api, 'autoscroll', scrollOptions, cls, options.labels, events.emit, live, { play: wait, stop: () => wait(-1) ?? halt(), pause: (paused) => scroll ? scroll.animations.forEach((animation) => animation[paused ? 'pause' : 'play']()) : paused ? halt() : kick() });
			parts.push(scroller.remove);
		}

		if (options.autoHeight) {
			addClass(root, cls.autoHeight);
		}

		if (options.sync) {
			parts.push(sync(api, options.sync, (node) => node && registry.get(node), (node) => {
				const index = nodes.findIndex((item) => item.contains(node));
				return index < 0 ? -1 : original(index);
			}, (index) => {
				followed = index;
			}));
		}

		if (options.slideChanges) {
			mutationObserver = new MutationObserver(onMutation);
			mutationObserver.observe(container, { childList: true });
		}
	}

	/**
	 * Remove what setup() added.
	 *
	 * @param {boolean} keep Keep the wrapper markup for a new setup().
	 */
	function teardown(keep) {
		waiting?.();
		waiting = null;
		registry.delete(element);
		unobserve();
		mutationObserver?.disconnect();
		queries.forEach((list) => list.removeEventListener('change', onQuery));
		queries = [];

		if (!cls) {
			return;
		}

		motion.stop();
		removeDrag();
		parts.forEach((remove) => remove());
		parts = [];
		followed = -1;
		delete api.autoplay;
		delete api.autoScroll;
		scroller = null;
		setStyle(viewport, 'height', '');
		setClones(0);
		container.removeEventListener('focusin', onFocus);
		viewport.removeEventListener('wheel', onWheel);
		clearTimeout(wheelTimer);
		wheelTimer = 0;
		viewport.removeEventListener('scroll', onScroll);
		removeEventListener('resize', onWindow);

		for (const node of nodes) {
			setStyle(node, 'translate', '');
			setClass(node, cls.active, false);
			setClass(node, cls.inView, false);
			cleanStyle(node);
		}

		setStyle(container, 'translate', '');
		setStyle(container, 'willChange', '');
		setStyle(viewport, 'touchAction', '');
		cleanStyle(container);
		cleanStyle(viewport);

		for (const name of ['horizontal', 'vertical', 'dynamic', 'autoHeight', 'dragging']) {
			setClass(root, cls[name], false);
		}

		added.forEach(([node, name]) => setClass(node, name, false));
		[root, container, ...slides].forEach(disown);
		added = [];

		for (const node of [root, viewport, container]) {
			registry.delete(node);
			if (node.getAttribute('class') === '') {
				node.removeAttribute('class');
			}
		}

		if (!keep && created) {
			root.before(container);
			root.remove();
			created = false;
		}

		cls = geo = null;
		ready = dragging = false;
		location = 0;
		visible = [];
		signature = '';
		written = { axis: '', container: 0, slides: [] };
	}

	/**
	 * Add a class and remember it for teardown(), if the element did not have it.
	 */
	function addClass(node, name) {
		if (name && !node.classList.contains(name)) {
			node.classList.add(name);
			added.push([node, name]);
		}
	}

	function readSlides() {
		return [...(options.slides ? container.querySelectorAll(options.slides) : container.children)].filter((node) => !ours.has(node) && !node.hasAttribute('data-carousel-clone'));
	}

	/**
	 * Make the clones: full copies of the slides, after the last slide.
	 *
	 * @param {number} count The number of copies.
	 */
	function setClones(count) {
		if (clones.length === count * slides.length) {
			return;
		}

		clones.forEach((node) => node.remove());
		clones = [];

		for (let copy = 0; copy < count; copy++) {
			for (const node of slides) {
				const clone = node.cloneNode(true);
				for (const item of [clone, ...clone.querySelectorAll('[id]')]) {
					item.removeAttribute('id');
				}
				clone.setAttribute('aria-hidden', 'true');
				clone.inert = true;
				clone.style.translate = '';
				setClass(clone, cls.clone, true);
				cleanStyle(clone);
				ours.add(clone);
				clones.push(clone);
			}
		}

		container.append(...clones);
		nodes = slides.concat(clones);
		written.slides.length = slides.length;
		mutationObserver?.takeRecords();
	}

	// The original slide index of a node
	function original(index) {
		return index % slides.length;
	}

	// The logical snap of a physical snap. They are different only when the carousel has clones.
	function logical(index) {
		return geo ? geo.map[index] ?? 0 : index;
	}

	// The next or the previous physical snap. In loop mode, the first snap follows the last snap.
	function wrap(index) {
		return geo.period ? (index + geo.snaps.length) % geo.snaps.length : index;
	}

	// The location now, also during a motion
	function current() {
		return scroll ? scrollAt() : motion.current() ?? location;
	}

	/**
	 * Find the physical snap of a logical snap that is nearest to the current location.
	 *
	 * @param {number} index The logical snap.
	 * @returns {number}
	 */
	function physical(index) {
		if (!geo) {
			return index;
		}

		let best = -1,
			gap = Infinity;

		geo.snaps.forEach((snap, item) => {
			const value = Math.abs(distance(snap.location, current(), geo.period));
			if (geo.map[item] === index && value < gap) {
				gap = value;
				best = item;
			}
		});

		return best < 0 ? Math.min(Math.max(index, 0), geo.snaps.length - 1) : best;
	}

	/**
	 * Get the original slides that show at a location.
	 *
	 * @param {number} at
	 * @param {number} threshold
	 * @returns {number[]}
	 */
	function seen(at, threshold) {
		return [...new Set(inView(geo.slides, at, geo.view, threshold, geo.period).map(original))].sort((a, b) => a - b);
	}

	function observe() {
		unobserve();
		observed = [viewport, container, ...nodes];
		for (const node of observed) {
			owners.set(node, owner);
			resizeObserver().observe(node);
		}
	}

	function unobserve() {
		for (const node of observed) {
			owners.delete(node);
			sharedObserver.unobserve(node);
		}
		observed = [];
	}

	/**
	 * Write the result of a measure pass and emit the events.
	 */
	function measured() {
		if (pending >= 0) {
			setClones(pending);
			pending = -1;
			signature = '';
			observe();
			return;
		}

		// The auto scroll starts again from its location with the new layout
		if (scroller?.isPlaying()) {
			halt();
		}

		// A motion goes on to the new location of its snap, for example when the selected slide changes its width. A drag keeps its location.
		const at = motion.current();
		if (at !== null && written.axis === geo.axis && !geo.fit && motion.retarget(location)) {
			place(at, location);
			render(true);
		} else {
			motion.stop();
			render(dragging);
		}
		label();

		// A wheel listener that is not passive makes the browser wait for the main thread before it scrolls the page. Add it only where the wheel moves the carousel.
		const wheel = options.wheel && !geo.fit && (geo.axis === 'y' || options.wheel === 'both');
		viewport[wheel ? 'addEventListener' : 'removeEventListener']('wheel', onWheel, { passive: false });

		if (!options.resize) {
			unobserve();
		}

		if (!ready) {
			ready = true;
			events.emit(started ? 'reinit' : 'init');
			started = true;
		} else {
			events.emit('resize');
		}

		if (changed) {
			changed = false;
			events.emit('slideschanged');
		}

		if (scroller?.isPlaying()) {
			kick();
		}
	}

	/**
	 * Give each slide the slide role and a name such as "2 of 8". A slide with its own role, such as an article, keeps it.
	 */
	function label() {
		slides.forEach((node, index) => {
			if (!node.matches(controls) || marked.get(node)?.has('role')) {
				if (node.matches(generic)) {
					own(node, 'role', 'group');
				}
				own(node, 'aria-roledescription', 'slide');
				own(node, 'aria-label', options.labels.slide.replace('%d', index + 1).replace('%n', slides.length));
			}
		});
	}

	function onMutation() {
		slides = readSlides();
		setClones(0);
		nodes = slides;
		changed = true;
		observe();
	}

	/**
	 * Get the part of the main axis where the loop must show slides, relative to the viewport start.
	 * It is the viewport. With clones: 'fill', it is the window, so that the slides fill it when the viewport overflow shows.
	 *
	 * @param {{axis: string, rtl: boolean}} layout
	 * @param {number} view The viewport size.
	 * @returns {{start: number, size: number}}
	 */
	function visibleArea(layout, view) {
		if (!options.loop || options.clones !== 'fill') {
			return { start: 0, size: view };
		}

		const box = viewport.getBoundingClientRect(),
			x = layout.axis === 'x',
			size = windowSize(layout.axis),
			before = Math.max(0, Math.round(x ? (layout.rtl ? size - box.right : box.left) : box.top));

		lastWindow = size;

		return { start: -before, size: before + Math.max(view, Math.round(size - before)) };
	}

	function windowSize(axis) {
		return axis === 'x' ? document.documentElement.clientWidth : innerHeight;
	}

	// A change of the window size can change the visible area, and the viewport size can stay the same.
	// Mobile browsers send a resize when the address bar shows or hides. Measure only if the size on the main axis changes.
	function onWindow() {
		if (geo && windowSize(geo.axis) !== lastWindow && measure()) {
			measured();
		}
	}

	function onQuery() {
		reInit();
	}

	/**
	 * Read the layout and compute the geometry. This function does not write to the DOM.
	 *
	 * @returns {boolean} false if nothing changed.
	 */
	function measure() {
		const layout = readLayout(container, options),
			rects = readRects(viewport, nodes, layout, shown()),
			area = visibleArea(layout, rects.view),
			text = JSON.stringify([layout.axis, layout.rtl, typeof layout.align === 'string' && layout.align, rects, area]);

		if (text === signature && ready) {
			return false;
		}

		signature = text;

		const keep = ready ? selectedSlide() : requested,
			count = slides.length,
			own = bounds(rects.slides.slice(0, count)),
			fit = fits(rects.slides.slice(0, count), rects.view) && !(options.autoScroll && options.loop),
			from = location;

		let copies = 0,
			length = 0;

		if (options.loop && !fit && count) {
			const size = period(own.start, own.end, rects.gap),
				all = bounds(rects.slides);
			copies = /^(auto|fill)$/.test(options.clones) && !canLoop(size, area.size, own.max) ? cloneCount(size, area.size, own.max) : 0;
			length = period(all.start, all.end, rects.gap);
		}

		if (copies * count !== clones.length) {
			pending = copies;
			return true;
		}

		geo = { ...layout, ...rects, area, fit, period: length, min: 0, max: 0 };

		if (fit) {
			geo.snaps = [{ location: 0, slide: activeSlide(rects.slides, 0, rects.view, layout.align) }];
		} else {
			Object.assign(geo, snaps({ ...rects, align: layout.align, slidesToScroll: options.slidesToScroll, containScroll: options.containScroll, period: length }));
		}

		// With clones, a logical snap is a snap whose active slide is an original slide
		const list = geo.snaps.map((snap, index) => index).filter((index) => !clones.length || geo.snaps[index].slide < count);

		geo.logical = list;
		geo.map = geo.snaps.map((snap, index) => clones.length ? Math.max(0, list.findIndex((item) => original(geo.snaps[item].slide) === original(snap.slide))) : index);

		const total = geo.snaps.length;

		selected = keep >= 0 ? physical(api.snapOfSlide(keep)) : Math.min(total - 1, ready ? selected : physical(options.startSnap));
		previous = Math.min(previous, total - 1);
		requested = keep;
		if (!dragging) {
			location = targetLocation(geo.snaps[selected].location, from, length);
		}

		return true;
	}

	/**
	 * Write the location, the classes and the touch action.
	 *
	 * @param {boolean} [keep] Do not write the location, because a motion or a drag writes it.
	 */
	function render(keep) {
		const x = geo.axis === 'x';

		setClass(root, cls.horizontal, x);
		setClass(root, cls.vertical, !x);
		setClass(root, cls.dynamic, !geo.fit);
		setStyle(viewport, 'touchAction', geo.fit ? '' : x ? 'pan-y pinch-zoom' : 'pan-x pinch-zoom');
		setStyle(container, 'willChange', geo.fit ? '' : 'translate');

		if (!keep) {
			write(geo.fit ? 0 : location);
		}

		// Auto height: the height of the tallest slide in view at the target location
		if (options.autoHeight) {
			setStyle(viewport, 'height', x ? Math.max(...inView(geo.slides, location, geo.view, 0, geo.period).map((index) => geo.slides[index].cross)) + 'px' : '');
		}

		const active = selectedSlide(),
			list = seen(location, options.inViewThreshold);

		nodes.forEach((node, index) => setClass(node, cls.active, original(index) === active));

		if (list.join() !== visible.join()) {
			visible = list;
			nodes.forEach((node, index) => setClass(node, cls.inView, list.includes(original(index))));
			events.emit('slidesinview');
		}
	}

	/**
	 * Get the screen value of a location: rounded to device pixels, with the sign of the direction.
	 *
	 * @param {number} value
	 * @returns {number}
	 */
	function screen(value) {
		const scale = devicePixelRatio || 1;
		return Math.round(value * scale) / scale * (geo.rtl ? -1 : 1);
	}

	/**
	 * Write the location as the translate of the container.
	 *
	 * @param {number} value
	 */
	function write(value) {
		if (written.axis !== geo.axis) {
			nodes.forEach((node) => setStyle(node, 'translate', ''));
			written = { axis: geo.axis, container: 0, slides: [] };
		}

		written.container = screen(value);
		setStyle(container, 'translate', translate(geo.axis, written.container));
		place(value, value);
	}

	/**
	 * Write the loop shift of each slide for a motion from one location to another.
	 *
	 * @param {number} from
	 * @param {number} to
	 */
	function place(from, to) {
		const list = geo.period ? placement(geo.slides, from, to, geo.area.size, geo.period, geo.area.start) : [];

		nodes.forEach((node, index) => {
			const value = list.length ? screen(list[index] * geo.period) : 0;
			if ((written.slides[index] || 0) !== value) {
				written.slides[index] = value;
				setStyle(node, 'translate', translate(geo.axis, value));
			}
		});
	}

	/**
	 * Write a location during a motion or a drag.
	 *
	 * @param {number} value
	 */
	function frame(value) {
		write(value);
		events.emit('scroll');
	}

	/**
	 * End a motion.
	 */
	function settle() {
		if (geo.period) {
			location = normalize(location, geo.period);
		}
		render();
		events.emit('settle');
		if (scroller?.isPlaying() && !scroll) {
			wait();
		}
	}

	/**
	 * Change the selected snap.
	 *
	 * @param {number} index
	 * @returns {boolean} true if the snap changed.
	 */
	function select(index) {
		if (index === selected) {
			return false;
		}
		previous = selected;
		selected = index;
		return true;
	}

	/**
	 * Go to a snap.
	 *
	 * @param {number} index The snap index.
	 * @param {boolean} [instant]
	 * @param {number} [slide] The slide index, for goToSlide().
	 */
	function go(index, instant, slide = -1, direction = 0) {
		if (waiting) {
			reInit();
		}
		interrupt();
		if (!geo) {
			options.startSnap = index;
			requested = slide;
			return;
		}

		index = Math.min(geo.snaps.length - 1, Math.max(0, index));
		requested = slide;

		const target = targetLocation(geo.snaps[index].location, current(), geo.period, direction),
			step = Math.abs(index - selected),
			count = geo.period ? Math.min(step, geo.snaps.length - step) : step;

		move(index, target, instant ? 0 : goToDuration(options.duration, count), EASE);
	}

	/**
	 * Select a snap and move to a location.
	 *
	 * @param {number} index The snap index.
	 * @param {number} target The location.
	 * @param {number} duration ms. With 0, the carousel jumps.
	 * @param {number[]} curve
	 */
	function move(index, target, duration, curve) {
		const from = halt(),
			picked = select(index),
			jump = !duration || geo.fit || Math.abs(target - from) < 0.5;

		location = target;

		if (jump) {
			render();
		} else {
			const raf = events.has('scroll') || !!geo.period && !pathFits(geo.slides, from, target, geo.area.size, geo.period);
			render(true);
			if (!raf) {
				place(from, target);
			}
			motion.run(from, target, duration, curve, raf);
		}

		if (picked) {
			events.emit('select');
		}

		// settle() also starts the auto scroll again after a jump
		if (jump) {
			settle();
		}
	}

	// The CSS translate value of a location
	function css(value) {
		return translate(geo.axis, screen(value)) || '0px';
	}

	// The time in the auto scroll iteration, from 0 to 1
	function phase() {
		return (scroll.animations[0].currentTime || 0) % scroll.duration / scroll.duration;
	}

	// The location of the auto scroll now
	function scrollAt() {
		return scroll.from - scroll.direction * scroll.length * phase();
	}

	/**
	 * Get the translate values that show now: the written values, or the values of a motion or of the auto scroll.
	 *
	 * @returns {{axis: string, container: number, slides: number[]}}
	 */
	function shown() {
		const sign = geo?.rtl ? -1 : 1,
			moving = motion.current();

		if (scroll) {
			const time = phase();
			return { axis: written.axis, container: sign * scrollAt(), slides: scroll.list.map(({ k, offset }) => sign * (time >= offset ? k + scroll.direction : k) * scroll.length) };
		}

		return moving === null ? written : { ...written, container: sign * moving };
	}

	/**
	 * Stop the auto scroll and the motion where they are, and write that location.
	 *
	 * @returns {number} The location.
	 */
	function halt() {
		if (scroll) {
			location = scrollAt();
			scroll.animations.forEach((animation) => animation.cancel());
			scroll = null;
			write(location);
			if (select(nearestSnap(geo.snaps, location, geo.period))) {
				render(true);
				events.emit('select');
			}
		}
		return location = motion.stop() ?? location;
	}

	// A drag or a goTo() from the user stops the auto scroll, or makes it wait until the next "settle"
	function interrupt() {
		if (scroller?.isPlaying()) {
			wait(-1);
			if (scrollOptions.stopOnInteraction) {
				scroller.stop();
			}
		}
	}

	/**
	 * Start the auto scroll after its delay.
	 *
	 * @param {number} [cancel] With -1, only stop the timer.
	 */
	function wait(cancel) {
		clearTimeout(scrollTimer);
		scrollTimer = cancel ? 0 : setTimeout(run, scrollOptions.startDelay);
	}

	// Start the auto scroll now, if no delay runs
	function kick() {
		if (!scrollTimer) {
			run();
		}
	}

	/**
	 * Start the auto scroll. With loop, it runs on the compositor: the container moves by one period in each iteration,
	 * and each slide moves by one period at the time when it leaves the visible area. Without loop, it goes to the end.
	 */
	function run() {
		scrollTimer = 0;
		if (!geo || geo.fit || scroll || dragging || scroller.paused()) {
			return;
		}

		const direction = scrollOptions.direction === 'backward' ? -1 : 1,
			from = halt(),
			length = geo.period,
			speed = scrollOptions.speed / 1000;

		if (!length) {
			const to = direction > 0 ? geo.min : geo.max;
			if (Math.abs(to - from) > 1) {
				location = to;
				motion.run(from, to, Math.abs(to - from) / speed, [0, 0, 1, 1], events.has('scroll'));
			}
			return;
		}

		const list = steps(geo.slides, from, geo.area.size, length, direction, geo.area.start),
			timing = { duration: length / speed, iterations: Infinity },
			start = document.timeline.currentTime;

		write(from);
		scroll = {
			from,
			direction,
			length,
			list,
			duration: timing.duration,
			animations: [
				container.animate([{ translate: css(from) }, { translate: css(from - direction * length) }], timing),
				...nodes.map((node, index) => {
					const { k, offset } = list[index],
						before = css(k * length),
						after = css((k + direction) * length);
					return node.animate([{ translate: before }, { translate: before, offset }, { translate: after, offset }, { translate: after }], timing);
				})
			]
		};
		scroll.animations.forEach((animation) => animation.startTime = start);
	}

	/**
	 * Go to a slide that gets the keyboard focus, if it does not show fully.
	 *
	 * @param {FocusEvent} event
	 */
	function onFocus(event) {
		const index = slides.findIndex((node) => node.contains(event.target));
		if (!geo || index < 0 || performance.now() - lastDown < 600) {
			return;
		}
		if (options.focus && !seen(location, 1).includes(index)) {
			api.goToSlide(index);
		}
		events.emit('slidefocus');
	}

	/**
	 * Move the carousel with the wheel: in a vertical carousel, and with wheel: 'both' also in a horizontal carousel. The carousel follows the wheel distance
	 * with a short motion on the compositor. When the wheel stops, the carousel goes to a snap. At the first and the last location, the page scrolls.
	 *
	 * @param {WheelEvent} event
	 */
	function onWheel(event) {
		const side = geo.axis === 'x' && Math.abs(event.deltaX) > Math.abs(event.deltaY),
			delta = side ? event.deltaX * (geo.rtl ? -1 : 1) : event.deltaY;

		if (event.ctrlKey || !delta || dragging) {
			return;
		}

		const now = event.timeStamp,
			gesture = now - wheelTime < 200,
			base = scroll ? scrollAt() : location,
			path = delta * (event.deltaMode === 1 ? 40 : event.deltaMode ? geo.view : 1);

		let target = base - path;
		if (!geo.period) {
			target = Math.min(geo.max, Math.max(geo.min, target));
		}

		wheelTime = now;

		// At the end, the page scrolls. The inertia of a gesture that moved the carousel does not scroll the page.
		if (Math.abs(target - base) < 0.5) {
			if (gesture && now - wheelMoved < 1000) {
				event.preventDefault();
			}
			return;
		}

		event.preventDefault();
		interrupt();

		if (!wheelTimer) {
			wheelSnap = selected;
		}
		wheelMoved = now;
		wheelDirection = path > 0 ? 1 : -1;
		requested = -1;
		move(nearestSnap(geo.snaps, target, geo.period), target, WHEEL, EASE);

		// With dragFree: true, the carousel stays where the wheel stops
		clearTimeout(wheelTimer);
		if (options.dragFree !== true) {
			wheelTimer = setTimeout(wheelEnd, 150);
		}
	}

	/**
	 * Go to a snap when the wheel stops. A short wheel motion goes to the next snap in its direction, so that one wheel step always changes the slide.
	 */
	function wheelEnd() {
		wheelTimer = 0;
		const at = current(),
			index = nearestSnap(geo.snaps, at, geo.period),
			away = Math.abs(targetLocation(geo.snaps[index].location, at, geo.period) - at) > 10;

		if (index === wheelSnap && away) {
			go(wrap(index + wheelDirection), false, -1, wheelDirection);
		} else {
			go(index);
		}
	}

	/**
	 * The browser scrolls the viewport to a focused element, although its overflow is hidden. Scroll it back.
	 */
	function onScroll() {
		viewport.scrollLeft = viewport.scrollTop = 0;
	}

	function selectedSlide() {
		// A carousel with the sync option selects the slide of the other carousel, also after a drag
		if (followed > -1) {
			return followed;
		}
		if (!geo) {
			return Math.max(requested, 0);
		}
		return requested >= 0 && api.snapOfSlide(requested) === logical(selected) ? requested : original(geo.snaps[selected].slide);
	}

	/**
	 * Merge new options and set up the carousel again. The selected slide stays.
	 *
	 * @param {object} [newOptions]
	 */
	function reInit(newOptions) {
		if (newOptions) {
			userOptions = merge(userOptions, newOptions);
		}
		const keep = geo ? selectedSlide() : requested;
		teardown(true);
		setup();
		requested = keep;
	}

	/**
	 * Remove the carousel and restore the DOM.
	 */
	function destroy() {
		teardown(false);
		events.emit('destroy');
	}
}

// The site defaults. They merge over the library defaults.
BetterCarousel.defaults = {};

/**
 * Get the instance of a root, a viewport or a container.
 *
 * @param {Element} element
 * @returns {object|undefined}
 */
BetterCarousel.get = (element) => registry.get(element);

/**
 * Make a carousel for each element that matches a selector and has no carousel.
 *
 * @param {string} selector
 * @param {object} [options]
 * @returns {object[]}
 */
BetterCarousel.initAll = (selector, options) => {
	const elements = [...document.querySelectorAll(selector)];
	// Read all boxes for the lazy option before the first setup() writes. Thus the reads cause one layout, not one for each carousel.
	if (merge(defaults, BetterCarousel.defaults, options).lazy) {
		elements.forEach((element) => boxes.set(element, element.getBoundingClientRect()));
	}
	return elements.map((element) => {
		const carousel = BetterCarousel(element, options);
		boxes.delete(element);
		return carousel;
	});
};
