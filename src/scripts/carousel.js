/*
 * Carousel: its state, its API, the setup, the measure pass, the render and the motion.
 *
 * The features in the other modules get their part of the carousel through the context object.
 * Each feature is a function that takes the context and returns an object with remove().
 */

import { autoplay, autoScroll } from './autoplay.js';
import { activeSlide, alignOffset, bounds, clamp, distance, inView, nearestSnap, progress, snapIndex, snapOfSlide, snapPosition, snaps, targetLocation } from './geometry.js';
import { drag, wheel } from './input.js';
import { observeSize, readLayout, readRects, visibleArea, waitNear, windowSize } from './layout.js';
import { cloneCount, normalize, pathFits, placement } from './loop.js';
import { addClass, build, cleanStyle, copySlides, labelSlides, readSlides, restore, setClass, setStyle } from './markup.js';
import { animator, EASE, goToDuration } from './motion.js';
import { nav, sync } from './navigation.js';
import { breakpoints, classNames, merge, resolve } from './options.js';

// The instance of each root, viewport and container
const registry = new WeakMap();

/**
 * Get the carousel of a root, a viewport or a container.
 *
 * @param {Element} element
 * @returns {object|undefined}
 */
export const find = (element) => registry.get(element);

/**
 * Make an event emitter. A handler gets (api, name), as in Embla.
 *
 * @param {object} api
 * @returns {{on: Function, off: Function, emit: Function, has: Function}}
 */
function emitter(api) {
	const map = {};

	return {
		on(name, handler) {
			(map[name] ||= new Set()).add(handler);
			return api;
		},
		off(name, handler) {
			map[name]?.delete(handler);
			return api;
		},
		emit(name) {
			map[name]?.forEach((handler) => handler(api, name));
		},
		has(name) {
			return !!map[name]?.size;
		}
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

	// The options and the markup
	let options,
		cls,
		root,
		viewport,
		container,
		slides = [],
		clones = [],
		nodes = [],
		// The features: each has remove()
		parts = [];

	// The observers and the measure state
	let observed = [],
		mutationObserver,
		media = null,
		ready = false,
		started = false,
		changed = false,
		signature = '',
		pending = -1,
		lastWindow = 0;

	// The geometry, the location and the selection
	let geo = null,
		location = 0,
		selected = 0,
		previous = 0,
		requested = -1,
		followed = -1,
		visible = [],
		written = { axis: '', container: 0, slides: [] };

	// The motion and the input
	let motion,
		dragInput,
		wheelInput;

	// The auto scroll, if the option is on
	let auto = null;

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
		destroy: () => {
			teardown(false);
			events.emit('destroy');
		}
	};

	const events = emitter(api),
		owner = { read: measure, write: measured },
		// The states that the "progress" and the "offset" callbacks get. Each call gets the same object, so a frame makes no garbage.
		whole = { progress: 0, snap: 0 },
		each = { slide: null, index: 0, offset: 0, distance: 0, size: 0, visible: 0 },
		/**
		 * What the features share: the API, the events, and the state and the actions of the carousel.
		 * setup() adds root, viewport, container, cls and options.
		 */
		context = {
			api,
			emit: events.emit,
			// The carousel of an element
			find,

			// The state
			geo: () => geo,
			nodes: () => nodes,
			selected: () => selected,
			dragging: () => dragInput.dragging(),
			// The location at rest or at the end of the motion. During the auto scroll, the location now.
			location: () => auto?.at() ?? location,
			current,

			// The actions
			write,
			hold,
			css,
			halt,
			interrupt: () => auto?.interrupt(),
			// Select a snap and move to a location
			move: (index, target, duration, curve) => {
				requested = -1;
				move(index, target, duration, curve);
			},
			// Go to the snap after a snap in a direction: 1, -1, or 0 for the snap itself
			step: (index, direction) => go(wrap(index + direction), false, -1, direction),
			// A linear motion to a location, without the snaps
			glide: (from, to, duration) => {
				location = to;
				motion.run(from, to, duration, [0, 0, 1, 1], events.has('scroll'));
			},
			// Set the slide that the sync option follows
			follow: (index) => {
				followed = index;
			}
		};

	api.on = events.on;
	api.off = events.off;

	// The lazy option: a carousel that is not near the screen waits. A carousel near the screen starts now: a start after the first paint
	// adds the arrows and the dots in view, and this moves the page (CLS).
	const lazy = resolve(element, BetterCarousel.defaults, userOptions).lazy;

	let waiting = lazy ? waitNear(element, lazy, reInit) : null;

	if (waiting) {
		registry.set(element, api);
	} else {
		setup();
	}

	return api;

	/**
	 * Read the options, add the markup and start the observers. The first ResizeObserver callback measures the layout.
	 */
	function setup() {
		media = breakpoints(resolve(element, BetterCarousel.defaults, userOptions), () => reInit());
		options = media.options;

		if (!options.active) {
			return;
		}

		cls = classNames(options.classes, options.state);
		({ root, viewport, container } = build(element, options, cls));

		for (const node of [root, viewport, container]) {
			registry.set(node, api);
		}

		slides = readSlides(container, options.slides);
		nodes = slides;

		observe(true);

		// With the "progress" or the "offset" option, the features call track() on each frame of a motion
		Object.assign(context, { root, viewport, container, cls, options, track: options.progress || options.offset ? track : null });

		motion = animator(container, css, frame, settle, context.track);
		dragInput = drag(context);
		wheelInput = wheel(context);
		container.addEventListener('focusin', onFocus);
		viewport.addEventListener('scroll', onScroll);
		if (options.loop && options.clones === 'fill') {
			addEventListener('resize', onWindow);
		}

		parts = [dragInput, wheelInput, nav(context)];

		if (options.autoplay) {
			api.autoplay = autoplay(context);
			parts.push(api.autoplay);
		}

		if (options.autoScroll) {
			auto = autoScroll(context);
			api.autoScroll = auto.control;
			parts.push(auto);
		}

		if (options.autoHeight) {
			addClass(root, cls.autoHeight);
		}

		if (options.sync) {
			parts.push(sync(context));
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
		observe(false);
		mutationObserver?.disconnect();
		media?.remove();
		media = null;

		if (!cls) {
			return;
		}

		motion.stop();
		parts.forEach((part) => part.remove());
		parts = [];
		followed = -1;
		delete api.autoplay;
		delete api.autoScroll;
		auto = null;
		setStyle(viewport, 'height', '');
		setClones(0);
		container.removeEventListener('focusin', onFocus);
		viewport.removeEventListener('scroll', onScroll);
		removeEventListener('resize', onWindow);

		for (const node of nodes) {
			setStyle(node, 'translate', '');
			node.style.removeProperty('--better-offset');
			setClass(node, cls.active, false);
			setClass(node, cls.inView, false);
			cleanStyle(node);
		}

		setStyle(container, 'translate', '');
		setStyle(container, 'willChange', '');
		setStyle(viewport, 'touchAction', '');
		root.style.removeProperty('--better-progress');
		cleanStyle(container);
		cleanStyle(viewport);
		cleanStyle(root);

		for (const name of ['horizontal', 'vertical', 'dynamic', 'dragging']) {
			setClass(root, cls[name], false);
		}

		for (const node of [root, viewport, container]) {
			registry.delete(node);
		}

		restore(root, viewport, container, slides, keep);

		cls = geo = null;
		ready = false;
		location = 0;
		visible = [];
		signature = '';
		written = { axis: '', container: 0, slides: [] };
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
	 * Put the clones after the last slide.
	 *
	 * @param {number} count The number of copies of all slides.
	 */
	function setClones(count) {
		if (clones.length === count * slides.length) {
			return;
		}

		clones.forEach((node) => node.remove());
		clones = copySlides(slides, count, cls.clone);
		container.append(...clones);
		nodes = slides.concat(clones);
		written.slides.length = slides.length;
		mutationObserver?.takeRecords();
	}

	/**
	 * Watch the size of the viewport, the container and the slides.
	 *
	 * @param {boolean} on false stops the watch.
	 */
	function observe(on) {
		observeSize(observed);
		observed = on ? [viewport, container, ...nodes] : [];
		observeSize(observed, owner);
	}

	function onMutation() {
		slides = readSlides(container, options.slides);
		setClones(0);
		nodes = slides;
		changed = true;
		observe(true);
	}

	// The original slide index of a slide or a clone
	function original(index) {
		return index % slides.length;
	}

	// The logical snap of a physical snap. They are different only when the carousel has clones.
	function logical(index) {
		return geo ? geo.map[index] ?? 0 : index;
	}

	// The physical snap of an index, such as the selected snap + 1. In loop mode, the first snap follows the last snap.
	function wrap(index) {
		return snapIndex(index, geo.snaps.length, geo.period);
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

		return best < 0 ? clamp(index, 0, geo.snaps.length - 1) : best;
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

	// The location now, also during a motion
	function current() {
		return auto?.at() ?? motion.current() ?? location;
	}

	/**
	 * Read the layout and compute the geometry. This function does not write to the DOM.
	 *
	 * @returns {boolean} false if nothing changed.
	 */
	function measure() {
		const layout = readLayout(container, options),
			rects = readRects(viewport, nodes, layout, shown());

		// With clones: 'fill', the loop fills the window
		lastWindow = options.loop && options.clones === 'fill' ? windowSize(layout.axis) : 0;

		const area = visibleArea(viewport, layout, rects.view, lastWindow),
			text = JSON.stringify([layout.axis, layout.rtl, typeof layout.align === 'string' && layout.align, rects, area]);

		if (text === signature && ready) {
			return false;
		}

		signature = text;

		const keep = ready ? selectedSlide() : requested,
			count = slides.length,
			originals = rects.slides.slice(0, count),
			content = bounds(originals),
			fit = content.size <= rects.view + 1 && !(options.autoScroll && options.loop),
			from = location;

		let copies = 0,
			length = 0;

		if (options.loop && !fit && count) {
			// The loop period: the distance from the first slide start to the same point in the next copy of the slides
			const size = content.size + rects.gap,
				all = bounds(rects.slides);
			copies = options.clones ? cloneCount(size, area.size, content.max) : 0;
			length = all.size + rects.gap;
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
		if (!context.dragging()) {
			location = targetLocation(geo.snaps[selected].location, from, length);
		}

		return true;
	}

	// A change of the window size can change the visible area, and the viewport size can stay the same.
	// Mobile browsers send a resize when the address bar shows or hides. Measure only if the size on the main axis changes.
	function onWindow() {
		if (geo && windowSize(geo.axis) !== lastWindow && measure()) {
			measured();
		}
	}

	/**
	 * Write the result of a measure pass and emit the events.
	 */
	function measured() {
		if (pending >= 0) {
			setClones(pending);
			pending = -1;
			signature = '';
			observe(true);
			return;
		}

		// The auto scroll starts again from its location with the new layout
		if (auto?.control.isPlaying()) {
			halt();
		}

		// A motion goes on to the new location of its snap, for example when the selected slide changes its width. A drag keeps its location.
		const at = motion.current();
		if (at !== null && written.axis === geo.axis && !geo.fit && motion.retarget(location)) {
			place(at, location);
			render(true);
		} else {
			motion.stop();
			render(context.dragging());
		}
		labelSlides(slides, options.labels.slide);

		wheelInput.listen(options.wheel && !geo.fit && (geo.axis === 'y' || options.wheel === 'both'));

		if (!options.resize) {
			observe(false);
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

		auto?.resume();
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
			list = [...new Set(inView(geo.slides, location, geo.view, options.inViewThreshold, geo.period).map(original))].sort((a, b) => a - b);

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
	 * Get the CSS translate value of a screen value.
	 *
	 * @param {number} value px
	 * @returns {string}
	 */
	function translate(value) {
		return value ? (geo.axis === 'x' ? value + 'px' : '0 ' + value + 'px') : '';
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
		setStyle(container, 'translate', translate(written.container));
		place(value, value);
		context.track?.(value);
	}

	/**
	 * Write the "progress" and the "offset" options for a location: the CSS variables, or the calls of the callbacks.
	 *
	 * @param {number} at The location.
	 */
	function track(at) {
		if (options.progress === true) {
			root.style.setProperty('--better-progress', progress(at, geo.min, geo.max, geo.period));
		} else if (options.progress) {
			const value = snapPosition(geo.snaps, at, geo.period),
				snap = Math.floor(value);
			whole.progress = progress(at, geo.min, geo.max, geo.period);
			whole.snap = logical(snap) + value - snap;
			options.progress(whole, api);
		}

		if (options.offset) {
			// The shifts of the slides on the screen. Only the auto scroll changes them during a motion.
			const sign = geo.rtl ? -1 : 1,
				shifts = auto?.shown(sign, written.axis)?.slides || written.slides;

			nodes.forEach((slide, index) => {
				const box = geo.slides[index],
					size = box.end - box.start,
					// The slide start on the screen, and its distance from its snap position
					start = box.start + sign * (shifts[index] || 0) + at,
					delta = start - alignOffset(geo.align, geo.view, size, index),
					offset = delta / (size + geo.gap);

				if (options.offset === true) {
					slide.style.setProperty('--better-offset', offset);
				} else {
					each.slide = slide;
					each.index = original(index);
					each.offset = offset;
					each.distance = sign * delta;
					each.size = size;
					each.visible = clamp((Math.min(start + size, geo.view) - Math.max(start, 0)) / size, 0, 1) || 0;
					options.offset(each, api);
				}
			});
		}
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
				setStyle(node, 'translate', translate(value));
			}
		});
	}

	// The CSS translate value of a location
	function css(value) {
		return translate(screen(value)) || '0px';
	}

	/**
	 * Get the translate values that show now: the written values, or the values of a motion or of the auto scroll.
	 *
	 * @returns {{axis: string, container: number, slides: number[]}}
	 */
	function shown() {
		const sign = geo?.rtl ? -1 : 1,
			moving = motion.current();

		return auto?.shown(sign, written.axis) || (moving === null ? written : { ...written, container: sign * moving });
	}

	/**
	 * Go to a snap.
	 *
	 * @param {number} index The snap index. physical() and wrap() give a valid index.
	 * @param {boolean} [instant]
	 * @param {number} [slide] The slide index, for goToSlide().
	 * @param {number} [direction] 1 to go forward, -1 to go back, 0 for the shortest path in a loop.
	 */
	function go(index, instant, slide = -1, direction = 0) {
		if (waiting) {
			reInit();
		}
		auto?.interrupt();
		if (!geo) {
			options.startSnap = index;
			requested = slide;
			return;
		}

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
		auto?.settled();
	}

	/**
	 * Stop the auto scroll and the motion where they are, and write that location.
	 *
	 * @returns {number} The location.
	 */
	function halt() {
		const at = auto?.cancel();
		if (at != null) {
			hold(at);
		}
		return location = motion.stop() ?? location;
	}

	/**
	 * Write a location without a motion, and select the snap that is nearest to it.
	 *
	 * @param {number} value
	 * @param {boolean} [scroll] Emit "scroll", as during a motion.
	 */
	function hold(value, scroll) {
		location = value;
		(scroll ? frame : write)(value);
		if (select(nearestSnap(geo.snaps, value, geo.period))) {
			render(true);
			events.emit('select');
		}
	}

	/**
	 * Go to a slide that gets the keyboard focus, if it does not show fully.
	 *
	 * @param {FocusEvent} event
	 */
	function onFocus(event) {
		const index = slides.findIndex((node) => node.contains(event.target));
		if (!geo || index < 0 || performance.now() - dragInput.pressed() < 600) {
			return;
		}
		if (options.focus && !inView(geo.slides, location, geo.view, 1, geo.period).map(original).includes(index)) {
			api.goToSlide(index);
		}
		events.emit('slidefocus');
	}

	/**
	 * The browser scrolls the viewport to a focused element, although its overflow is hidden. Scroll it back.
	 */
	function onScroll() {
		viewport.scrollLeft = viewport.scrollTop = 0;
	}
}
