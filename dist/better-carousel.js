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
 * @param {string} name The CSS name, such as 'touch-action' or '--better-dot'.
 * @param {string|number} value An empty string removes the property.
 */
function setStyle(element, name, value) {
	if (element.style.getPropertyValue(name) !== String(value)) {
		element.style.setProperty(name, value);
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
 * Make a function that adds or removes event listeners on a target.
 *
 * @param {EventTarget} target
 * @param {Array<Array>} list [name, handler, options] for each listener.
 * @returns {(on?: boolean) => void} With true, it adds the listeners. Without a value, it removes them.
 */
function bind(target, list) {
	return (on) => list.forEach(([name, handler, options]) => target[on ? 'addEventListener' : 'removeEventListener'](name, handler, options));
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
 * Make a control button of a carousel.
 *
 * @param {string} className
 * @param {HTMLElement} container The container of the slides, which the button controls.
 * @param {string} label The aria-label. An empty label adds no attribute.
 * @param {() => void} click
 * @returns {HTMLButtonElement}
 */
function createButton(className, container, label, click) {
	const element = create('button', className);
	element.type = 'button';
	setAttribute(element, 'aria-label', label);
	element.setAttribute('aria-controls', container.id);
	element.addEventListener('click', click);
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
 * @param {string} value An empty value removes the attribute, for example an empty label.
 */
function own(node, name, value) {
	const list = marked.get(node) || new Set();
	if (list.has(name) || !node.hasAttribute(name)) {
		list.add(name);
		marked.set(node, list);
		setAttribute(node, name, value);
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

// The elements that never show, so they are not slides
const skipped = new Set(['template', 'script', 'style']);

/**
 * Get the slides of a container. The clones that the library made, and the template, script and style elements, are not slides.
 *
 * @param {HTMLElement} container
 * @param {string} [selector] The "slides" option.
 * @returns {HTMLElement[]}
 */
function readSlides(container, selector) {
	return [...(selector ? container.querySelectorAll(selector) : container.children)].filter((node) => !made.has(node) && !skipped.has(node.localName));
}

/**
 * Make the clones: full copies of the slides, which the screen reader and the keyboard do not see. A clone is inert, so the pointer
 * does not see it either: the carousel passes a click on a clone to its slide.
 *
 * @param {HTMLElement[]} slides
 * @param {number} count The number of copies of all slides.
 * @param {string} className The class of a clone.
 * @returns {HTMLElement[]}
 */
function copySlides(slides, count, className) {
	const list = [];

	for (let pass = 0; pass < count; pass++) {
		for (const node of slides) {
			const clone = copy(node);
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

// Copy a node with its content. An id must be unique in the page, so the copy has no ids. A form field in the copy has no name and is not
// required: it does not join the radio group of its slide, the form does not send it, and the form check does not stop at it.
function copy(node) {
	const result = node.cloneNode(true),
		selects = node.querySelectorAll('select');
	for (const item of [result, ...result.querySelectorAll('[id],[name],[required]')]) {
		['id', 'name', 'required'].forEach((name) => item.removeAttribute(name));
	}
	// The copy keeps the values and the checks of the fields, but not the selected option
	result.querySelectorAll('select').forEach((item, index) => item.selectedIndex = selects[index].selectedIndex);
	return result;
}

/**
 * Copy the content of a slide into its clone again.
 *
 * @param {HTMLElement} clone
 * @param {HTMLElement} node The slide.
 */
function copyContent(clone, node) {
	clone.replaceChildren(...copy(node).childNodes);
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
		button = createButton(cls.button + ' ' + cls.playButton, container, '', () => playing ? control.stop() : control.play());

	let playing = false,
		watch = null,
		// true until the first init
		first = true;

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
		// Start at the first init, unless the user prefers less motion. After a breakpoint change, the play state stays.
		// A play() before the first init starts now, because the carousel had no size before.
		if (first) {
			first = false;
			if (playing) {
				hooks.play();
			} else if (context.playing?.[key] ?? (options.playOnInit && !matchMedia('(prefers-reduced-motion: reduce)').matches)) {
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
			// Keep the play state for the setup after a breakpoint change. See reinit() in carousel.js.
			if (context.playing) {
				context.playing[key] = playing;
			}
			control.stop();
			button.remove();
			delete api[key];
		}
	};

	[['init reinit resize', show], ...hooks.events].forEach(([names, handler]) => context.on(names, handler));
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

	// The start delay, and true while a pointer presses the viewport
	let timer = 0,
		pressed = false;

	const control = controller(context, 'autoScroll', options, {
		play() {
			presses(true);
			wait();
		},
		stop() {
			presses();
			listen();
			pressed = false;
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
		if (geo && !geo.fit && !pressed && !context.dragging() && !control.paused()) {
			context.scroll(options.direction === 'prev' ? -1 : 1, options.speed / 1000);
		}
	}

	// While the auto scroll plays, a press stops the slides under the pointer. A release without a drag starts them again after the delay.
	// A drag is an interaction.
	const listen = bind(window, [['pointerup', release], ['pointercancel', release]]),
		presses = bind(context.viewport, [['pointerdown', press]]);

	function press(event) {
		if (!event.button && !pressed) {
			pressed = true;
			wait(-1);
			context.halt();
			listen(true);
		}
	}

	function release() {
		pressed = false;
		listen();
		if (!context.dragging()) {
			wait();
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


// Short names of the Math functions, which the minified file can make shorter
const { abs, floor, round } = Math;

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
		if (slide.hidden) {
			continue;
		}
		start = Math.min(start, slide.start);
		end = Math.max(end, slide.end);
		max = Math.max(max, slide.end - slide.start);
	}

	return { start, end, size: end - start, max };
}

/**
 * Put the slides that start at the same position (1 px or less) into one column. A hidden slide is in no column.
 * In a flex row, one column has one slide. In a grid, a column can have more slides.
 *
 * @param {Array<{start: number, end: number}>} slides
 * @returns {Array<{start: number, end: number}>} The columns, sorted by start.
 */
function columns(slides) {
	const order = slides.map((slide, index) => index).filter((index) => !slides[index].hidden).sort((a, b) => slides[a].start - slides[b].start || a - b),
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
 * Find the item with the lowest score.
 *
 * @param {Array} list
 * @param {(item: *, index: number) => number} score Infinity excludes an item.
 * @param {number} [margin] A score must be lower than the best score by more than this value. Then the lower index wins a tie.
 * @returns {number} The index, or -1 if all items are excluded.
 */
function lowest(list, score, margin = 0) {
	let best = -1,
		gap = Infinity;

	list.forEach((item, index) => {
		const value = score(item, index);
		if (value < gap - margin) {
			gap = value;
			best = index;
		}
	});

	return best;
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
	return period ? value - round(value / period) * period : value;
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
		list = list.filter((location, index) => !index || abs(distance(location, list[index - 1], period)) > 1);
		if (period && list.length > 1 && abs(distance(list[0], list[list.length - 1], period)) <= 1) {
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
 * If two slides have the same distance, the lower index wins. A hidden slide is never the active slide.
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
	return lowest(slides, (slide, index) => index >= from && index < to && !slide.hidden ? abs(distance(slide.start + location, alignOffset(align, view, slide.end - slide.start, index), period)) : Infinity, 0.5);
}

/**
 * Find the snap of a slide: the snap whose active slide it is, or the snap nearest to the raw location of the slide.
 *
 * @param {{snaps: Array<{location: number, slide: number}>, slides: Array<{start: number, end: number}>, view: number, align: string|Function, period?: number}} geo
 * @param {number} index The slide index.
 * @returns {number} The snap index.
 */
function snapOfSlide({ snaps: list, slides, view, align, period }, index) {
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
	return Math.max(0, lowest(list, (snap) => abs(distance(snap.location, location, period))));
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
		return target + (floor((location + 0.5 - target) / period) + 1) * period;
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
		return value - floor(value);
	}
	return max > min ? clamp((max - location) / (max - min), 0, 1) : 0;
}

/**
 * Find the slides that show at a location.
 *
 * @param {{slides: Array<{start: number, end: number}>, view: number, period?: number}} geo
 * @param {number} location
 * @param {number} threshold The part of a slide that must show, from 0 to 1. With 0, any part is enough.
 * @returns {number[]} The slide indexes.
 */
function inView({ slides, view, period }, location, threshold) {
	const result = [];

	slides.forEach((slide, index) => {
		const size = slide.end - slide.start,
			start = period ? distance(slide.start + location + size / 2, view / 2, period) + view / 2 - size / 2 : slide.start + location,
			visible = Math.min(start + size, view) - Math.max(start, 0);

		if (!slide.hidden && visible > 0 && visible >= threshold * size - 0.5) {
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
 * @param {{view: number, slides: Array<{start: number, end: number}>, gap: number, area: {start: number, size: number}}} rects The result of readRects().
 * The slides after the first count slides are clones.
 * @param {number} count The number of original slides.
 * @param {object} options The options of the carousel.
 * @returns {object} The geometry. If the carousel needs a different number of clones, only { copies }: the number of copies of all slides.
 * map gives the logical snap of each snap.
 */
function compute(layout, rects, count, options) {
	const content = bounds(rects.slides.slice(0, count)),
		// The auto scroll with the loop never fits, unless no slide shows, for example in a hidden tab
		fit = content.size <= rects.view + 1 && !(options.autoScroll && options.loop && content.max),
		loop = options.loop && !fit && count,
		// The loop period: the distance from the first slide start to the same point in the next copy of the slides
		period = loop ? bounds(rects.slides).size + rects.gap : 0,
		copies = loop && options.clones ? cloneCount(content.size + rects.gap, rects.area.size, content.max) : 0;

	if (copies * count !== rects.slides.length - count) {
		return { copies };
	}

	const geo = { ...layout, ...rects, fit, count, period, min: 0, max: 0 };

	if (fit) {
		geo.snaps = [{ location: 0, slide: Math.max(0, activeSlide(rects.slides, 0, rects.view, layout.align)) }];
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
	const best = lowest(geo.snaps, (snap, item) => geo.map[item] === index ? abs(distance(snap.location, location, geo.period)) : Infinity);

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
 * Read the slide boxes on the main axis, relative to the inner edge of the viewport padding at location 0. The snaps align to this edge.
 * The values are in the px of the carousel: in a parent with a CSS scale or zoom, such as a modal window that opens with a scale animation,
 * the values do not change. A rotation of a parent is not supported.
 * A slide with no box, such as a slide with display: none, is hidden. It gets no snap, and it stays at the end of the slide before it.
 *
 * @param {HTMLElement} viewport
 * @param {HTMLElement[]} nodes All slides, clones included.
 * @param {object} layout The result of readLayout().
 * @param {{axis: string, container: number, slides: number[]}} written The translate values that the library wrote, in px on the screen.
 * @param {number} [size] The window size on the main axis, for clones: 'fill'.
 * @returns {{view: number, slides: Array<{start: number, end: number, cross: number, hidden: boolean}>, gap: number, scale: number, area: {start: number, size: number}}}
 * view is the viewport size without the padding. gap is the loop gap: the space between the last slide and the next copy of the first slide.
 * scale is the screen px of one px of the carousel. area is the part of the main axis where the loop must show slides: the viewport with its
 * padding, or with a size, the window, so that the slides fill it when the viewport overflow shows.
 */
function readRects(viewport, nodes, layout, written, size) {
	const box = viewport.getBoundingClientRect(),
		x = layout.axis === 'x',
		sign = layout.sign,
		known = written.axis === layout.axis,
		shift = known ? written.container : 0,
		width = viewport.offsetWidth,
		height = viewport.offsetHeight,
		// offsetWidth is a whole number: a difference of less than 1 px is not a scale
		scale = width && height && (abs(box.width - width) >= 1 || abs(box.height - height) >= 1) ? (x ? box.width / width : box.height / height) : 1,
		view = (x ? box.width : box.height) / scale,
		style = getComputedStyle(viewport),
		side = x ? (layout.rtl ? ['Right', 'Left'] : ['Left', 'Right']) : ['Top', 'Bottom'],
		pad = { start: parseFloat(style['padding' + side[0]]) || 0, end: parseFloat(style['padding' + side[1]]) || 0 };

	const slides = nodes.map((node, index) => {
		const rect = node.getBoundingClientRect(),
			offset = sign * (shift + (known && written.slides[index] || 0));

		let start = (x ? (layout.rtl ? box.right - rect.right : rect.left - box.left) : rect.top - box.top) / scale - pad.start - offset,
			size = (x ? rect.width : rect.height) / scale,
			cross = (x ? rect.height : rect.width) / scale;

		// An effect can scale or turn a slide, for example through the offset option. offsetWidth has no transform. If it is not the size
		// of the rect, take the sizes from the CSS, and move the start back by the part that the transform took around its origin.
		if (abs(size - (x ? node.offsetWidth : node.offsetHeight)) >= 1) {
			const style = getComputedStyle(node),
				full = borderBox(style, x),
				origin = parseFloat(style.transformOrigin.split(' ')[x ? 0 : 1]);
			start -= (x && layout.rtl ? full - origin : origin) * (1 - size / full);
			size = full;
			cross = borderBox(style, !x);
		}

		return { start, end: start + size, cross, hidden: !rect.width && !rect.height };
	});

	// A hidden slide goes to the end of the visible slide before it. The first and the last visible slides give the margins of the loop gap.
	let edge = slides.find((slide) => !slide.hidden)?.start || 0,
		first = -1,
		last = -1,
		gap = layout.gap;

	slides.forEach((slide, index) => {
		if (slide.hidden) {
			slide.start = slide.end = edge;
			return;
		}
		edge = slide.end;
		if (first < 0 || slide.start < slides[first].start) {
			first = index;
		}
		if (last < 0 || slide.end > slides[last].end) {
			last = index;
		}
	});

	if (first > -1) {
		gap += (parseFloat(getComputedStyle(nodes[first])['margin' + side[0]]) || 0) + (parseFloat(getComputedStyle(nodes[last])['margin' + side[1]]) || 0);
	}

	const inner = view - pad.start - pad.end;

	// The area before and after the inner edge of the viewport padding: the padding, or the window
	let before = pad.start,
		after = inner + pad.end;

	if (size) {
		before += Math.max(0, round(x ? (layout.rtl ? size - box.right : box.left) : box.top));
		after = Math.max(after, round(size - before));
	}

	return {
		view: inner,
		slides,
		gap,
		scale,
		area: { start: -before, size: before + after }
	};
}

/**
 * Get the border box size of an element on an axis from its CSS. This size has no transform.
 *
 * @param {CSSStyleDeclaration} style The computed style of the element.
 * @param {boolean} x true for the width, false for the height.
 * @returns {number}
 */
function borderBox(style, x) {
	const names = [x ? 'width' : 'height'];
	if (style.boxSizing !== 'border-box') {
		(x ? ['Left', 'Right'] : ['Top', 'Bottom']).forEach((side) => names.push('padding' + side, 'border' + side + 'Width'));
	}
	return names.reduce((total, name) => total + (parseFloat(style[name]) || 0), 0);
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

// One ResizeObserver for all carousels. Each callback first reads the layout of all carousels, then writes. In this way, the reads of one carousel do not
// come after the writes of another carousel, and the browser does one layout for all of them.
const owners = new WeakMap(),
	// The elements of each owner, and the last size of each element
	watched = new WeakMap(),
	sizes = new WeakMap();

let resizer;

/**
 * Watch the size of elements. The ResizeObserver callback calls owner.read() for each owner, and then owner.write() for each owner whose read() returned true.
 * An entry for which owner.skip() returns true does not count. An entry with the same size as the last entry of its element does not count:
 * a new watch of an element after a write sends such an entry. observeSize() clears the last size, so its first entry always counts.
 *
 * @param {Element[]} nodes
 * @param {{read: () => boolean, write: () => void, skip: (entry: ResizeObserverEntry) => boolean}} [owner] Without an owner, stop the watch.
 */
function observeSize(nodes, owner) {
	resizer ||= new ResizeObserver((entries) => {
		const changed = [...new Set(entries.filter((entry) => {
			const { inlineSize, blockSize } = entry.borderBoxSize[0],
				size = inlineSize + ',' + blockSize,
				same = sizes.get(entry.target) === size;
			sizes.set(entry.target, size);
			return !same && !owners.get(entry.target)?.skip(entry);
		}).map((entry) => owners.get(entry.target)))].filter((item) => item?.read());
		changed.forEach((item) => item.write());
		// A write can change the size of an element that the observer watches, for example the auto height or the clones. If the observer has
		// a change to report after its callback, the browser sends the "ResizeObserver loop" error to window.onerror. Stop the watch of these
		// elements, and watch them again in the next frame. Then the first callback measures again and finds no change.
		if (changed.length) {
			changed.forEach((item) => watched.get(item)?.forEach((node) => resizer.unobserve(node)));
			requestAnimationFrame(() => changed.forEach((item) => watched.get(item)?.forEach((node) => owners.get(node) === item && resizer.observe(node))));
		}
	});

	if (owner) {
		watched.set(owner, nodes);
	}

	for (const node of nodes) {
		sizes.delete(node);
		if (owner) {
			owners.set(node, owner);
			resizer.observe(node);
		} else {
			owners.delete(node);
			resizer.unobserve(node);
		}
	}
}

// The lazy option: one IntersectionObserver for each margin, the callback of each element that waits, and the elements to check: [node, lazy, margin]
const watchers = new Map(),
	waiters = new WeakMap();

let queue = [];

/**
 * Wait until an element comes near the screen. One microtask reads the boxes of all elements that started to wait, after the writes of
 * the carousels that started without a wait. Then the reads cause one layout, not one for each carousel. The microtask runs before the
 * first paint, so a carousel near the screen starts before the page shows, and it does not move the page.
 *
 * @param {Element} node
 * @param {true|number} lazy The "lazy" option: true for one screen height, or a distance in px.
 * @param {Function} callback
 * @returns {Function} A function that stops the wait.
 */
function waitNear(node, lazy, callback) {
	const margin = lazy === true ? '100%' : lazy + 'px';

	if (!queue.length) {
		queueMicrotask(check);
	}
	queue.push([node, lazy, margin]);
	waiters.set(node, callback);

	return () => {
		watchers.get(margin)?.unobserve(node);
		waiters.delete(node);
	};
}

// Call the callback of each element near the screen, and watch the other elements. An element whose wait stopped has no callback.
function check() {
	const list = queue,
		rects = list.map(([node]) => node.getBoundingClientRect());

	queue = [];

	list.forEach(([node, lazy, margin], index) => {
		const near = lazy === true ? innerHeight : lazy,
			rect = rects[index],
			callback = waiters.get(node);

		if (!callback) {
			return;
		}

		if (rect.height && rect.bottom >= -near && rect.top <= innerHeight + near) {
			callback();
			return;
		}

		let observer = watchers.get(margin);
		if (!observer) {
			observer = new IntersectionObserver((entries) => entries.forEach((entry) => entry.isIntersecting && waiters.get(entry.target)?.()), { rootMargin: margin });
			watchers.set(margin, observer);
		}
		observer.observe(node);
	});
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
			if (abs(error) < 1e-5) {
				return axis(y1, y2, t);
			}
			if (abs(slope) < 1e-6) {
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
	let state = null,
		// The timeline time when the last motion stopped
		stopped = null;

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
			stopped = document.timeline.currentTime;
		}
		return at;
	}

	function animate(at) {
		const animation = element.animate([{ translate: css(state.from) }, { translate: css(state.to) }], { duration: state.duration, easing: 'cubic-bezier(' + state.curve + ')', fill: 'forwards' });
		// A new animation waits for the compositor, and its time stays at its start until then. This gives a smooth start from rest.
		// A motion that replaces a motion in the same frame, such as on each wheel event of a trackpad, starts at once. Otherwise each
		// event replaces a motion that did not start yet, and the carousel does not move.
		if (!at && stopped === document.timeline.currentTime) {
			animation.startTime = stopped;
		} else {
			animation.currentTime = at;
		}
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
	keys: true,
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
	dotsStyle: 'zoom',
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
	dotsTrack: prefix + '_dots_track',
	dotsMarker: prefix + '_dots_marker',
	dotsAll: prefix + '_dots_all',
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

// true if the browser supports the pan-up and pan-down values of touch-action
let directional;

/**
 * Get the carousel of a root, a viewport or a container.
 *
 * @param {Element} element
 * @returns {object|undefined}
 */
const find = (element) => registry.get(element);

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
		viewport.removeEventListener('click', onClick);
		viewport.removeEventListener('input', onInput);
		removeEventListener('resize', onWindow);

		nodes.forEach(clean);

		setStyle(container, 'translate', '');
		setStyle(container, 'will-change', '');
		setStyle(viewport, 'touch-action', '');
		setStyle(viewport, 'height', '');
		setStyle(root, '--better-progress', '');
		setStyle(root, '--better-duration', '');

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
		// A touch can scroll the page across the axis. At the first or the last snap of a vertical carousel, it can also scroll the page up
		// or down. Safari has no pan-up and pan-down, so there the carousel keeps the touch.
		const first = !can(-1),
			last = !can(1),
			edge = !x && (first || last) && (directional ??= CSS.supports('touch-action', 'pan-up')) ? (first && last ? 'pan-y ' : first ? 'pan-up ' : 'pan-down ') : '';
		setStyle(viewport, 'touch-action', geo.fit ? '' : x ? 'pan-y pinch-zoom' : 'pan-x ' + edge + 'pinch-zoom');
		setStyle(container, 'will-change', geo.fit ? '' : 'translate');

		if (!keep) {
			write(geo.fit ? 0 : location);
		}

		// Auto height: the height of the tallest slide in view. During a motion or a drag, the slides in view at the selected snap give it,
		// so that a taller slide makes the viewport taller only when it is selected. The CSS transition has the duration and the curve of a motion.
		if (options.autoHeight) {
			setStyle(viewport, 'height', x ? Math.max(...inView(geo, keep ? geo.snaps[selected].location : location, 0).map((index) => geo.slides[index].cross)) + 'px' : '');
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
	 */
	function write(value) {
		if (written.axis !== geo.axis) {
			nodes.forEach((node) => setStyle(node, 'translate', ''));
			written = { axis: geo.axis, container: 0, slides: [] };
		}

		written.container = screen(value);
		setStyle(container, 'translate', translate(written.container));
		place(value, value);
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

/*
 * Input: the pointer drag, the mouse wheel, the arrow keys, the keyboard focus, and the target of the motion after a drag.
 *
 * Each feature takes the context of a carousel (see carousel.js). It returns nothing if its option is off, or an object with remove().
 */


// The targets that keep their own pointer and key behavior
const fields = 'input,textarea,select,[contenteditable]';

// true if an event comes from a form field. An event from a shadow root has the host as its target, so the check uses the first element of the event path.
const inField = (event) => event.composedPath()[0].closest(fields);

// The pointerdown events that a carousel took for a drag
const claimed = new WeakSet();

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
	if (Math.sign(path) !== Math.sign(velocity) || abs(velocity) < 0.05) {
		return fallback;
	}
	return clamp(abs(path) * curve[1] / curve[0] / abs(velocity), 200, 1200);
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

	if (abs(velocity) > 0.3) {
		direction = velocity < 0 ? 1 : -1;
	} else if (abs(moved) > 20) {
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
		// true if the press stopped a motion
		stopped = false,
		samples = [],
		// The selected snap at the drag start
		snap = 0;

	const listen = bind(window, [['pointermove', handle], ['pointerup', handle], ['pointercancel', handle]]);

	function down(event) {
		block = false;

		const geo = context.geo();

		// In nested carousels, the inner carousel gets the press first and claims it
		if (pointer !== null || event.button || !geo || geo.fit || claimed.has(event) || inField(event)) {
			return;
		}

		claimed.add(event);

		// Stop the text selection and the native image drag
		if (event.pointerType === 'mouse') {
			event.preventDefault();
		}

		pointer = event.pointerId;
		// In a parent with a CSS scale, one px of the pointer is not one px of the carousel
		axis = { x: geo.axis === 'x', sign: geo.sign, scale: geo.scale };
		start = [event.clientX, event.clientY];
		samples = [];

		// A press stops a motion where it is. The release goes to a snap, and the click after it does not count.
		// The auto scroll does not stop here: its feature stops it during the press and starts it again after the release.
		stopped = context.moving();
		if (stopped) {
			base = context.halt();
			snap = context.selected();
			context.emit('interact');
		}

		listen(true);
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

		const dx = (event.clientX - start[0]) / axis.scale,
			dy = (event.clientY - start[1]) / axis.scale,
			main = axis.x ? dx * axis.sign : dy,
			cross = axis.x ? dy : dx;

		if (!context.dragging()) {
			// A touch move across the axis scrolls the page
			if (event.pointerType !== 'mouse' && abs(cross) > abs(main)) {
				return end();
			}
			if (abs(main) < options.dragThreshold) {
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
		context.hold(geo.period ? value : edge + (value - edge) / 4);
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
		listen();
		pointer = null;

		const dragged = context.dragging();

		if (!dragged && !stopped) {
			return;
		}

		const geo = context.geo(),
			location = context.location(),
			// A press that only stopped a motion has no samples
			speed = up && samples.length ? velocity(samples) : 0,
			// The snaps and the limits come from the geometry, and skipSnaps, dragFree and dragFriction from the options
			target = releaseTarget({ ...geo, ...options, location, from: base, velocity: speed, current: snap }),
			curve = options.dragFree === true ? GLIDE : EASE;

		block = true;
		if (dragged) {
			context.drag(false);
		}
		context.move(target.snap, target.location, releaseDuration(target.location - location, speed, curve, options.duration), curve);
	}

	// Cancel the click after a drag. A touch drag sends no click, so the next click can come from the keyboard or a script.
	// Such a click has no detail (the click count), and it is not cancelled.
	function click(event) {
		if (block && event.detail) {
			event.preventDefault();
			event.stopPropagation();
		}
		block = false;
	}

	const prevent = (event) => event.preventDefault();

	// Stop a text selection during a drag. A "user-select" rule on the dragging class does the same, but its change paints all layers of the carousel.
	const select = (event) => context.dragging() && event.preventDefault();

	const own = bind(viewport, [['pointerdown', down], ['click', click, true], ['dragstart', prevent], ['selectstart', select]]);

	own(true);

	return {
		remove() {
			listen();
			own();
		}
	};
}

/**
 * Find an element between a node and the viewport that can scroll in a direction.
 *
 * @param {Element} node The target of the wheel event.
 * @param {Element} viewport
 * @param {string} axis 'x' or 'y'.
 * @param {number} delta The wheel delta on the axis.
 * @returns {boolean}
 */
function scrolls(node, viewport, axis, delta) {
	const [size, client, position, overflow] = axis === 'x' ? ['scrollWidth', 'clientWidth', 'scrollLeft', 'overflowX'] : ['scrollHeight', 'clientHeight', 'scrollTop', 'overflowY'];

	for (; node && node !== viewport; node = node.parentElement) {
		// Read the style only for an element with more content than space
		if (node[size] > node[client] && /auto|scroll/.test(getComputedStyle(node)[overflow])) {
			const at = abs(node[position]);
			if (delta > 0 ? at + node[client] < node[size] - 1 : at > 0) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Make the wheel input of a viewport. The carousel follows the wheel motion along its axis. A horizontal carousel follows a horizontal wheel motion,
 * such as a trackpad swipe, and a vertical wheel scrolls the page. With wheel: 'both', a horizontal carousel follows all wheel motions. The carousel
 * follows the wheel distance with a short motion on the compositor. When the wheel stops, the carousel goes to a snap. At the first and the last
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

	// The time and the delta size of the last wheel event, and true if the gesture moved the carousel
	let time = 0,
		last = 0,
		held = false,
		// true while a gesture scrolls an element in a slide
		inner = false,
		// The timer that finds the end of a gesture
		timer = 0,
		// The selected snap at the gesture start, and the direction of the last step
		snap = 0,
		direction = 0;

	function onWheel(event) {
		const geo = context.geo(),
			side = geo.axis === 'x' && abs(event.deltaX) > abs(event.deltaY),
			delta = side ? event.deltaX * geo.sign : event.deltaY;

		// A nested carousel or the page took the event before: it cancelled the default action
		if (event.defaultPrevented || event.ctrlKey || !delta || context.dragging() || (geo.axis === 'x' && !side && options.wheel !== 'both')) {
			return;
		}

		const now = event.timeStamp,
			gesture = now - time < 200,
			size = abs(delta),
			// A delta that does not grow is the inertia of the gesture, not a new push
			inertia = gesture && size <= last;

		time = now;
		last = size;
		held &&= gesture;

		// An element in a slide that can scroll in the wheel direction scrolls, also for the rest of its gesture
		inner = (gesture && inner) || scrolls(event.target, viewport, side ? 'x' : 'y', side ? event.deltaX : delta);
		if (inner) {
			return;
		}

		const base = context.location(),
			path = delta * (event.deltaMode === 1 ? 40 : event.deltaMode ? geo.view : 1);

		let target = base - path;
		if (!geo.period) {
			target = clamp(target, geo.min, geo.max);
		}

		// At the end, the page scrolls. The inertia of a gesture that moved the carousel does not scroll the page.
		if (abs(target - base) < 0.5) {
			if (held && inertia) {
				event.preventDefault();
			}
			return;
		}

		event.preventDefault();
		context.emit('interact');

		if (!timer) {
			snap = context.selected();
		}
		held = true;
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
			away = abs(targetLocation(geo.snaps[index].location, at, geo.period) - at) > 10;

		context.step(index, index === snap && away ? direction : 0);
	}

	// A wheel listener that is not passive makes the browser wait for the main thread before it scrolls the page.
	// Add it only where the wheel moves the carousel.
	const listen = bind(viewport, [['wheel', onWheel, { passive: false }]]);

	context.on('init reinit resize', () => {
		const geo = context.geo();
		listen(!geo.fit);
	});

	return {
		remove() {
			listen();
			clearTimeout(timer);
		}
	};
}

/**
 * Make the arrow keys move the carousel while the keyboard focus is in its root: left and right in a horizontal carousel, up and down
 * in a vertical carousel. In a right-to-left carousel, the left arrow goes to the next slide. A key in a form field does not move the carousel.
 *
 * @param {object} context What the features share. See carousel.js.
 * @returns {{remove: () => void}|undefined}
 */
function keys(context) {
	const { api, root, options } = context;

	if (!options.keys) {
		return;
	}

	function onKey(event) {
		const geo = context.geo(),
			// -1 for the previous slide, 1 for the next slide. A right-to-left carousel has the next slide at the left.
			direction = geo && !geo.fit && (geo.axis === 'y' ? { ArrowUp: -1, ArrowDown: 1 } : { ArrowLeft: -geo.sign, ArrowRight: geo.sign })[event.key],
			name = direction > 0 ? 'Next' : 'Prev';
		// At the first and the last slide, the key scrolls the page. A key that a nested carousel or the page took before has no default action.
		if (direction && !(event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || inField(event)) && api['canGoTo' + name]()) {
			event.preventDefault();
			api['goTo' + name]();
		}
	}

	const listen = bind(root, [['keydown', onKey]]);

	listen(true);

	return { remove: listen };
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
		if (!inField(event)) {
			pressed = event.timeStamp;
		}
	}

	function onFocus(event) {
		const geo = context.geo(),
			index = api.slideNodes().findIndex((node) => node.contains(event.target));

		if (!geo || index < 0 || event.timeStamp - pressed < 600) {
			return;
		}
		if (options.focus && !inView(geo, context.location(), 1).map((item) => item % geo.count).includes(index)) {
			api.goToSlide(index);
		}
		context.emit('slidefocus');
	}

	const listen = bind(container, [['pointerdown', press], ['focusin', onFocus]]);

	listen(true);

	return { remove: listen };
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
		// The window of 5 dots, or all dots with dotsStyle: 'all'
		windowed = options.dotsStyle !== 'all',
		// The window of the dots, the track that slides in it, and the marker of the selected dot
		list = box && create('div', windowed ? cls.dots : cls.dots + ' ' + cls.dotsAll),
		track = list && create('div', cls.dotsTrack);

	let marks = new Map();

	if (!arrows && !box) {
		return;
	}

	// Add the window of the dots now: its CSS height is fixed, so the dots that the first measure adds do not shift the page
	if (list) {
		track.append(create('span', cls.dotsMarker));
		list.append(track);
		box.append(list);
	}

	if (arrows) {
		buttons.push(createButton(cls.button + ' ' + cls.prevButton, context.container, labels.prev, () => api.goToPrev()), createButton(cls.button + ' ' + cls.nextButton, context.container, labels.next, () => api.goToNext()));
	}

	function update() {
		const fit = api.isFit(),
			count = fit ? 0 : context.geo().logical.length,
			selected = api.selectedSnap();

		buttons.forEach((item, index) => {
			if (fit) {
				item.remove();
			} else {
				if (!item.isConnected) {
					// Before the dots, for the tab order
					list?.parentNode === arrows ? list.before(item) : arrows.append(item);
				}
				const disabled = !(index ? api.canGoToNext() : api.canGoToPrev());
				if (item.disabled !== disabled) {
					item.disabled = disabled;
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
			const index = dots.length,
				dot = createButton(cls.dot, context.container, labels.dot.replace('%d', index + 1), () => api.goToSnap(index));
			// The window of the dots hides the dots out of the zoom: keep them out of the tab order
			if (windowed) {
				dot.tabIndex = -1;
			}
			dots.push(dot);
			track.append(dot);
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
				dots[index].tabIndex = windowed ? -1 : 0;
			}
		});

		next.forEach((name, index) => {
			setClass(dots[index], name, true);
			setAttribute(dots[index], 'aria-current', index === selected && 'true');
			dots[index].tabIndex = 0;
		});

		marks = next;

		// Center the group of up to 5 dots in the window of the dots, and move the marker to the selected dot. The CSS moves the track and the marker with "translate".
		if (windowed) {
			setStyle(list, '--better-shift', 2 - (Math.max(0, selected - 2) + Math.min(count - 1, selected + 2)) / 2);
		}
		setStyle(list, '--better-dot', selected);
	}

	context.on('init reinit resize select slideschanged', update);

	return {
		remove() {
			buttons.forEach((item) => item.remove());
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

	// A click on a clone comes to its slide. See onClick() in carousel.js.
	function click(event) {
		const index = api.slideNodes().findIndex((node) => node.contains(event.target));
		if (other && index > -1) {
			other.goToSlide(index);
		}
	}

	// The other carousel can come later than this one, so find it at the init
	function connect() {
		if (other) {
			return;
		}
		other = target.goToSnap ? target : context.find(typeof target === 'string' ? optionElement(target, context.root) : target);
		if (other) {
			other.on('select', show);
			show(true);
		}
	}

	context.on('init reinit', connect);
	const listen = bind(container, [['click', click]]);

	listen(true);

	return {
		remove() {
			other?.off('select', show);
			listen();
		}
	};
}

/*
 * Entry point: the BetterCarousel function, its features, and its static members defaults, get() and initAll().
 */


// The features. Their event handlers run in this order.
const features = [drag, wheel, keys, focus, nav, autoplay, autoScroll, sync];

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
BetterCarousel.initAll = (selector, options) => [...document.querySelectorAll(selector)].map((element) => BetterCarousel(element, options));

export { BetterCarousel as default };
