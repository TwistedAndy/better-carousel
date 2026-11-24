/*
 * Carousel: its state, its API, the setup, the measure pass, the render and the motion.
 *
 * The features get their part of the carousel through the context object. Each feature is a function that takes the context.
 * It returns nothing if its option is off, or an object with remove(). remove() removes all that the feature added.
 */

import { abs, alignOffset, clamp, compute, floor, inView, nearestSnap, physicalSnap, progress, round, snapIndex, snapOfSlide, snapPosition, targetLocation } from './geometry.js';
import { observeSize, readLayout, readRects, waitNear, windowSize } from './layout.js';
import { normalize, pathFits, placement } from './loop.js';
import { addClass, build, cleanStyle, copyContent, copySlides, labelSlides, own, readSlides, restore, setClass, setStyle } from './markup.js';
import { animator, EASE, snapDuration } from './motion.js';
import { breakpoints, classNames, merge, resolve } from './options.js';

// The instance of each root, viewport and container
const registry = new WeakMap();

// true if the browser supports the pan-up and pan-down values of touch-action
let directional;

/**
 * Get the carousel of a root, a viewport or a container.
 *
 * @param {Element} element
 * @returns {object|undefined}
 */
export const find = (element) => registry.get(element);

/**
 * Make an event emitter. A handler gets (api, name), as in Embla.
 * The handlers of the features run before the handlers of the page, and clear() removes them. listen() takes event names with spaces between them.
 *
 * @param {object} api
 * @returns {{on: Function, off: Function, listen: Function, clear: Function, emit: Function, has: Function}}
 */
function emitter(api) {
	const user = {},
		own = {},
		add = (map, name, handler) => (map[name] ||= new Set()).add(handler);

	return {
		on(name, handler) {
			add(user, name, handler);
			return api;
		},
		off(name, handler) {
			user[name]?.delete(handler);
			return api;
		},
		listen: (names, handler) => names.split(' ').forEach((name) => add(own, name, handler)),
		clear: () => Object.values(own).forEach((set) => set.clear()),
		emit(name) {
			own[name]?.forEach((handler) => handler(api, name));
			user[name]?.forEach((handler) => handler(api, name));
		},
		has: (name) => !!user[name]?.size
	};
}

/**
 * Make a carousel.
 *
 * @param {HTMLElement} element The container of the slides, or its viewport.
 * @param {object} userOptions
 * @param {object} defaults The site defaults.
 * @param {Array<(context: object) => ({remove: () => void}|undefined)>} features
 * @returns {object} The carousel API.
 */
export default function carousel(element, userOptions, defaults, features) {
	const found = registry.get(element);

	if (found) {
		return found;
	}

	// The options and the markup
	let options,
		// The options of the reinit() calls. They apply over the data-carousel attribute.
		changes = {},
		cls,
		root,
		viewport,
		container,
		slides = [],
		clones = [],
		nodes = [],
		// The features that are on
		parts = [];

	// The observers and the measure state
	let observed = [],
		mutationObserver,
		// Watches the content of the slides while the carousel has clones
		copyObserver,
		media = null,
		ready = false,
		started = false,
		changed = false,
		signature = [],
		viewWidth = 0,
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

	// The motion and the drag. A free motion, such as the auto scroll, has no snap: it selects the nearest snap when it stops.
	let motion,
		dragging = false,
		free = false;

	const api = {
		goToSnap: (index, instant) => go(physical(index), instant),
		goToNext: (instant) => advance(1, instant),
		goToPrev: (instant) => advance(-1, instant),
		goToSlide: (index, instant) => go(physical(api.snapOfSlide(index)), instant, index),
		canGoToNext: () => can(1),
		canGoToPrev: () => can(-1),
		selectedSnap: () => logical(selected),
		previousSnap: () => logical(previous),
		selectedSlide,
		snapOfSlide: (index) => geo ? logical(snapOfSlide(geo, index)) : index,
		snapProgress: () => geo ? geo.logical.map((index) => progress(geo.snaps[index].location, geo)) : [],
		progress: () => geo ? progress(current(), geo) : 0,
		slideNodes: () => slides.slice(),
		slidesInView: () => visible.slice(),
		rootNode: () => root,
		viewportNode: () => viewport,
		containerNode: () => container,
		isFit: () => !geo || geo.fit,
		options: () => options,
		reinit,
		destroy: () => {
			if (registry.get(element) === api) {
				teardown(false);
				events.emit('destroy');
			}
		}
	};

	const events = emitter(api),
		owner = { read: measure, write: measured, skip: heightOnly },
		// The states that the "progress" and the "offset" callbacks get. Each call gets the same object, so a frame makes no garbage.
		whole = { progress: 0, snap: 0 },
		each = { node: null, index: 0, offset: 0, distance: 0, size: 0, visible: 0 },
		/**
		 * What the features share: the API, the events, and the state and the actions of the carousel.
		 * setup() adds root, viewport, container, cls and options. reinit() adds playing: an object where the autoplay and the auto scroll
		 * keep their play state for the next setup after a breakpoint change.
		 */
		context = {
			api,
			emit: events.emit,
			// Listen to events, such as 'init reinit', until the teardown
			on: events.listen,
			// Get the carousel of an element, for the sync option
			find,

			// The state
			geo: () => geo,
			selected: () => selected,
			dragging: () => dragging,
			// true while a motion to a location runs, such as a goToSnap() motion or a glide. The auto scroll is not such a motion.
			moving: () => !free && motion.current() !== null,
			// The location at rest or at the end of the motion. During a free motion, the location now.
			location: () => free ? current() : location,
			current,

			// The actions
			hold,
			halt,
			step,
			scroll,
			// Select a snap and move to a location
			move: (index, target, duration, curve) => {
				requested = -1;
				move(index, target, duration, curve);
			},
			// Start or end a drag, and set the "dragging" class. The start is an interaction, as goToSnap() is.
			drag: (on) => {
				dragging = on;
				setClass(root, cls.dragging, on);
				if (on) {
					events.emit('interact');
					events.emit('dragstart');
				} else {
					events.emit('dragend');
				}
			},
			// Set the slide that the sync option follows
			follow: (index) => {
				followed = index;
			}
		};

	api.on = events.on;
	api.off = events.off;

	// The options of the first setup. The lazy option: the carousel waits, and waitNear() starts it before the first paint if it is near the screen.
	let resolved = resolve(element, defaults, userOptions),
		waiting = resolved.lazy ? waitNear(element, resolved.lazy, reinit) : null;

	if (waiting) {
		register(true);
	} else {
		setup();
	}

	return api;

	/**
	 * Read the options, add the markup, start the features and the observers. The first ResizeObserver callback measures the layout.
	 */
	function setup() {
		media = breakpoints(resolved || merge(resolve(element, defaults, userOptions), changes), () => reinit());
		resolved = null;
		options = media.options;

		// An inactive carousel stays in the registry, so that a second call gets it, and a breakpoint can start it again
		if (!options.active) {
			register(true);
			return;
		}

		cls = classNames(options.classes, options.state);
		({ root, viewport, container } = build(element, options, cls));

		register(true);

		slides = readSlides(container, options.slides);
		nodes = slides;
		selected = options.startSnap;

		observe(true);

		Object.assign(context, { root, viewport, container, cls, options });

		parts = features.map((feature) => feature(context)).filter(Boolean);
		motion = animator(container, css, frame, settle, (options.progress || options.offset) && ((at) => track(at, motion.shifts(geo.sign) || written.slides)));

		if (options.autoHeight) {
			addClass(root, cls.autoHeight);
			setStyle(root, '--better-duration', options.duration + 'ms');
		}

		viewport.addEventListener('scroll', onScroll);
		viewport.addEventListener('click', onClick);
		viewport.addEventListener('input', onInput);
		if (options.loop && options.clones === 'fill') {
			addEventListener('resize', onWindow);
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
		register();
		observe(false);
		mutationObserver?.disconnect();
		media?.remove();
		media = null;

		if (!cls) {
			// An inactive carousel kept the wrapper of its last setup
			if (!keep && root) {
				restore(root, viewport, container, [], false);
			}
			return;
		}

		motion.stop();
		parts.forEach((part) => part.remove());
		events.clear();
		parts = [];
		followed = -1;
		dragging = free = false;
		setClones(0);
		viewport.removeEventListener('scroll', onScroll);
		viewport.removeEventListener('click', onClick);
		viewport.removeEventListener('input', onInput);
		removeEventListener('resize', onWindow);

		nodes.forEach(clean);

		setStyle(container, 'translate', '');
		setStyle(container, 'will-change', '');
		setStyle(viewport, 'touch-action', '');
		setStyle(viewport, '--better-touch', '');
		setStyle(viewport, 'height', '');
		setStyle(root, '--better-progress', '');
		setStyle(root, '--better-duration', '');

		for (const name of ['horizontal', 'vertical', 'fit', 'dragging']) {
			setClass(root, cls[name], false);
		}

		[root, viewport, container].forEach(cleanStyle);

		restore(root, viewport, container, slides, keep);

		cls = geo = null;
		ready = false;
		location = 0;
		visible = [];
		signature = [];
		viewWidth = 0;
		written = { axis: '', container: 0, slides: [] };
	}

	/**
	 * Add the carousel to the registry for its element and its markup, so that BetterCarousel.get() finds it, or remove it.
	 *
	 * @param {boolean} [on] Without a value, remove the carousel.
	 */
	function register(on) {
		[element, root, viewport, container].forEach((node) => node && registry[on ? 'set' : 'delete'](node, api));
	}

	/**
	 * Merge new options and set up the carousel again. The selected slide stays. The new options apply over all other sources.
	 *
	 * @param {object} [newOptions]
	 */
	function reinit(newOptions) {
		if (newOptions) {
			changes = merge(changes, newOptions);
			resolved = null;
		}
		const keep = geo ? selectedSlide() : requested;
		// After a breakpoint change, the new autoplay and auto scroll keep the play state. New options start them again.
		context.playing = newOptions ? null : {};
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

		copyObserver?.disconnect();
		if (clones.length) {
			copyObserver ||= new MutationObserver(onCopy);
			slides.forEach((node) => copyObserver.observe(node, { childList: true, characterData: true, subtree: true, attributeFilter: ['class', 'src', 'srcset', 'href', 'value'] }));
		}
	}

	/**
	 * Copy a changed slide into its clones, for example after the page changed a text or an image source. The carousel writes the classes
	 * of the slides, so a change of a slide's own attributes does not count. A style change does not count: a "progress" or an "offset"
	 * callback can write the styles of the elements in the slides on each frame.
	 *
	 * @param {MutationRecord[]} [records] With no records, copy all slides.
	 */
	function onCopy(records) {
		slides.forEach((node, index) => {
			if (!records || records.some(({ type, target }) => node.contains(target) && (type !== 'attributes' || target !== node))) {
				for (let item = index; item < clones.length; item += slides.length) {
					copyContent(clones[item], node);
				}
			}
		});
	}

	// A form field changes its value or its check with no mutation. A checked radio also changes the radios of its group in other slides, so copy all slides.
	function onInput() {
		onCopy();
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

	/**
	 * Find a resize of the viewport that changed only its height in a horizontal carousel with autoHeight.
	 * autoHeight sets this height, and its transition changes it on each frame, so it needs no measure pass.
	 *
	 * @param {ResizeObserverEntry} entry
	 * @returns {boolean}
	 */
	function heightOnly({ target, contentRect: { width } }) {
		if (target !== viewport) {
			return false;
		}
		const same = width === viewWidth;
		viewWidth = width;
		return same && options.autoHeight && geo?.axis === 'x';
	}

	/**
	 * Remove the styles and the classes that the carousel wrote on a slide or a clone.
	 *
	 * @param {HTMLElement} node
	 */
	function clean(node) {
		setStyle(node, 'translate', '');
		setStyle(node, '--better-offset', '');
		setClass(node, cls.selected, false);
		setClass(node, cls.inView, false);
		cleanStyle(node);
	}

	// Keep the selected slide. If the page removed it, select the slide that is now at its index, or the last slide.
	// The loop shift of a slide stays with the slide at its new index, because the measure pass subtracts it from the slide box.
	// A new slide can have the same size as the slide that it replaced, so the measure pass must not skip.
	function onMutation() {
		const old = ready ? selectedSlide() : -1,
			node = slides[old],
			shifts = new Map(slides.map((item, index) => [item, written.slides[index]]));
		slides = readSlides(container, options.slides);
		if (old > -1) {
			const index = slides.indexOf(node);
			requested = index > -1 ? index : Math.min(old, slides.length - 1);
		}
		// A removed slide can come back later, for example after a sort. It must not keep a loop shift.
		shifts.forEach((shift, item) => slides.includes(item) || clean(item));
		setClones(0);
		nodes = slides;
		written.slides = slides.map((item) => shifts.get(item) || 0);
		signature = [];
		changed = true;
		observe(true);
	}

	// The original slide index of a slide or a clone. With no slides, 0.
	function original(index) {
		return index % slides.length || 0;
	}

	// The logical snap of a snap. They are different only when the carousel has clones.
	function logical(index) {
		return geo ? geo.map[index] ?? 0 : index;
	}

	// The snap of a logical snap that is nearest to the current location
	function physical(index) {
		return geo ? physicalSnap(geo, index, current()) : index;
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
		return motion.current() ?? location;
	}

	/**
	 * Read the layout and compute the geometry. This function does not write to the DOM.
	 *
	 * @returns {boolean} false if nothing changed.
	 */
	function measure() {
		const sign = geo?.sign || 1,
			at = motion.current(),
			layout = readLayout(container, options);

		// With clones: 'fill', the loop fills the window
		lastWindow = options.loop && options.clones === 'fill' ? windowSize(layout.axis) : 0;

		// The translate values that show now: the written values, or the values of a motion
		const rects = readRects(viewport, nodes, layout, at === null ? written : { axis: written.axis, container: sign * at, slides: motion.shifts(sign) || written.slides }, lastWindow),
			values = [layout.axis, layout.rtl, typeof layout.align === 'string' && layout.align, rects.view, rects.gap, rects.area.start, rects.area.size, ...rects.slides.flatMap((slide) => [slide.start, slide.end, slide.cross])];

		// A change of less than 0.5 px is not a change. During a motion, the rects have small errors, because the browser and bezier() round the easing differently.
		if (ready && values.length === signature.length && values.every((value, index) => value === signature[index] || abs(value - signature[index]) < 0.5)) {
			return false;
		}

		signature = values;

		// After a change of the slides, onMutation() gives the slide to keep
		const keep = ready && !changed ? selectedSlide() : requested,
			next = compute(layout, rects, slides.length, options);

		if (!next.snaps) {
			pending = next.copies;
			return true;
		}

		geo = next;

		const total = geo.snaps.length;

		// Before the first measure pass, selected is the logical snap of the startSnap option, of goToSnap() or of goToNext().
		// In loop mode, a step before the first snap goes to the last snap.
		selected = keep >= 0 ? physical(api.snapOfSlide(keep)) : Math.min(total - 1, ready ? selected : physical(snapIndex(selected, geo.logical.length, geo.period)));
		previous = Math.min(previous, total - 1);
		requested = keep;
		if (!dragging) {
			location = targetLocation(geo.snaps[selected].location, location, geo.period);
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
			signature = [];
			observe(true);
			return;
		}

		// A free motion stops where it is, and its feature starts it again on "resize"
		if (free) {
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
		labelSlides(slides, options.labels.slide);
		// A right-to-left container gives its direction to the root, so that the arrows and the dots follow it
		if (options.dir === 'auto') {
			own(root, 'dir', geo.rtl && 'rtl');
		}

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
	}

	/**
	 * Write the location, the classes, the touch action and the auto height.
	 *
	 * @param {boolean} [keep] Do not write the location, because a motion or a drag writes it.
	 * @param {boolean} [rest] At the end of a motion: keep the place of the loop slides that are not in view. See place().
	 */
	function render(keep, rest) {
		const x = geo.axis === 'x';

		setClass(root, cls.horizontal, x);
		setClass(root, cls.vertical, !x);
		setClass(root, cls.fit, geo.fit);
		// A touch can scroll the page across the axis. At the first or the last snap of a vertical carousel, it can also scroll the page up
		// or down. Safari has no pan-up and pan-down, so there the carousel keeps the touch.
		const first = !can(-1),
			last = !can(1),
			edge = !x && (first || last) && (directional ??= CSS.supports('touch-action', 'pan-up')) ? (first && last ? 'pan-y ' : first ? 'pan-up ' : 'pan-down ') : '',
			touch = geo.fit ? '' : x ? 'pan-y pinch-zoom' : 'pan-x ' + edge + 'pinch-zoom';
		setStyle(viewport, 'touch-action', touch);
		setStyle(viewport, '--better-touch', touch);
		setStyle(container, 'will-change', geo.fit ? '' : 'translate');

		if (!keep) {
			write(geo.fit ? 0 : location, rest);
		}

		// Auto height: the height of the tallest slide in view. During a motion or a drag, the slides in view at the selected snap give it,
		// so that a taller slide makes the viewport taller only when it is selected. The CSS transition has the duration and the curve of a motion.
		// With no slide in view, the height comes from the CSS.
		if (options.autoHeight) {
			const height = x ? Math.max(...inView(geo, keep ? geo.snaps[selected].location : location, 0).map((index) => geo.slides[index].cross)) : 0;
			setStyle(viewport, 'height', height > 0 ? height + 'px' : '');
		}

		const chosen = selectedSlide(),
			list = [...new Set(inView(geo, location, options.inViewThreshold).map(original))].sort((a, b) => a - b);

		nodes.forEach((node, index) => setClass(node, cls.selected, original(index) === chosen));

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
		return round(value * scale) / scale * geo.sign;
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
	 * Write the location as the translate of the container, and give it to the "progress" and the "offset" options.
	 *
	 * @param {number} value
	 * @param {boolean} [rest] At the end of a motion: keep the place of the loop slides that are not in view. See place().
	 */
	function write(value, rest) {
		if (written.axis !== geo.axis) {
			nodes.forEach((node) => setStyle(node, 'translate', ''));
			written = { axis: geo.axis, container: 0, slides: [] };
		}

		written.container = screen(value);
		setStyle(container, 'translate', translate(written.container));
		place(value, value, rest);
		track(value, written.slides);
	}

	/**
	 * Write the "progress" and the "offset" options for a location: the CSS variables, or the calls of the callbacks.
	 * The motion engine also calls this function on each frame of a motion on the compositor.
	 *
	 * @param {number} at The location.
	 * @param {number[]} shifts The loop shift of each slide on the screen, in px.
	 */
	function track(at, shifts) {
		if (options.progress === true) {
			root.style.setProperty('--better-progress', progress(at, geo));
		} else if (options.progress) {
			const value = snapPosition(geo.snaps, at, geo.period),
				snap = floor(value);
			whole.progress = progress(at, geo);
			whole.snap = logical(snap) + value - snap;
			options.progress(whole, api);
		}

		if (options.offset) {
			nodes.forEach((node, index) => {
				const box = geo.slides[index],
					size = box.end - box.start,
					// The slide start on the screen, and its distance from its snap position
					start = box.start + geo.sign * (shifts[index] || 0) + at,
					delta = start - alignOffset(geo.align, geo.view, size, index),
					// A hidden slide has no size, and with no gap, it has no offset
					offset = size + geo.gap ? delta / (size + geo.gap) : 0;

				if (options.offset === true) {
					node.style.setProperty('--better-offset', offset);
				} else {
					each.node = node;
					each.index = original(index);
					each.offset = offset;
					each.distance = geo.sign * delta;
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
	 * @param {boolean} [rest] At the end of a motion: keep the place of the slides that are not in view.
	 */
	function place(from, to, rest) {
		const list = geo.period ? placement(geo.slides, from, to, geo.area.size, geo.period, geo.area.start) : [],
			start = geo.area.start - to,
			end = start + geo.area.size,
			lazy = rest && list.length && !options.progress && !options.offset;

		nodes.forEach((node, index) => {
			const value = list.length ? screen(list[index] * geo.period) : 0,
				slide = geo.slides[index],
				shift = list[index] * geo.period;
			// At the end of a motion, a slide that is not in view at its new place keeps its place: the next motion, drag or jump moves it.
			// Then the end of a motion moves no slide, and the browser does not paint the slides again. A slide that is in view
			// at its old place has the same new place, because the loop period is longer than the view and the largest slide.
			// The "progress" and "offset" options give the place of all slides, so they need the full placement.
			if (lazy && (slide.end + shift < start || slide.start + shift > end)) {
				return;
			}
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
	 * Find if the carousel can go one snap in a direction.
	 *
	 * @param {number} direction 1 or -1.
	 * @returns {boolean}
	 */
	function can(direction) {
		return !!geo && !geo.fit && (!!geo.period || (direction > 0 ? selected < geo.snaps.length - 1 : selected > 0));
	}

	/**
	 * Go one snap in a direction, if the carousel can. Before the first measure pass, keep the step in the selected snap.
	 *
	 * @param {number} direction 1 or -1.
	 * @param {boolean} [instant]
	 */
	function advance(direction, instant) {
		// A lazy carousel starts first, so that the step starts from the startSnap option
		if (waiting) {
			reinit();
		}
		if (!geo) {
			go(selected + direction, instant);
		} else if (can(direction)) {
			step(selected, direction, instant);
		}
	}

	/**
	 * Go to the snap after a snap in a direction. In loop mode, the first snap follows the last snap.
	 *
	 * @param {number} index The snap.
	 * @param {number} direction 1, -1, or 0 for the snap itself.
	 * @param {boolean} [instant]
	 */
	function step(index, direction, instant) {
		go(snapIndex(index + direction, geo.snaps.length, geo.period), instant, -1, direction);
	}

	/**
	 * Go to a snap. This is an interaction: it stops the autoplay and the auto scroll, or makes them wait.
	 *
	 * @param {number} index The snap index. physical() and step() give a valid index.
	 * @param {boolean} [instant]
	 * @param {number} [slide] The slide index, for goToSlide().
	 * @param {number} [direction] 1 to go forward, -1 to go back, 0 for the shortest path in a loop.
	 */
	function go(index, instant, slide = -1, direction = 0) {
		if (waiting) {
			reinit();
		}
		events.emit('interact');
		requested = slide;
		if (!geo) {
			selected = index;
			return;
		}

		const target = targetLocation(geo.snaps[index].location, current(), geo.period, direction),
			span = abs(index - selected),
			count = geo.period ? Math.min(span, geo.snaps.length - span) : span;

		move(index, target, instant ? 0 : snapDuration(options.duration, count), EASE);
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
			jump = !duration || geo.fit || abs(target - from) < 0.5;

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

		if (jump) {
			settle();
		}
	}

	/**
	 * Move at a constant speed, as a free motion. With the loop, the motion goes on until it stops. Without the loop, it goes to the end.
	 * A free motion changes the classes only when it stops.
	 *
	 * @param {number} direction 1 for forward, -1 for back.
	 * @param {number} speed px/ms
	 */
	function scroll(direction, speed) {
		const from = halt(),
			to = direction > 0 ? geo.min : geo.max;

		if (geo.period) {
			free = true;
			// Start in the first period, so that the location does not grow after each pause
			location = normalize(from, geo.period);
			motion.loop(location, direction, geo.period / speed, geo, nodes);
		} else if (abs(to - from) > 1) {
			free = true;
			location = to;
			motion.run(from, to, abs(to - from) / speed, [0, 0, 1, 1], events.has('scroll'));
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

	// Select the snap that is nearest to the location
	function pick() {
		if (select(nearestSnap(geo.snaps, location, geo.period))) {
			render(true);
			events.emit('select');
		}
	}

	/**
	 * Write a location during a motion or a drag.
	 *
	 * @param {number} value
	 * @param {boolean} [rest] At the end of a motion: keep the place of the loop slides that are not in view. See place().
	 */
	function frame(value, rest) {
		write(value, rest);
		events.emit('scroll');
	}

	/**
	 * End a motion.
	 */
	function settle() {
		if (free) {
			free = false;
			pick();
		}
		if (geo.period) {
			location = normalize(location, geo.period);
		}
		render(false, true);
		events.emit('settle');
	}

	/**
	 * Stop the motion where it is, and write that location. A free motion also selects the nearest snap.
	 *
	 * @returns {number} The location.
	 */
	function halt() {
		const at = motion.stop();
		if (at !== null) {
			location = at;
			write(at);
			if (free) {
				pick();
			}
		}
		free = false;
		return location;
	}

	/**
	 * Write a location during a drag, and select the snap that is nearest to it.
	 *
	 * @param {number} value
	 */
	function hold(value) {
		location = value;
		frame(value);
		pick();
	}

	/**
	 * The browser scrolls the viewport to a focused element, although its overflow is hidden. Scroll it back.
	 */
	function onScroll() {
		viewport.scrollLeft = viewport.scrollTop = 0;
	}

	/**
	 * Pass a click on a clone to the same element in its slide. A clone is inert, so the click goes to the viewport or the container.
	 * A click after a drag is cancelled, and it does not pass.
	 *
	 * @param {MouseEvent} event
	 */
	function onClick(event) {
		if (event.defaultPrevented || !clones.length || (event.target !== viewport && event.target !== container)) {
			return;
		}

		// Find the element under the pointer in the clones, and the element at the same place in the slide
		clones.forEach((node) => node.inert = false);
		const node = document.elementFromPoint(event.clientX, event.clientY),
			index = clones.findIndex((clone) => clone.contains(node)),
			all = (item) => item ? [item, ...item.querySelectorAll('*')] : [];
		clones.forEach((item) => item.inert = true);

		all(slides[index % slides.length])[all(clones[index]).indexOf(node)]?.dispatchEvent(new MouseEvent('click', event));
	}
}
