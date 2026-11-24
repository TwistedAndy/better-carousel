/*
 * Autoplay: the autoplay, the auto scroll, and the play control that they share.
 *
 * Each feature takes the context of a carousel (see carousel.js). It returns nothing if its option is off, or an object with remove().
 */

import { bind, createButton, own, setAttribute, setClass } from './markup.js';

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
export function settings(base, key, value) {
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
export function autoplay(context) {
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
		timer = 0;
		done?.();
		done = null;
	}

	function reset() {
		clear();
		if (!control.paused() && !api.isFit()) {
			// The delay: data-delay on the selected slide, one value for each snap, or one value. The last value of a list applies to the snaps after it.
			// A value that is not a positive number gives the default delay. setTimeout() runs at once with 2^31 ms or more.
			const value = api.slideNodes()[api.selectedSlide()]?.dataset.delay || options.delay,
				list = [].concat(value),
				number = +list[Math.min(api.selectedSnap(), list.length - 1)],
				delay = number > 0 && number < 2e9 ? number : autoplayDefaults.delay;
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

	// A measure pass can start or end the fit mode: then start or stop the timer. During a drag or a motion, the "settle" starts the timer.
	function resize() {
		if (api.isFit() ? timer : !timer && !context.dragging() && !context.moving()) {
			reset();
		}
	}

	const control = controller(context, 'autoplay', options, {
		play: reset,
		stop: clear,
		pause: reset,
		events: [['settle', reset], ['interact', interact], ['resize', resize]]
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
export function autoScroll(context) {
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
		if (geo && !geo.fit && options.speed > 0 && !pressed && !context.dragging() && !control.paused()) {
			context.scroll(options.direction === 'prev' ? -1 : 1, options.speed / 1000);
		}
	}

	// While the auto scroll plays, a press stops the slides under the pointer. A release without a drag starts them again after the delay.
	// A drag is an interaction. Its release starts a motion to a snap, and the "settle" of this motion starts the delay.
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
		if (!context.dragging() && !context.moving()) {
			wait();
		}
	}

	return control;
}
