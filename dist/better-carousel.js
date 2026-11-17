/*
 * Markup: the wrapper, the slides, the clones, the ARIA attributes, and the helpers that write to the DOM.
 *
 * The helpers that set a value write only when the value changes. restore() removes all that the library added.
 */

/**
 * Add or remove a class.
 *
 * @param {Element} element
 * @param {string} name An empty name does nothing.
 * @param {boolean} on
 */
function setClass(element, name, on) {
	if (name && element.classList.contains(name) !== !!on) {
		element.classList.toggle(name, !!on);
	}
}

/**
 * Set an attribute, or remove it if the value is false.
 *
 * @param {Element} element
 * @param {string} name
 * @param {string|false} value
 */
function setAttribute(element, name, value) {
	if (element.getAttribute(name) !== (value || null)) {
		value ? element.setAttribute(name, value) : element.removeAttribute(name);
	}
}

/**
 * Set an inline style property.
 *
 * @param {HTMLElement} element
 * @param {string} name
 * @param {string} value An empty string removes the property.
 */
function setStyle(element, name, value) {
	if (element.style[name] !== value) {
		element.style[name] = value;
	}
}

/**
 * Remove an empty style attribute that the library left.
 *
 * @param {Element} element
 */
function cleanStyle(element) {
	if (element.getAttribute('style') === '') {
		element.removeAttribute('style');
	}
}

/**
 * Make an element.
 *
 * @param {string} tag
 * @param {string} className
 * @returns {HTMLElement}
 */
function create(tag, className) {
	const element = document.createElement(tag);
	if (className) {
		element.className = className;
	}
	return element;
}

/**
 * Find the element of an option, such as "arrows", "dots" or "sync". true gives the root, and false gives null.
 * The library searches for a selector in the root and then in each parent of the root, so that it finds a heading in the section of the carousel.
 *
 * @param {boolean|string|Element} value The option value.
 * @param {HTMLElement} root
 * @returns {Element|null}
 */
function optionElement(value, root) {
	if (typeof value === 'string') {
		for (let node = root; node; node = node.parentElement) {
			const found = node.querySelector(value);
			if (found) {
				return found;
			}
		}
		return null;
	}
	return value === true ? root : value || null;
}

// The attributes and the classes that the library added: element => names
const marked = new WeakMap(),
	added = new WeakMap();

/**
 * Set an attribute that the page did not set. restore() removes it.
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
 * Add a class that the element does not have. restore() removes it.
 *
 * @param {Element} node
 * @param {string} name An empty name does nothing.
 */
function addClass(node, name) {
	if (name && !node.classList.contains(name)) {
		const list = added.get(node) || new Set();
		node.classList.add(name);
		list.add(name);
		added.set(node, list);
	}
}

// The elements that the library made: the wrapper and the clones
const made = new WeakSet();

// A counter for container ids
let uid = 0;

/**
 * Find or make the root, the viewport and the container of a carousel. Then add their classes and the ARIA attributes of the
 * carousel pattern of the WAI-ARIA Authoring Practices. A new setup after reinit() uses the wrapper that the library made before.
 *
 * @param {HTMLElement} element The container of the slides, or its viewport.
 * @param {object} options
 * @param {object} cls The class names.
 * @returns {{root: HTMLElement, viewport: HTMLElement, container: HTMLElement}}
 */
function build(element, options, cls) {
	let container = options.container ? element.querySelector(options.container) : element;

	if (container.classList.contains(cls.viewport)) {
		container = container.firstElementChild;
	}

	let viewport = container.parentElement,
		root = viewport.parentElement;

	if (!made.has(viewport) && !viewport.classList.contains(cls.viewport) && options.wrapper) {
		root = create('div');
		viewport = create('div');
		made.add(root).add(viewport);
		container.before(root);
		root.append(viewport);
		viewport.append(container);
	}

	addClass(root, cls.root);
	addClass(viewport, cls.viewport);
	addClass(container, cls.container);

	own(root, 'role', 'region');
	own(root, 'aria-roledescription', 'carousel');
	if (!root.hasAttribute('aria-labelledby')) {
		own(root, 'aria-label', options.labels.carousel);
	}
	own(container, 'id', container.id || 'carousel-' + ++uid);
	own(container, 'aria-live', 'polite');

	return { root, viewport, container };
}

/**
 * Remove the classes and the attributes that own() and addClass() added, an empty class attribute, and the wrapper that build() made.
 *
 * @param {HTMLElement} root
 * @param {HTMLElement} viewport
 * @param {HTMLElement} container
 * @param {HTMLElement[]} slides
 * @param {boolean} keep Keep the wrapper for a new setup.
 */
function restore(root, viewport, container, slides, keep) {
	for (const node of [root, viewport, container, ...slides]) {
		marked.get(node)?.forEach((name) => node.removeAttribute(name));
		added.get(node)?.forEach((name) => node.classList.remove(name));
		marked.delete(node);
		added.delete(node);
		if (node.getAttribute('class') === '') {
			node.removeAttribute('class');
		}
	}

	if (!keep && made.has(root)) {
		root.before(container);
		root.remove();
	}
}

// Slides that are a control keep their own role and name
const controls = 'a[href],button,input,select,textarea,[tabindex],[role]';

// The slides that can get the "group" role. An element with its own role, such as an article or a list item, does not permit "group".
const generic = 'div,span,section';

/**
 * Get the slides of a container. The clones that the library made are not slides.
 *
 * @param {HTMLElement} container
 * @param {string} [selector] The "slides" option.
 * @returns {HTMLElement[]}
 */
function readSlides(container, selector) {
	return [...(selector ? container.querySelectorAll(selector) : container.children)].filter((node) => !made.has(node));
}

/**
 * Make the clones: full copies of the slides, which the screen reader and the keyboard do not see.
 *
 * @param {HTMLElement[]} slides
 * @param {number} count The number of copies of all slides.
 * @param {string} className The class of a clone.
 * @returns {HTMLElement[]}
 */
function copySlides(slides, count, className) {
	const list = [];

	for (let copy = 0; copy < count; copy++) {
		for (const node of slides) {
			const clone = node.cloneNode(true);
			for (const item of [clone, ...clone.querySelectorAll('[id]')]) {
				item.removeAttribute('id');
			}
			clone.setAttribute('aria-hidden', 'true');
			clone.inert = true;
			clone.style.translate = '';
			setClass(clone, className, true);
			cleanStyle(clone);
			made.add(clone);
			list.push(clone);
		}
	}

	return list;
}

/**
 * Give each slide the slide role and a name such as "2 of 8". A slide with its own role, such as an article, keeps it.
 *
 * @param {HTMLElement[]} slides
 * @param {string} text The "slide" label, with %d for the slide number and %n for the number of slides.
 */
function labelSlides(slides, text) {
	slides.forEach((node, index) => {
		if (!node.matches(controls) || marked.get(node)?.has('role')) {
			if (node.matches(generic)) {
				own(node, 'role', 'group');
			}
			own(node, 'aria-roledescription', 'slide');
			own(node, 'aria-label', text.replace('%d', index + 1).replace('%n', slides.length));
		}
	});
}

/*
 * Autoplay: the autoplay, the auto scroll, and the play control that they share.
 *
 * Each feature takes the context of a carousel (see carousel.js). It returns nothing if its option is off, or an object with remove().
 */


// The defaults of the "autoplay" option
const autoplayDefaults = { delay: 4000, stopOnInteraction: true, pauseOnHover: false, pauseOnFocus: true, stopOnLastSnap: false, playOnInit: true, instant: false, timer: null };

// The defaults of the "autoScroll" option
const autoScrollDefaults = { speed: 120, direction: 'next', startDelay: 1000, stopOnInteraction: true, pauseOnHover: false, pauseOnFocus: true, playOnInit: true };

/**
 * Merge the value of the "autoplay" or the "autoScroll" option over the defaults of the feature.
 *
 * @param {object} base The defaults.
 * @param {string} key The setting that a number sets: 'delay' or 'speed'.
 * @param {boolean|number|object} value true, a number or an object.
 * @returns {object}
 */
function settings(base, key, value) {
	return { ...base, ...(typeof value === 'number' ? { [key]: value } : value) };
}

/**
 * Watch the reasons to pause: the root is out of view, the tab is hidden, the mouse is on the root, or the keyboard focus is in the root.
 * Make it only while a feature plays, so that a carousel at rest has no listeners on the document.
 *
 * @param {HTMLElement} root
 * @param {{pauseOnHover: boolean, pauseOnFocus: boolean}} options
 * @param {() => void} change Called when the paused state changes.
 * @returns {{paused: () => boolean, remove: () => void}}
 */
function pauser(root, options, change) {
	const reasons = new Set(),
		set = (reason, on) => {
			const before = reasons.size;
			reasons[on ? 'add' : 'delete'](reason);
			if (!before !== !reasons.size) {
				change();
			}
		},
		observer = new IntersectionObserver(([entry]) => set('view', !entry.isIntersecting)),
		listeners = [
			[document, 'visibilitychange', () => set('tab', document.hidden)],
			[root, 'pointerenter', (event) => set('mouse', options.pauseOnHover && event.pointerType === 'mouse')],
			[root, 'pointerleave', () => set('mouse', false)],
			// A mouse click also moves the focus to a button. Only the keyboard focus pauses.
			[root, 'focusin', (event) => set('focus', options.pauseOnFocus && event.target.matches(':focus-visible'))],
			[root, 'focusout', (event) => set('focus', root.contains(event.relatedTarget) && reasons.has('focus'))]
		];

	observer.observe(root);
	listeners.forEach(([node, name, handler]) => node.addEventListener(name, handler));

	return {
		paused: () => reasons.size > 0,
		remove() {
			observer.disconnect();
			listeners.forEach(([node, name, handler]) => node.removeEventListener(name, handler));
		}
	};
}

/**
 * The part that autoplay and auto scroll share: the play and pause button (WCAG 2.2.2), the "playing" class, aria-live, the pause reasons and the events.
 * The control goes into the API of the carousel, and remove() removes it.
 *
 * @param {object} context What the features share. See carousel.js.
 * @param {string} key The API key of the control: 'autoplay' or 'autoScroll'. Its lowercase form is the prefix of the events.
 * @param {object} options The feature options.
 * @param {{play: () => void, stop: () => void, pause: (paused: boolean) => void, events: Array<[string, Function]>}} hooks
 * events: more handlers of carousel events.
 * @returns {{play: () => void, stop: () => void, isPlaying: () => boolean, paused: () => boolean, remove: () => void}}
 */
function controller(context, key, options, hooks) {
	const { api, root, container, cls, emit } = context,
		labels = context.options.labels,
		button = create('button', cls.button + ' ' + cls.playButton);

	let playing = false,
		watch = null,
		// true until the first init
		first = true;

	button.type = 'button';
	button.setAttribute('aria-controls', container.id);
	button.addEventListener('click', () => playing ? control.stop() : control.play());

	function update() {
		setAttribute(button, 'aria-label', playing ? labels.pause : labels.play);
		setClass(root, cls.playing, playing);
		// A screen reader does not read each automatic change
		own(container, 'aria-live', playing ? 'off' : 'polite');
	}

	function show() {
		if (api.isFit()) {
			button.remove();
		} else if (!button.isConnected) {
			root.append(button);
		}
		// Start at the first init, unless the user prefers less motion
		if (first) {
			first = false;
			if (options.playOnInit && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
				control.play();
			}
		}
	}

	const control = {
		play() {
			if (!playing) {
				playing = true;
				watch = pauser(root, options, () => hooks.pause(watch.paused()));
				update();
				hooks.play();
				emit(key.toLowerCase() + ':play');
			}
		},
		stop() {
			if (playing) {
				playing = false;
				watch.remove();
				update();
				hooks.stop();
				emit(key.toLowerCase() + ':stop');
			}
		},
		isPlaying: () => playing,
		paused: () => !playing || watch.paused(),
		remove() {
			control.stop();
			button.remove();
			delete api[key];
		}
	};

	[['init', show], ['reinit', show], ['resize', show], ...hooks.events].forEach(([event, handler]) => context.on(event, handler));
	update();
	api[key] = control;

	return control;
}

/**
 * Go to the next snap after a delay. The timer starts at "settle", so that a slow motion does not make the delay shorter.
 *
 * @param {object} context What the features share. See carousel.js.
 * @returns {object|undefined} The control: play(), stop(), reset(), isPlaying(), remove().
 */
function autoplay(context) {
	if (!context.options.autoplay) {
		return;
	}

	const api = context.api,
		options = settings(autoplayDefaults, 'delay', context.options.autoplay);

	let timer = 0,
		// The function that the "timer" callback returned for the timer
		done = null,
		// true while the autoplay goes to the next slide, so that its own goToSnap() is not an interaction
		self = false;

	// Stop the timer, and call the function that the "timer" callback returned
	function clear() {
		clearTimeout(timer);
		done?.();
		done = null;
	}

	function reset() {
		clear();
		if (!control.paused() && !api.isFit()) {
			// The delay: data-delay on the selected slide, one value for each snap, or one value
			const value = api.slideNodes()[api.selectedSlide()]?.dataset.delay || options.delay,
				delay = +(Array.isArray(value) ? value[api.selectedSnap()] : value);
			timer = setTimeout(next, delay);
			done = options.timer?.(delay, api);
		}
	}

	function next() {
		clear();
		self = true;
		if (api.canGoToNext()) {
			api.goToNext(options.instant);
		} else if (options.stopOnLastSnap) {
			control.stop();
		} else {
			api.goToSnap(0, options.instant);
		}
		self = false;
	}

	// A drag, a wheel step, an arrow, a dot or the keyboard stops the autoplay. With stopOnInteraction: false, the timer starts again at "settle".
	function interact() {
		if (!self) {
			clear();
			if (options.stopOnInteraction) {
				control.stop();
			}
		}
	}

	const control = controller(context, 'autoplay', options, {
		play: reset,
		stop: clear,
		pause: reset,
		events: [['settle', reset], ['interact', interact]]
	});

	control.reset = reset;

	return control;
}

/**
 * Move the slides at a constant speed: with loop, without an end; without loop, to the end. The carousel makes the motion,
 * and this feature starts it, stops it and pauses it.
 *
 * @param {object} context What the features share. See carousel.js.
 * @returns {object|undefined} The control: play(), stop(), isPlaying(), remove().
 */
function autoScroll(context) {
	if (!context.options.autoScroll) {
		return;
	}

	const options = settings(autoScrollDefaults, 'speed', context.options.autoScroll);

	// The start delay
	let timer = 0;

	const control = controller(context, 'autoScroll', options, {
		play: wait,
		stop() {
			wait(-1);
			context.halt();
		},
		pause(paused) {
			if (paused) {
				context.halt();
			} else if (!timer) {
				run();
			}
		},
		events: [
			// A motion stopped: start again after the delay
			['settle', () => control.isPlaying() && wait()],
			// A measure pass stopped the motion: start again now
			['resize', () => control.isPlaying() && !timer && run()],
			// A drag, a wheel step or a goToSnap() stops the auto scroll, or makes it wait until the next "settle"
			['interact', () => {
				if (control.isPlaying()) {
					wait(-1);
					if (options.stopOnInteraction) {
						control.stop();
					}
				}
			}]
		]
	});

	/**
	 * Start the auto scroll after its delay.
	 *
	 * @param {number} [cancel] With -1, only stop the timer.
	 */
	function wait(cancel) {
		clearTimeout(timer);
		timer = cancel ? 0 : setTimeout(run, options.startDelay);
	}

	function run() {
		timer = 0;
		const geo = context.geo();
		if (geo && !geo.fit && !context.dragging() && !control.paused()) {
			context.scroll(options.direction === 'prev' ? -1 : 1, options.speed / 1000);
		}
	}

	return control;
}

/*
 * Loop math: the period, the clones and the place of each slide. This module does not use the DOM.
 *
 * The values and the slides are the same as in geometry.js. In loop mode, each slide is at start + k * period.
 * The library writes k * period as the translate of the slide.
 */

/**
 * Get the number of full copies of the slides that the loop needs. With 0, the slides can loop with no clones:
 * no slide is necessary at two places at the same time.
 *
 * @param {number} length The loop period of the original slides.
 * @param {number} view
 * @param {number} max
 * @returns {number}
 */
function cloneCount(length, view, max) {
	return length > 0 ? Math.max(0, Math.ceil((view + max) / length) - 1) : 0;
}

/**
 * Get the k of each slide for a motion from one location to another. With from = to, it is the placement at rest.
 * The slide center goes into a window of one period. The window has the same center as the part of the content that shows during the motion.
 *
 * @param {Array<{start: number, end: number}>} slides
 * @param {number} from
 * @param {number} to
 * @param {number} view The size of the visible area.
 * @param {number} length The loop period.
 * @param {number} [offset] The start of the visible area, relative to the viewport start.
 * @returns {number[]}
 */
function placement(slides, from, to, view, length, offset = 0) {
	const center = offset + (view - from - to) / 2;
	return slides.map((slide) => Math.round((center - (slide.start + slide.end) / 2) / length) || 0);
}

/**
 * Find if one placement is correct for the full motion. If not, the motion must change the placement during the motion.
 *
 * @param {Array<{start: number, end: number}>} slides
 * @param {number} from
 * @param {number} to
 * @param {number} view
 * @param {number} length
 * @returns {boolean}
 */
function pathFits(slides, from, to, view, length) {
	const path = view + Math.abs(to - from);
	return slides.every((slide) => length >= path + slide.end - slide.start);
}

/**
 * Get the steps of each slide for an auto scroll iteration. The container moves by one period, from `from` to `from - length` (forward)
 * or to `from + length` (back). Each slide moves by one period at one time in the iteration.
 *
 * @param {Array<{start: number, end: number}>} slides
 * @param {number} from
 * @param {number} view
 * @param {number} length
 * @param {number} direction 1 for forward, -1 for back.
 * @param {number} [offset] The start of the visible area, relative to the viewport start.
 * @returns {Array<{k: number, offset: number}>} k at the start of the iteration, and the time of the step, from 0 to 1.
 */
function steps(slides, from, view, length, direction, offset = 0) {
	return slides.map((slide) => {
		const value = (offset + view / 2 - from - (slide.start + slide.end) / 2) / length,
			k = Math.round(value);

		return { k, offset: direction > 0 ? k + 0.5 - value : value - k + 0.5 };
	});
}

/**
 * Put a location into the range (-length, 0].
 *
 * @param {number} location
 * @param {number} length
 * @returns {number}
 */
function normalize(location, length) {
	return location - Math.ceil(location / length) * length;
}

/*
 * Snap math: the snaps, the active slide, the slides in view and the progress. This module does not use the DOM.
 *
 * All values are on the main axis, in px. A slide is { start, end }: its border box at location 0, relative to the viewport start.
 * The location L is the translate of the container. A slide shows at start + L.
 * In loop mode, the period is the length of one copy of the slides. Without loop, it is 0.
 */


/**
 * Keep a value between two limits.
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

/**
 * Get a valid snap index. In loop mode, the index goes around. Without loop, it stops at the first or the last snap.
 *
 * @param {number} index
 * @param {number} count The number of snaps.
 * @param {number} [period]
 * @returns {number}
 */
function snapIndex(index, count, period) {
	return period ? (index % count + count) % count : clamp(index, 0, count - 1);
}

/**
 * Get the offset of a snap from the viewport start.
 *
 * @param {string|Function} align 'start', 'center', 'end' or (viewSize, snapSize, index) => offset.
 * @param {number} view The viewport size.
 * @param {number} size The snap size.
 * @param {number} index The snap index.
 * @returns {number}
 */
function alignOffset(align, view, size, index) {
	if (typeof align === 'function') {
		return align(view, size, index);
	}
	return align === 'center' ? (view - size) / 2 : align === 'end' ? view - size : 0;
}

/**
 * Get the first start and the last end of the slides.
 *
 * @param {Array<{start: number, end: number}>} slides
 * @returns {{start: number, end: number, size: number, max: number}} max is the size of the largest slide.
 */
function bounds(slides) {
	let start = Infinity,
		end = -Infinity,
		max = 0;

	for (const slide of slides) {
		start = Math.min(start, slide.start);
		end = Math.max(end, slide.end);
		max = Math.max(max, slide.end - slide.start);
	}

	return { start, end, size: end - start, max };
}

/**
 * Put the slides that start at the same position (1 px or less) into one column.
 * In a flex row, one column has one slide. In a grid, a column can have more slides.
 *
 * @param {Array<{start: number, end: number}>} slides
 * @returns {Array<{start: number, end: number}>} The columns, sorted by start.
 */
function columns(slides) {
	const order = slides.map((slide, index) => index).sort((a, b) => slides[a].start - slides[b].start || a - b),
		list = [];

	let column;

	for (const index of order) {
		const slide = slides[index];
		if (column && slide.start - column.start <= 1) {
			column.end = Math.max(column.end, slide.end);
		} else {
			column = { start: slide.start, end: slide.end };
			list.push(column);
		}
	}

	return list;
}

/**
 * Put the columns into groups. One group gives one snap.
 *
 * @param {Array<{start: number, end: number}>} list The columns.
 * @param {number} view
 * @param {number|string} count A number of columns, or 'auto' for as many as fit in the viewport.
 * @returns {Array<{start: number, end: number}>}
 */
function groups(list, view, count) {
	const result = [];

	let group,
		size = 0;

	for (const column of list) {
		const fit = count === 'auto' ? group && column.end - group.start <= view + 1 : size < count;
		if (group && fit) {
			group.end = Math.max(group.end, column.end);
			size++;
		} else {
			group = { start: column.start, end: column.end };
			result.push(group);
			size = 1;
		}
	}

	return result;
}

/**
 * Get the distance between two locations. In loop mode, use the shortest distance modulo the period.
 *
 * @param {number} a
 * @param {number} b
 * @param {number} [period] The loop period, or 0 if the loop is off.
 * @returns {number} a - b
 */
function distance(a, b, period) {
	const value = a - b;
	return period ? value - Math.round(value / period) * period : value;
}

/**
 * Compute the snaps.
 *
 * @param {object} args
 * @param {Array<{start: number, end: number}>} args.slides
 * @param {number} args.view The viewport size.
 * @param {string|Function} args.align
 * @param {number|string} args.slidesPerSnap
 * @param {string|boolean} args.containScroll 'trimSnaps', 'keepSnaps' or false.
 * @param {number} [args.period] The loop period, or 0 if the loop is off.
 * @returns {{snaps: Array<{location: number, slide: number}>, min: number, max: number}}
 * Each snap has its location and its active slide. min and max are the limits of the location if the loop is off.
 * With the loop, max is the location of the first snap, where the progress is 0.
 */
function snaps({ slides, view, align, slidesPerSnap, containScroll, period = 0 }) {
	const content = bounds(slides);

	let max = -content.start || 0,
		min = view - content.end,
		list = groups(columns(slides), view, slidesPerSnap).map((group, index) => alignOffset(align, view, group.end - group.start, index) - group.start);

	if (!period) {
		if (containScroll) {
			list = list.map((location) => clamp(location, min, max));
		} else {
			max = Math.max(...list);
			min = Math.min(...list);
		}
	}

	if (period || containScroll !== 'keepSnaps') {
		list = list.filter((location, index) => !index || Math.abs(distance(location, list[index - 1], period)) > 1);
		if (period && list.length > 1 && Math.abs(distance(list[0], list[list.length - 1], period)) <= 1) {
			list.pop();
		}
	}

	const result = list.map((location) => ({ location, slide: activeSlide(slides, location, view, align, period) }));

	// Without the loop, a trimmed snap at an end can get the slide of the snap next to it. Then it takes the nearest slide on its own side.
	const fix = (snap, from, to) => {
		const slide = activeSlide(slides, snap.location, view, align, 0, from, to);
		snap.slide = slide > -1 ? slide : snap.slide;
	};

	if (!period && result.length > 1) {
		const first = result[0],
			last = result[result.length - 1];
		if (first.slide >= result[1].slide) {
			fix(first, 0, result[1].slide);
		}
		if (last.slide <= result[result.length - 2].slide) {
			fix(last, result[result.length - 2].slide + 1, slides.length);
		}
	}

	return {
		snaps: result,
		min,
		max: period ? list[0] : max
	};
}

/**
 * Find the slide whose anchor is nearest to the align point at a location.
 * The anchor is the start for 'start', the center for 'center' and the end for 'end'.
 * If two slides have the same distance, the lower index wins.
 *
 * @param {Array<{start: number, end: number}>} slides
 * @param {number} location
 * @param {number} view
 * @param {string|Function} align
 * @param {number} [period]
 * @param {number} [from] The first slide to look at.
 * @param {number} [to] The slide after the last slide to look at.
 * @returns {number} The slide index, or -1 if the range is empty.
 */
function activeSlide(slides, location, view, align, period, from = 0, to = slides.length) {
	let best = -1,
		gap = Infinity;

	slides.forEach((slide, index) => {
		const value = Math.abs(distance(slide.start + location, alignOffset(align, view, slide.end - slide.start, index), period));
		if (index >= from && index < to && value < gap - 0.5) {
			gap = value;
			best = index;
		}
	});

	return best;
}

/**
 * Find the snap of a slide: the snap whose active slide it is, or the snap nearest to the raw location of the slide.
 *
 * @param {Array<{location: number, slide: number}>} list The snaps.
 * @param {Array<{start: number, end: number}>} slides
 * @param {number} index The slide index.
 * @param {number} view
 * @param {string|Function} align
 * @param {number} [period]
 * @returns {number} The snap index.
 */
function snapOfSlide(list, slides, index, view, align, period) {
	const found = list.findIndex((snap) => snap.slide === index),
		slide = slides[index];

	if (found > -1 || !slide) {
		return Math.max(found, 0);
	}

	return nearestSnap(list, alignOffset(align, view, slide.end - slide.start, index) - slide.start, period);
}

/**
 * Find the snap nearest to a location.
 *
 * @param {Array<{location: number}>} list The snaps.
 * @param {number} location
 * @param {number} [period]
 * @returns {number} The snap index.
 */
function nearestSnap(list, location, period) {
	let best = 0,
		gap = Infinity;

	list.forEach((snap, index) => {
		const value = Math.abs(distance(snap.location, location, period));
		if (value < gap) {
			gap = value;
			best = index;
		}
	});

	return best;
}

/**
 * Get the location of a snap that is nearest to the current location. In loop mode, a snap has a location in each period.
 *
 * @param {number} target The snap location.
 * @param {number} location The current location.
 * @param {number} [period]
 * @param {number} [direction] 1 to go forward (a smaller location), -1 to go back, 0 for the shortest path.
 * @returns {number}
 */
function targetLocation(target, location, period, direction = 0) {
	if (!period) {
		return target;
	}

	if (direction > 0) {
		return target + (Math.ceil((location - 0.5 - target) / period) - 1) * period;
	}

	if (direction < 0) {
		return target + (Math.floor((location + 0.5 - target) / period) + 1) * period;
	}

	return location + distance(target, location, period);
}

/**
 * Get the progress of a location, from 0 to 1.
 *
 * @param {number} location
 * @param {{min: number, max: number, period: number}} limits The limits of the location and the loop period. With the loop, max is the location of the first snap.
 * @returns {number}
 */
function progress(location, { min, max, period }) {
	if (period) {
		const value = (max - location) / period;
		return value - Math.floor(value);
	}
	return max > min ? clamp((max - location) / (max - min), 0, 1) : 0;
}

/**
 * Find the slides that show at a location.
 *
 * @param {Array<{start: number, end: number}>} slides
 * @param {number} location
 * @param {number} view
 * @param {number} threshold The part of a slide that must show, from 0 to 1. With 0, any part is enough.
 * @param {number} [period]
 * @returns {number[]} The slide indexes.
 */
function inView(slides, location, view, threshold, period) {
	const result = [];

	slides.forEach((slide, index) => {
		const size = slide.end - slide.start,
			start = period ? distance(slide.start + location + size / 2, view / 2, period) + view / 2 - size / 2 : slide.start + location,
			visible = Math.min(start + size, view) - Math.max(start, 0);

		if (visible > 0 && visible >= threshold * size - 0.5) {
			result.push(index);
		}
	});

	return result;
}

/**
 * Get the position of a location between the snaps, as a fractional snap index: 2.4 is between snap 2 and snap 3.
 * In loop mode, a value after the last snap goes to the first snap again.
 *
 * @param {Array<{location: number}>} list The snaps.
 * @param {number} location
 * @param {number} [period]
 * @returns {number}
 */
function snapPosition(list, location, period) {
	const last = list.length - 1,
		first = list[0].location,
		at = period ? first - ((first - location) % period + period) % period : clamp(location, list[last].location, first);

	let index = 0;

	while (index < last && list[index + 1].location >= at) {
		index++;
	}

	const from = list[index].location,
		to = index < last ? list[index + 1].location : first - period;

	return index + (to < from ? (from - at) / (from - to) : 0);
}

/**
 * Compute the geometry of a carousel from the layout reads: the loop period, the snaps, and the logical snaps.
 * With clones, a logical snap is a snap whose active slide is an original slide.
 *
 * @param {object} layout The result of readLayout().
 * @param {{view: number, slides: Array<{start: number, end: number}>, gap: number}} rects The result of readRects(). The slides after the first count slides are clones.
 * @param {{start: number, size: number}} area The result of visibleArea().
 * @param {number} count The number of original slides.
 * @param {object} options The options of the carousel.
 * @returns {object} The geometry. If the carousel needs a different number of clones, only { copies }: the number of copies of all slides.
 * map gives the logical snap of each snap.
 */
function compute(layout, rects, area, count, options) {
	const content = bounds(rects.slides.slice(0, count)),
		fit = content.size <= rects.view + 1 && !(options.autoScroll && options.loop),
		loop = options.loop && !fit && count,
		// The loop period: the distance from the first slide start to the same point in the next copy of the slides
		period = loop ? bounds(rects.slides).size + rects.gap : 0,
		copies = loop && options.clones ? cloneCount(content.size + rects.gap, area.size, content.max) : 0;

	if (copies * count !== rects.slides.length - count) {
		return { copies };
	}

	const geo = { ...layout, ...rects, area, fit, count, period, min: 0, max: 0 };

	if (fit) {
		geo.snaps = [{ location: 0, slide: activeSlide(rects.slides, 0, rects.view, layout.align) }];
	} else {
		Object.assign(geo, snaps({ ...rects, align: layout.align, slidesPerSnap: options.slidesPerSnap, containScroll: options.containScroll, period }));
	}

	const list = geo.snaps.map((snap, index) => index).filter((index) => !copies || geo.snaps[index].slide < count);

	geo.logical = list;
	geo.map = geo.snaps.map((snap, index) => copies ? Math.max(0, list.findIndex((item) => geo.snaps[item].slide % count === snap.slide % count)) : index);

	return geo;
}

/**
 * Find the snap of a logical snap that is nearest to a location. With clones, a logical snap has more than one snap.
 *
 * @param {{snaps: Array<{location: number}>, map: number[], period: number}} geo The result of compute().
 * @param {number} index The logical snap.
 * @param {number} location
 * @returns {number} The snap index.
 */
function physicalSnap(geo, index, location) {
	let best = -1,
		gap = Infinity;

	geo.snaps.forEach((snap, item) => {
		const value = Math.abs(distance(snap.location, location, geo.period));
		if (geo.map[item] === index && value < gap) {
			gap = value;
			best = item;
		}
	});

	return best < 0 ? clamp(index, 0, geo.snaps.length - 1) : best;
}

/*
 * Layout: the layout reads, and the observers that all carousels share.
 *
 * The reads run in the ResizeObserver callback, when the layout is clean.
 */

/**
 * Read the axis, the alignment, the direction and the gap from the computed style of the container.
 *
 * @param {HTMLElement} container
 * @param {object} options
 * @returns {{axis: string, align: string|Function, rtl: boolean, sign: number, gap: number}} sign is -1 for a right-to-left carousel, else 1.
 */
function readLayout(container, options) {
	const style = getComputedStyle(container),
		display = style.display,
		content = style.justifyContent;

	let axis = options.axis;

	if (axis === 'auto') {
		axis = 'x';
		if (display.includes('grid')) {
			axis = style.gridAutoFlow.startsWith('column') ? 'x' : 'y';
		} else if (display.includes('flex') && style.flexDirection.startsWith('column') && style.flexWrap === 'nowrap') {
			axis = 'y';
		}
	}

	let align = options.align;

	if (align === 'auto') {
		align = content === 'center' ? 'center' : content === 'flex-end' || content === 'end' || (axis === 'x' && content === 'right') ? 'end' : 'start';
	}

	const rtl = axis === 'x' && (options.dir === 'auto' ? style.direction === 'rtl' : options.dir === 'rtl');

	return {
		axis,
		align,
		rtl,
		sign: rtl ? -1 : 1,
		gap: parseFloat(axis === 'x' ? style.columnGap : style.rowGap) || 0
	};
}

/**
 * Read the slide boxes on the main axis, relative to the viewport start at location 0.
 *
 * @param {HTMLElement} viewport
 * @param {HTMLElement[]} nodes All slides, clones included.
 * @param {object} layout The result of readLayout().
 * @param {{axis: string, container: number, slides: number[]}} written The translate values that the library wrote, in px on the screen.
 * @returns {{view: number, slides: Array<{start: number, end: number, cross: number}>, gap: number}}
 * gap is the loop gap: the space between the last slide and the next copy of the first slide.
 */
function readRects(viewport, nodes, layout, written) {
	const box = viewport.getBoundingClientRect(),
		x = layout.axis === 'x',
		sign = layout.sign,
		known = written.axis === layout.axis,
		shift = known ? written.container : 0;

	let first = 0,
		last = 0;

	const slides = nodes.map((node, index) => {
		const rect = node.getBoundingClientRect(),
			offset = sign * (shift + (known && written.slides[index] || 0)),
			start = (x ? (layout.rtl ? box.right - rect.right : rect.left - box.left) : rect.top - box.top) - offset,
			size = x ? rect.width : rect.height;

		return { start, end: start + size, cross: x ? rect.height : rect.width };
	});

	slides.forEach((slide, index) => {
		if (slide.start < slides[first].start) {
			first = index;
		}
		if (slide.end > slides[last].end) {
			last = index;
		}
	});

	let gap = layout.gap;

	if (slides.length) {
		const side = x ? (layout.rtl ? ['Right', 'Left'] : ['Left', 'Right']) : ['Top', 'Bottom'];
		gap += (parseFloat(getComputedStyle(nodes[first])['margin' + side[0]]) || 0) + (parseFloat(getComputedStyle(nodes[last])['margin' + side[1]]) || 0);
	}

	return {
		view: x ? box.width : box.height,
		slides,
		gap
	};
}

/**
 * Get the window size on the main axis.
 *
 * @param {string} axis 'x' or 'y'.
 * @returns {number}
 */
function windowSize(axis) {
	return axis === 'x' ? document.documentElement.clientWidth : innerHeight;
}

/**
 * Get the part of the main axis where the loop must show slides, relative to the viewport start.
 * It is the viewport. With clones: 'fill', it is the window, so that the slides fill it when the viewport overflow shows.
 *
 * @param {HTMLElement} viewport
 * @param {{axis: string, rtl: boolean}} layout
 * @param {number} view The viewport size.
 * @param {number} [size] The window size on the main axis, for clones: 'fill'. Without it, the area is the viewport.
 * @returns {{start: number, size: number}}
 */
function visibleArea(viewport, layout, view, size) {
	if (!size) {
		return { start: 0, size: view };
	}

	const box = viewport.getBoundingClientRect(),
		before = Math.max(0, Math.round(layout.axis === 'x' ? (layout.rtl ? size - box.right : box.left) : box.top));

	return { start: -before, size: before + Math.max(view, Math.round(size - before)) };
}

// One ResizeObserver for all carousels. Each callback first reads the layout of all carousels, then writes. In this way, the reads of one carousel do not
// come after the writes of another carousel, and the browser does one layout for all of them.
const owners = new WeakMap();

let resizer;

/**
 * Watch the size of elements. The ResizeObserver callback calls owner.read() for each owner, and then owner.write() for each owner whose read() returned true.
 * An entry for which owner.skip() returns true does not count.
 *
 * @param {Element[]} nodes
 * @param {{read: () => boolean, write: () => void, skip: (entry: ResizeObserverEntry) => boolean}} [owner] Without an owner, stop the watch.
 */
function observeSize(nodes, owner) {
	resizer ||= new ResizeObserver((entries) => {
		const list = new Set(entries.filter((entry) => !owners.get(entry.target)?.skip(entry)).map((entry) => owners.get(entry.target)));
		[...list].filter((item) => item && item.read()).forEach((item) => item.write());
	});

	for (const node of nodes) {
		if (owner) {
			owners.set(node, owner);
			resizer.observe(node);
		} else {
			owners.delete(node);
			resizer.unobserve(node);
		}
	}
}

// The lazy option: one IntersectionObserver for each margin, the callback of each element that waits, and the boxes that readBoxes() read
const watchers = new Map(),
	waiters = new WeakMap(),
	boxes = new WeakMap();

/**
 * Read the boxes of elements before a carousel writes to the DOM. Then the reads of all carousels cause one layout, not one for each carousel.
 * waitNear() uses each box one time.
 *
 * @param {Element[]} elements
 */
function readBoxes(elements) {
	elements.forEach((element) => boxes.set(element, element.getBoundingClientRect()));
}

/**
 * Wait until an element comes near the screen.
 *
 * @param {Element} node
 * @param {true|number} lazy The "lazy" option: true for one screen height, or a distance in px.
 * @param {Function} callback
 * @returns {Function|null} A function that stops the wait, or null if the element is near the screen now.
 */
function waitNear(node, lazy, callback) {
	const near = lazy === true ? innerHeight : lazy,
		rect = boxes.get(node) || node.getBoundingClientRect(),
		margin = lazy === true ? '100%' : lazy + 'px';

	boxes.delete(node);

	if (rect.height && rect.bottom >= -near && rect.top <= innerHeight + near) {
		return null;
	}

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

/*
 * Motion: the easing, the duration of a goToSnap() motion, and the motion engine.
 */


// The easing of a goToSnap() motion
const EASE = [0.25, 1, 0.5, 1];

// The easing of a glide after a free drag
const GLIDE = [0.2, 0.6, 0.35, 1];

/**
 * Make a cubic Bézier easing function, the same as the CSS cubic-bezier().
 *
 * @param {number[]} curve [x1, y1, x2, y2]
 * @returns {(t: number) => number}
 */
function bezier([x1, y1, x2, y2]) {
	const axis = (a, b, t) => ((1 + 3 * a - 3 * b) * t + 3 * b - 6 * a) * t * t + 3 * a * t;

	return (x) => {
		if (x <= 0 || x >= 1) {
			return x <= 0 ? 0 : 1;
		}

		let t = x;

		// Newton steps, then bisection if the slope is too small
		for (let i = 0; i < 6; i++) {
			const error = axis(x1, x2, t) - x,
				slope = 3 * (1 + 3 * x1 - 3 * x2) * t * t + 2 * (3 * x2 - 6 * x1) * t + 3 * x1;
			if (Math.abs(error) < 1e-5) {
				return axis(y1, y2, t);
			}
			if (Math.abs(slope) < 1e-6) {
				break;
			}
			t -= error / slope;
		}

		let low = 0,
			high = 1;

		t = x;

		while (high - low > 1e-5) {
			if (axis(x1, x2, t) < x) {
				low = t;
			} else {
				high = t;
			}
			t = (low + high) / 2;
		}

		return axis(y1, y2, t);
	};
}

/**
 * Get the duration of a goToSnap() motion.
 *
 * @param {number} duration The duration for one snap, in ms.
 * @param {number} count The number of snaps to move.
 * @returns {number}
 */
function snapDuration(duration, count) {
	return count > 1 ? Math.min(2 * duration, duration * (1 + Math.log2(count))) : duration;
}

/**
 * Make the motion engine of a carousel. A motion runs as a Web Animations API animation of the container translate, on the compositor.
 * With raf set, it runs as a requestAnimationFrame loop instead, which calls frame() on each frame.
 * A loop motion moves the container and the slides of a loop carousel at a constant speed, on the compositor, until it stops.
 *
 * @param {HTMLElement} element The container.
 * @param {(location: number) => string} css Get the CSS translate value of a location.
 * @param {(location: number) => void} frame Write a location.
 * @param {() => void} done Called when a motion ends. A loop motion does not end.
 * @param {((location: number) => void)|null} [tick] Called on each frame of a motion on the compositor, because such a motion runs no script.
 * @returns {{run: Function, loop: Function, retarget: Function, stop: Function, current: Function, shifts: Function}}
 */
function animator(element, css, frame, done, tick) {
	let state = null;

	const time = () => state.animations ? state.animations[0].currentTime || 0 : performance.now() - state.start,
		current = () => state && state.from + (state.to - state.from) * state.ease(time() / state.duration);

	// The frame loop: a requestAnimationFrame motion writes the location, and a motion on the compositor calls tick().
	// The next frame starts before the callback, so that a callback that stops the motion also stops the loop.
	function step() {
		if (!state.animations && time() >= state.duration) {
			return finish();
		}
		state.raf = requestAnimationFrame(step);
		(state.animations ? tick : frame)(current());
	}

	function finish() {
		const to = state.to;
		stop();
		frame(to);
		done();
	}

	/**
	 * Stop the motion.
	 *
	 * @returns {number|null} The location at the stop, or null if no motion runs.
	 */
	function stop() {
		const at = current();
		if (state) {
			state.animations?.forEach((animation) => animation.cancel());
			cancelAnimationFrame(state.raf);
			state = null;
		}
		return at;
	}

	function animate(at) {
		const animation = element.animate([{ translate: css(state.from) }, { translate: css(state.to) }], { duration: state.duration, easing: 'cubic-bezier(' + state.curve + ')', fill: 'forwards' });
		animation.currentTime = at;
		animation.onfinish = finish;
		state.animations = [animation];
	}

	/**
	 * Start a motion. It stops the motion that runs.
	 *
	 * @param {object} next The state of the new motion. script: true runs it as a requestAnimationFrame loop.
	 * @param {HTMLElement[]} [nodes] The slides of a loop motion.
	 */
	function start(next, nodes) {
		stop();
		state = next;
		if (next.list) {
			const timing = { duration: next.duration, iterations: Infinity },
				begin = document.timeline.currentTime,
				{ from, to, length, direction } = next;
			next.animations = [
				element.animate([{ translate: css(from) }, { translate: css(to) }], timing),
				...nodes.map((node, index) => {
					const { k, offset } = next.list[index],
						before = css(k * length),
						after = css((k + direction) * length);
					return node.animate([{ translate: before }, { translate: before, offset }, { translate: after, offset }, { translate: after }], timing);
				})
			];
			next.animations.forEach((animation) => animation.startTime = begin);
		} else if (next.script) {
			next.start = performance.now();
		} else {
			animate(0);
		}
		if (next.script || tick) {
			next.raf = requestAnimationFrame(step);
		}
	}

	return {
		/**
		 * Start a motion to a location.
		 *
		 * @param {number} from
		 * @param {number} to
		 * @param {number} duration ms
		 * @param {number[]} curve The cubic Bézier easing.
		 * @param {boolean} raf Use a requestAnimationFrame loop.
		 */
		run: (from, to, duration, curve, raf) => start({ from, to, duration, curve, script: raf, ease: bezier(curve) }),

		/**
		 * Start a loop motion. The container moves by one period in each iteration, and each slide moves by one period
		 * at the time when it leaves the visible area.
		 *
		 * @param {number} from
		 * @param {number} direction 1 for forward, -1 for back.
		 * @param {number} duration The time of one iteration, in ms.
		 * @param {{slides: Array<{start: number, end: number}>, area: {start: number, size: number}, period: number}} geo
		 * @param {HTMLElement[]} nodes All slides, clones included.
		 */
		loop: (from, direction, duration, geo, nodes) => start({
			from,
			to: from - direction * geo.period,
			duration,
			direction,
			length: geo.period,
			list: steps(geo.slides, from, geo.area.size, geo.period, direction, geo.area.start),
			// The time in the iteration, from 0 to 1
			ease: (value) => value % 1
		}, nodes),

		/**
		 * Change the end of the motion that runs. The start, the time and the easing stay, so the motion does not jump.
		 *
		 * @param {number} to
		 * @returns {boolean} false if no motion runs, or if a loop motion runs: it has no end.
		 */
		retarget(to) {
			if (!state || state.list) {
				return false;
			}
			if (to !== state.to) {
				state.to = to;
				if (state.animations) {
					const at = time();
					state.animations[0].cancel();
					animate(at);
				}
			}
			return true;
		},

		stop,
		current,

		/**
		 * Get the translate values of the slides during a loop motion.
		 *
		 * @param {number} sign -1 for a right-to-left carousel.
		 * @returns {number[]|null} The values in px, or null if no loop motion runs.
		 */
		shifts(sign) {
			if (!state?.list) {
				return null;
			}
			const phase = time() / state.duration % 1;
			return state.list.map(({ k, offset }) => sign * (phase >= offset ? k + state.direction : k) * state.length);
		}
	};
}

/*
 * Options: the defaults, the class names, the merge of the option sources, and the breakpoints.
 */

const defaults = {
	axis: 'auto',
	align: 'auto',
	dir: 'auto',
	loop: false,
	dragFree: false,
	dragFriction: 1,
	containScroll: 'trimSnaps',
	slidesPerSnap: 1,
	skipSnaps: true,
	dragThreshold: 10,
	duration: 400,
	startSnap: 0,
	lazy: false,
	drag: true,
	wheel: true,
	resize: true,
	slideChanges: true,
	focus: true,
	inViewThreshold: 0,
	active: true,
	breakpoints: {},
	container: null,
	slides: null,
	wrapper: true,
	arrows: true,
	dots: true,
	labels: { carousel: 'Carousel', slide: '%d of %n', prev: 'Previous slide', next: 'Next slide', dot: 'Go to slide %d', play: 'Start the slide show', pause: 'Stop the slide show' },
	classes: null,
	state: '',
	sync: null,
	clones: 'auto',
	autoplay: false,
	autoScroll: false,
	autoHeight: false,
	progress: false,
	offset: false
};

// The class names of a prefix. The root class is the prefix, such as "better" or "embla".
const names = (prefix) => ({
	root: prefix,
	viewport: prefix + '_viewport',
	container: prefix + '_container',
	fit: prefix + '_fit',
	horizontal: prefix + '_horizontal',
	vertical: prefix + '_vertical',
	autoHeight: prefix + '_auto_height',
	button: prefix + '_button',
	prevButton: prefix + '_prev',
	nextButton: prefix + '_next',
	dots: prefix + '_dots',
	dot: prefix + '_dot',
	playButton: prefix + '_play',
	clone: 'clone',
	selected: 'selected',
	inView: '',
	dragging: 'dragging',
	playing: 'playing',
	first: 'first',
	prev: 'prev',
	current: 'current',
	next: 'next',
	last: 'last'
});

// The state classes get the "state" prefix
const states = ['selected', 'inView', 'dragging', 'playing', 'first', 'prev', 'current', 'next', 'last'];

/**
 * Get the class names from the "classes" and "state" options.
 *
 * @param {string|object|null} classes A prefix, such as 'embla', or an object with the names to change. The default prefix is 'better'.
 * The object can have a "prefix" key for the names that it does not change: { prefix: 'embla', selected: 'snapped' }.
 * @param {string} state The prefix of the state classes.
 * @returns {object}
 */
function classNames(classes, state) {
	const result = typeof classes === 'string' ? names(classes) : { ...names(classes?.prefix || 'better'), ...classes };

	for (const key of states) {
		if (result[key]) {
			result[key] = state + result[key];
		}
	}

	return result;
}

/**
 * Merge the option sources. A later source wins. Objects such as "labels" merge one level deep.
 *
 * @param {...object} sources
 * @returns {object}
 */
function merge(...sources) {
	const result = {};

	for (const source of sources) {
		for (const key in source) {
			const value = source[key],
				old = result[key];
			result[key] = value && old && typeof value === 'object' && typeof old === 'object' && value.constructor === Object && old.constructor === Object ? { ...old, ...value } : value;
		}
	}

	return result;
}

/**
 * Get the options of an element: the library defaults, then the sources, then the JSON options of the data-carousel attribute.
 *
 * @param {HTMLElement} element
 * @param {...object} sources The site defaults and the options of the call.
 * @returns {object}
 */
function resolve(element, ...sources) {
	let data = {};
	try {
		data = JSON.parse(element.dataset.carousel || '{}');
	} catch {
		// The library ignores an attribute that is not valid JSON
	}
	return merge(defaults, ...sources, data);
}

/**
 * Merge the options of the breakpoints whose media query matches, and watch the media queries.
 *
 * @param {object} base The options, with the "breakpoints" option.
 * @param {() => void} change Called when a media query starts or stops to match.
 * @returns {{options: object, remove: () => void}} The options, and a function that stops the watch.
 */
function breakpoints(base, change) {
	// Keep the key of each query: the browser can write MediaQueryList.media in a different form.
	const list = Object.entries(base.breakpoints || {}).map(([query, value]) => [matchMedia(query), value]);

	list.forEach(([query]) => query.addEventListener('change', change));

	return {
		options: merge(base, ...list.filter(([query]) => query.matches).map(([, value]) => value)),
		remove: () => list.forEach(([query]) => query.removeEventListener('change', change))
	};
}

/*
 * Carousel: its state, its API, the setup, the measure pass, the render and the motion.
 *
 * The features get their part of the carousel through the context object. Each feature is a function that takes the context.
 * It returns nothing if its option is off, or an object with remove(). remove() removes all that the feature added.
 */


// The instance of each root, viewport and container
const registry = new WeakMap();

/**
 * Get the carousel of a root, a viewport or a container.
 *
 * @param {Element} element
 * @returns {object|undefined}
 */
const find = (element) => registry.get(element);

/**
 * Make an event emitter. A handler gets (api, name), as in Embla.
 * The handlers of the features run before the handlers of the page, and clear() removes them.
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
		listen: (name, handler) => add(own, name, handler),
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
function carousel(element, userOptions, defaults, features) {
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
		// The features that are on
		parts = [];

	// The observers and the measure state
	let observed = [],
		mutationObserver,
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
		goToNext: (instant) => api.canGoToNext() && step(selected, 1, instant),
		goToPrev: (instant) => api.canGoToPrev() && step(selected, -1, instant),
		goToSlide: (index, instant) => go(physical(api.snapOfSlide(index)), instant, index),
		canGoToNext: () => !!geo && !geo.fit && (!!geo.period || selected < geo.snaps.length - 1),
		canGoToPrev: () => !!geo && !geo.fit && (!!geo.period || selected > 0),
		selectedSnap: () => logical(selected),
		previousSnap: () => logical(previous),
		selectedSlide,
		snapOfSlide: (index) => geo ? logical(snapOfSlide(geo.snaps, geo.slides, index, geo.view, geo.align, geo.period)) : index,
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
			teardown(false);
			events.emit('destroy');
		}
	};

	const events = emitter(api),
		owner = { read: measure, write: measured, skip: heightOnly },
		// The states that the "progress" and the "offset" callbacks get. Each call gets the same object, so a frame makes no garbage.
		whole = { progress: 0, snap: 0 },
		each = { node: null, index: 0, offset: 0, distance: 0, size: 0, visible: 0 },
		/**
		 * What the features share: the API, the events, and the state and the actions of the carousel.
		 * setup() adds root, viewport, container, cls and options.
		 */
		context = {
			api,
			emit: events.emit,
			// Listen to an event until the teardown
			on: events.listen,

			// The state
			geo: () => geo,
			nodes: () => nodes,
			selected: () => selected,
			dragging: () => dragging,
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

	// The options of the first setup. The lazy option: a carousel that is not near the screen waits. A carousel near the screen starts now:
	// a start after the first paint adds the arrows and the dots in view, and this moves the page (CLS).
	let resolved = resolve(element, defaults, userOptions),
		waiting = resolved.lazy ? waitNear(element, resolved.lazy, reinit) : null;

	if (waiting) {
		registry.set(element, api);
	} else {
		setup();
	}

	return api;

	/**
	 * Read the options, add the markup, start the features and the observers. The first ResizeObserver callback measures the layout.
	 */
	function setup() {
		media = breakpoints(resolved || resolve(element, defaults, userOptions), () => reinit());
		resolved = null;
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
		selected = options.startSnap;

		observe(true);

		Object.assign(context, { root, viewport, container, cls, options });

		parts = features.map((feature) => feature(context)).filter(Boolean);
		motion = animator(container, css, frame, settle, (options.progress || options.offset) && ((at) => track(at, motion.shifts(geo.sign) || written.slides)));

		if (options.autoHeight) {
			addClass(root, cls.autoHeight);
		}

		viewport.addEventListener('scroll', onScroll);
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
		events.clear();
		parts = [];
		followed = -1;
		dragging = free = false;
		setClones(0);
		viewport.removeEventListener('scroll', onScroll);
		removeEventListener('resize', onWindow);

		for (const node of nodes) {
			setStyle(node, 'translate', '');
			node.style.removeProperty('--better-offset');
			setClass(node, cls.selected, false);
			setClass(node, cls.inView, false);
			cleanStyle(node);
		}

		setStyle(container, 'translate', '');
		setStyle(container, 'willChange', '');
		setStyle(viewport, 'touchAction', '');
		setStyle(viewport, 'height', '');
		root.style.removeProperty('--better-progress');

		for (const name of ['horizontal', 'vertical', 'fit', 'dragging']) {
			setClass(root, cls[name], false);
		}

		for (const node of [root, viewport, container]) {
			cleanStyle(node);
			registry.delete(node);
		}

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
	 * Merge new options and set up the carousel again. The selected slide stays.
	 *
	 * @param {object} [newOptions]
	 */
	function reinit(newOptions) {
		if (newOptions) {
			userOptions = merge(userOptions, newOptions);
			resolved = null;
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
			layout = readLayout(container, options),
			// The translate values that show now: the written values, or the values of a motion
			rects = readRects(viewport, nodes, layout, at === null ? written : { axis: written.axis, container: sign * at, slides: motion.shifts(sign) || written.slides });

		// With clones: 'fill', the loop fills the window
		lastWindow = options.loop && options.clones === 'fill' ? windowSize(layout.axis) : 0;

		const area = visibleArea(viewport, layout, rects.view, lastWindow),
			values = [layout.axis, layout.rtl, typeof layout.align === 'string' && layout.align, rects.view, rects.gap, area.start, area.size, ...rects.slides.flatMap((slide) => [slide.start, slide.end, slide.cross])];

		// A change of less than 0.5 px is not a change. During a motion, the rects have small errors, because the browser and bezier() round the easing differently.
		if (ready && values.length === signature.length && values.every((value, index) => value === signature[index] || Math.abs(value - signature[index]) < 0.5)) {
			return false;
		}

		signature = values;

		const keep = ready ? selectedSlide() : requested,
			next = compute(layout, rects, area, slides.length, options);

		if (!next.snaps) {
			pending = next.copies;
			return true;
		}

		geo = next;

		const total = geo.snaps.length;

		// Before the first measure pass, selected is the logical snap of the startSnap option or of goToSnap()
		selected = keep >= 0 ? physical(api.snapOfSlide(keep)) : Math.min(total - 1, ready ? selected : physical(selected));
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
	 */
	function render(keep) {
		const x = geo.axis === 'x';

		setClass(root, cls.horizontal, x);
		setClass(root, cls.vertical, !x);
		setClass(root, cls.fit, geo.fit);
		setStyle(viewport, 'touchAction', geo.fit ? '' : x ? 'pan-y pinch-zoom' : 'pan-x pinch-zoom');
		setStyle(container, 'willChange', geo.fit ? '' : 'translate');

		if (!keep) {
			write(geo.fit ? 0 : location);
		}

		// Auto height: the height of the tallest slide in view at the target location
		if (options.autoHeight) {
			setStyle(viewport, 'height', x ? Math.max(...inView(geo.slides, location, geo.view, 0, geo.period).map((index) => geo.slides[index].cross)) + 'px' : '');
		}

		const chosen = selectedSlide(),
			list = [...new Set(inView(geo.slides, location, geo.view, options.inViewThreshold, geo.period).map(original))].sort((a, b) => a - b);

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
		return Math.round(value * scale) / scale * geo.sign;
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
	 */
	function write(value) {
		if (written.axis !== geo.axis) {
			nodes.forEach((node) => setStyle(node, 'translate', ''));
			written = { axis: geo.axis, container: 0, slides: [] };
		}

		written.container = screen(value);
		setStyle(container, 'translate', translate(written.container));
		place(value, value);
		if (options.progress || options.offset) {
			track(value, written.slides);
		}
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
				snap = Math.floor(value);
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
					offset = delta / (size + geo.gap);

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
			span = Math.abs(index - selected),
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
		} else if (Math.abs(to - from) > 1) {
			free = true;
			location = to;
			motion.run(from, to, Math.abs(to - from) / speed, [0, 0, 1, 1], events.has('scroll'));
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
	 */
	function frame(value) {
		write(value);
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
		render();
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
	 * Write a location without a motion, and select the snap that is nearest to it.
	 *
	 * @param {number} value
	 * @param {boolean} [moving] Emit "scroll", as during a motion.
	 */
	function hold(value, moving) {
		location = value;
		(moving ? frame : write)(value);
		pick();
	}

	/**
	 * The browser scrolls the viewport to a focused element, although its overflow is hidden. Scroll it back.
	 */
	function onScroll() {
		viewport.scrollLeft = viewport.scrollTop = 0;
	}
}

/*
 * Input: the pointer drag, the mouse wheel, the keyboard focus, and the target of the motion after a drag.
 *
 * Each feature takes the context of a carousel (see carousel.js). It returns nothing if its option is off, or an object with remove().
 */


// The targets that keep their own pointer behavior
const fields = 'input,textarea,select,[contenteditable]';

// The duration of the motion for one wheel event, in ms
const WHEEL = 180;

// The time constant of the glide, in ms: the glide distance is velocity * MOMENTUM
const MOMENTUM = 325;

/**
 * Get the duration of a motion after a release, so that the motion starts at the release velocity.
 *
 * @param {number} path The distance of the motion: target - location.
 * @param {number} velocity The release velocity, in px/ms.
 * @param {number[]} curve The easing of the motion.
 * @param {number} fallback The duration if the velocity is too low or in the other direction.
 * @returns {number}
 */
function releaseDuration(path, velocity, curve, fallback) {
	if (Math.sign(path) !== Math.sign(velocity) || Math.abs(velocity) < 0.05) {
		return fallback;
	}
	return clamp(Math.abs(path) * curve[1] / curve[0] / Math.abs(velocity), 200, 1200);
}

/**
 * Get the velocity from the last samples of a drag.
 *
 * @param {Array<number[]>} samples [location, time] pairs, the oldest first. A drag always has one sample or more.
 * @returns {number} px/ms
 */
function velocity(samples) {
	const last = samples[samples.length - 1];

	// The last sample is always in its own window, so find() always finds a sample
	const first = samples.find((sample) => last[1] - sample[1] <= 100),
		time = last[1] - first[1];

	return time > 0 ? (last[0] - first[0]) / time : 0;
}

/**
 * Find the target of the motion after a drag.
 *
 * @param {object} args
 * @param {number} args.location The location at the release.
 * @param {number} args.from The location at the drag start.
 * @param {number} args.velocity The release velocity, in px/ms.
 * @param {number} args.current The selected snap at the drag start.
 * @param {Array<{location: number}>} args.snaps
 * @param {number} args.min
 * @param {number} args.max
 * @param {number} [args.period]
 * @param {boolean|number} [args.skipSnaps] true: go to the snap nearest to the projected location. A number: the same, but go at most this number of snaps.
 *     false: go at most one snap.
 * @param {boolean|string} [args.dragFree]
 * @param {number} [args.dragFriction] The glide distance is divided by this number.
 * @returns {{location: number, snap: number}}
 */
function releaseTarget({ location, from, velocity, current, snaps, min, max, period, skipSnaps, dragFree, dragFriction = 1 }) {
	const count = snaps.length;

	let projected = location + velocity * MOMENTUM / dragFriction;

	if (!period) {
		projected = clamp(projected, min, max);
	}

	// A number in skipSnaps: keep the projected location between the snaps that are skipSnaps snaps before and after the start snap
	if (typeof skipSnaps === 'number' && skipSnaps > 0 && skipSnaps < count - 1 + !period) {
		const limit = (direction) => targetLocation(snaps[snapIndex(current + direction * skipSnaps, count, period)].location, from, period, direction);
		projected = clamp(projected, limit(1), limit(-1));
	}

	if (dragFree === true) {
		return { location: projected, snap: nearestSnap(snaps, projected, period) };
	}

	if (dragFree || skipSnaps) {
		const snap = nearestSnap(snaps, projected, period);
		return { location: targetLocation(snaps[snap].location, projected, period), snap };
	}

	const moved = location - from;

	let direction = 0;

	if (Math.abs(velocity) > 0.3) {
		direction = velocity < 0 ? 1 : -1;
	} else if (Math.abs(moved) > 20) {
		direction = moved < 0 ? 1 : -1;
	}

	const snap = snapIndex(current + direction, count, period),
		target = snaps[snap].location;

	return {
		location: period ? targetLocation(target, direction ? from : location, period, snap === current ? 0 : direction) : target,
		snap
	};
}

/**
 * Make the drag input of a carousel. The carousel follows the pointer. At the release, it goes to a snap, or with dragFree, it glides.
 *
 * @param {object} context What the features share. See carousel.js.
 * @returns {{remove: () => void}|undefined}
 */
function drag(context) {
	const { viewport, options } = context;

	if (!options.drag) {
		return;
	}

	let pointer = null,
		start,
		base,
		axis,
		block = false,
		samples = [],
		// The selected snap at the drag start
		snap = 0;

	const listen = (method) => ['pointermove', 'pointerup', 'pointercancel'].forEach((name) => window[method](name, handle));

	function down(event) {
		block = false;

		const geo = context.geo();

		if (pointer !== null || event.button || !geo || geo.fit || event.target.closest(fields)) {
			return;
		}

		// Stop the text selection and the native image drag
		if (event.pointerType === 'mouse') {
			event.preventDefault();
		}

		pointer = event.pointerId;
		axis = { x: geo.axis === 'x', sign: geo.sign };
		start = [event.clientX, event.clientY];
		samples = [];
		listen('addEventListener');
	}

	function handle(event) {
		if (event.pointerId !== pointer) {
			return;
		}

		if (event.type !== 'pointermove') {
			// A stop before the release gives a low velocity
			if (samples.length) {
				samples.push([samples[samples.length - 1][0], event.timeStamp]);
			}
			return end(event.type === 'pointerup');
		}

		const dx = event.clientX - start[0],
			dy = event.clientY - start[1],
			main = axis.x ? dx * axis.sign : dy,
			cross = axis.x ? dy : dx;

		if (!context.dragging()) {
			// A touch move across the axis scrolls the page
			if (event.pointerType !== 'mouse' && Math.abs(cross) > Math.abs(main)) {
				return end();
			}
			if (Math.abs(main) < options.dragThreshold) {
				return;
			}
			// Stop the motion, and start the drag at the location where the carousel is now
			base = context.halt();
			snap = context.selected();
			context.drag(true);
			// Capture only now: with capture, a link in a slide does not get the click
			viewport.setPointerCapture(pointer);
		}

		const geo = context.geo(),
			value = base + main,
			edge = clamp(value, geo.min, geo.max);

		// Out of the limits, the carousel moves at a quarter of the pointer speed
		context.hold(geo.period ? value : edge + (value - edge) / 4, true);
		samples.push([main, event.timeStamp]);

		if (samples.length > 10) {
			samples.shift();
		}
	}

	/**
	 * End the drag.
	 *
	 * @param {boolean} [up] true for a pointerup. A pointercancel releases with no velocity.
	 */
	function end(up) {
		listen('removeEventListener');
		pointer = null;

		if (!context.dragging()) {
			return;
		}

		const geo = context.geo(),
			location = context.location(),
			speed = up ? velocity(samples) : 0,
			target = releaseTarget({ location, from: base, velocity: speed, current: snap, snaps: geo.snaps, min: geo.min, max: geo.max, period: geo.period, skipSnaps: options.skipSnaps, dragFree: options.dragFree, dragFriction: options.dragFriction }),
			curve = options.dragFree === true ? GLIDE : EASE;

		block = true;
		context.drag(false);
		context.move(target.snap, target.location, releaseDuration(target.location - location, speed, curve, options.duration), curve);
	}

	function click(event) {
		if (block) {
			block = false;
			event.preventDefault();
			event.stopPropagation();
		}
	}

	const prevent = (event) => event.preventDefault();

	viewport.addEventListener('pointerdown', down);
	viewport.addEventListener('click', click, true);
	viewport.addEventListener('dragstart', prevent);

	return {
		remove() {
			listen('removeEventListener');
			viewport.removeEventListener('pointerdown', down);
			viewport.removeEventListener('click', click, true);
			viewport.removeEventListener('dragstart', prevent);
		}
	};
}

/**
 * Make the wheel input of a viewport: in a vertical carousel, and with wheel: 'both' also in a horizontal carousel. The carousel follows
 * the wheel distance with a short motion on the compositor. When the wheel stops, the carousel goes to a snap. At the first and the last
 * location, the page scrolls.
 *
 * @param {object} context What the features share. See carousel.js.
 * @returns {{remove: () => void}|undefined}
 */
function wheel(context) {
	const { viewport, options } = context,
		// With dragFree: true, the carousel stays where the wheel stops
		free = options.dragFree === true;

	if (!options.wheel) {
		return;
	}

	// The time of the last wheel event, and of the last event that moved the carousel
	let time = 0,
		moved = 0,
		// The timer that finds the end of a gesture
		timer = 0,
		// The selected snap at the gesture start, and the direction of the last step
		snap = 0,
		direction = 0;

	function onWheel(event) {
		const geo = context.geo(),
			side = geo.axis === 'x' && Math.abs(event.deltaX) > Math.abs(event.deltaY),
			delta = side ? event.deltaX * geo.sign : event.deltaY;

		if (event.ctrlKey || !delta || context.dragging()) {
			return;
		}

		const now = event.timeStamp,
			gesture = now - time < 200,
			base = context.location(),
			path = delta * (event.deltaMode === 1 ? 40 : event.deltaMode ? geo.view : 1);

		let target = base - path;
		if (!geo.period) {
			target = clamp(target, geo.min, geo.max);
		}

		time = now;

		// At the end, the page scrolls. The inertia of a gesture that moved the carousel does not scroll the page.
		if (Math.abs(target - base) < 0.5) {
			if (gesture && now - moved < 1000) {
				event.preventDefault();
			}
			return;
		}

		event.preventDefault();
		context.emit('interact');

		if (!timer) {
			snap = context.selected();
		}
		moved = now;
		direction = path > 0 ? 1 : -1;
		context.move(nearestSnap(geo.snaps, target, geo.period), target, WHEEL, EASE);

		clearTimeout(timer);
		if (!free) {
			timer = setTimeout(end, 150);
		}
	}

	// Go to a snap when the wheel stops. A short wheel motion goes to the next snap in its direction, so that one wheel step always changes the slide.
	function end() {
		timer = 0;
		const geo = context.geo(),
			at = context.current(),
			index = nearestSnap(geo.snaps, at, geo.period),
			away = Math.abs(targetLocation(geo.snaps[index].location, at, geo.period) - at) > 10;

		context.step(index, index === snap && away ? direction : 0);
	}

	// A wheel listener that is not passive makes the browser wait for the main thread before it scrolls the page.
	// Add it only where the wheel moves the carousel.
	function listen() {
		const geo = context.geo();
		viewport[!geo.fit && (geo.axis === 'y' || options.wheel === 'both') ? 'addEventListener' : 'removeEventListener']('wheel', onWheel, { passive: false });
	}

	['init', 'reinit', 'resize'].forEach((name) => context.on(name, listen));

	return {
		remove() {
			viewport.removeEventListener('wheel', onWheel);
			clearTimeout(timer);
		}
	};
}

/**
 * Go to a slide that gets the keyboard focus, if it does not show fully. A focus soon after a pointer press does not move the carousel.
 *
 * @param {object} context What the features share. See carousel.js.
 * @returns {{remove: () => void}}
 */
function focus(context) {
	const { api, container, options } = context;

	// The time of the last pointer press
	let pressed = -1e4;

	function press(event) {
		if (!event.target.closest(fields)) {
			pressed = event.timeStamp;
		}
	}

	function onFocus(event) {
		const geo = context.geo(),
			index = api.slideNodes().findIndex((node) => node.contains(event.target));

		if (!geo || index < 0 || event.timeStamp - pressed < 600) {
			return;
		}
		if (options.focus && !inView(geo.slides, context.location(), geo.view, 1, geo.period).map((item) => item % geo.count).includes(index)) {
			api.goToSlide(index);
		}
		context.emit('slidefocus');
	}

	container.addEventListener('pointerdown', press);
	container.addEventListener('focusin', onFocus);

	return {
		remove() {
			container.removeEventListener('pointerdown', press);
			container.removeEventListener('focusin', onFocus);
		}
	};
}

/*
 * Navigation: the arrows, the dots, and the link to another carousel (the sync option).
 *
 * Each feature takes the context of a carousel (see carousel.js). It returns nothing if its option is off, or an object with remove().
 */


/**
 * Make the arrows and the dots of a carousel. They update on the carousel events.
 *
 * @param {object} context What the features share. See carousel.js.
 * @returns {{remove: () => void}|undefined} remove() removes the arrows and the dots.
 */
function nav(context) {
	const { api, root, cls, options } = context,
		labels = options.labels,
		arrows = optionElement(options.arrows, root),
		box = optionElement(options.dots, root),
		buttons = [],
		dots = [],
		list = box && create('div', cls.dots);

	let marks = new Map();

	if (!arrows && !box) {
		return;
	}

	if (arrows) {
		[['prev', 'goToPrev'], ['next', 'goToNext']].forEach(([key, method]) => {
			const button = create('button', cls.button + ' ' + cls[key + 'Button']);
			button.type = 'button';
			button.setAttribute('aria-label', labels[key]);
			button.setAttribute('aria-controls', context.container.id);
			button.addEventListener('click', () => api[method]());
			buttons.push(button);
		});
	}

	function update() {
		const fit = api.isFit(),
			count = fit ? 0 : api.snapProgress().length,
			selected = api.selectedSnap();

		buttons.forEach((button, index) => {
			if (fit) {
				button.remove();
			} else {
				if (!button.isConnected) {
					arrows.append(button);
				}
				const disabled = !(index ? api.canGoToNext() : api.canGoToPrev());
				if (button.disabled !== disabled) {
					button.disabled = disabled;
				}
			}
		});

		if (!list) {
			return;
		}

		if (count < 2) {
			list.remove();
			return;
		}

		while (dots.length > count) {
			dots.pop().remove();
			marks.delete(dots.length);
		}

		while (dots.length < count) {
			const dot = create('button', cls.dot),
				index = dots.length;
			dot.type = 'button';
			dot.setAttribute('aria-label', labels.dot.replace('%d', index + 1));
			dot.setAttribute('aria-controls', context.container.id);
			// The window of the dots hides the dots out of the zoom: keep them out of the tab order
			dot.tabIndex = -1;
			dot.addEventListener('click', () => api.goToSnap(index));
			dots.push(dot);
			list.append(dot);
		}

		if (!list.isConnected) {
			box.append(list);
		}

		// The zoom effect: the 5 dots around the selected dot get state classes
		const next = new Map();

		['first', 'prev', 'current', 'next', 'last'].forEach((key, offset) => {
			if (dots[selected + offset - 2]) {
				next.set(selected + offset - 2, cls[key]);
			}
		});

		marks.forEach((name, index) => {
			if (next.get(index) !== name) {
				setClass(dots[index], name, false);
				setAttribute(dots[index], 'aria-current', false);
				dots[index].tabIndex = -1;
			}
		});

		next.forEach((name, index) => {
			setClass(dots[index], name, true);
			setAttribute(dots[index], 'aria-current', index === selected && 'true');
			dots[index].tabIndex = 0;
		});

		marks = next;

		// Center the group of up to 5 dots in the window of the dots. The CSS moves the dots with "translate".
		const shift = 2 - (Math.max(0, selected - 2) + Math.min(count - 1, selected + 2)) / 2;
		if (list.style.getPropertyValue('--better-shift') !== String(shift)) {
			list.style.setProperty('--better-shift', shift);
		}
	}

	['init', 'reinit', 'resize', 'select', 'slideschanged'].forEach((name) => context.on(name, update));

	return {
		remove() {
			buttons.forEach((button) => button.remove());
			list?.remove();
		}
	};
}

/**
 * Connect a carousel to another carousel with the same slides, such as thumbnails to a main gallery. This carousel follows the slide
 * that the other carousel selects. Only a click on a slide of this carousel selects that slide in the other carousel: a drag does not.
 *
 * @param {object} context What the features share. See carousel.js. The "sync" option is the other carousel, its container or a selector.
 * @returns {{remove: () => void}|undefined} remove() disconnects the carousels.
 */
function sync(context) {
	const { api, container } = context,
		target = context.options.sync;

	let other = null;

	if (!target) {
		return;
	}

	// Show the slide that the other carousel selects
	function show(instant) {
		const index = other.selectedSlide();
		context.follow(index);
		api.goToSlide(index, instant === true);
	}

	function click(event) {
		// The slide or the clone that gets the click, and then its original slide
		const index = context.nodes().findIndex((node) => node.contains(event.target));
		if (other && index > -1) {
			other.goToSlide(index % api.slideNodes().length);
		}
	}

	// The other carousel can come later than this one, so find it at the init
	function connect() {
		if (other) {
			return;
		}
		other = target.goToSnap ? target : find(typeof target === 'string' ? optionElement(target, context.root) : target);
		if (other) {
			other.on('select', show);
			show(true);
		}
	}

	context.on('init', connect);
	context.on('reinit', connect);
	container.addEventListener('click', click);

	return {
		remove() {
			other?.off('select', show);
			container.removeEventListener('click', click);
		}
	};
}

/*
 * Entry point: the BetterCarousel function, its features, and its static members defaults, get() and initAll().
 */


// The features. Their event handlers run in this order.
const features = [drag, wheel, focus, nav, autoplay, autoScroll, sync];

/**
 * Make a carousel, or get the carousel of an element that has one.
 *
 * @param {HTMLElement} element The container of the slides, or its viewport.
 * @param {object} [options]
 * @returns {object} The carousel API.
 */
function BetterCarousel(element, options = {}) {
	return carousel(element, options, BetterCarousel.defaults, features);
}

// The site defaults. They merge over the library defaults.
BetterCarousel.defaults = {};

/**
 * Get the instance of a root, a viewport or a container.
 *
 * @param {Element} element
 * @returns {object|undefined}
 */
BetterCarousel.get = find;

/**
 * Make a carousel for each element that matches a selector and has no carousel.
 *
 * @param {string} selector
 * @param {object} [options]
 * @returns {object[]}
 */
BetterCarousel.initAll = (selector, options) => {
	const elements = [...document.querySelectorAll(selector)];
	// Read the boxes of the lazy carousels before the first setup() writes. Then the reads cause one layout, not one for each carousel.
	readBoxes(elements.filter((element) => !find(element) && resolve(element, BetterCarousel.defaults, options).lazy));
	return elements.map((element) => BetterCarousel(element, options));
};

export { BetterCarousel as default };
