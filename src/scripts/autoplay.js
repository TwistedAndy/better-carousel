/*
 * Autoplay: the autoplay, the auto scroll, and the play control that they share.
 *
 * Each feature takes the context of a carousel (see carousel.js) and returns an object with remove().
 */

import { steps } from './loop.js';
import { create, own, setAttribute, setClass } from './markup.js';
import { autoplayDefaults, autoScrollDefaults, settings } from './options.js';

/**
 * Watch the reasons to pause: the root is out of view, the tab is hidden, the mouse is on the root, or the keyboard focus is in the root.
 * Make it only while a feature plays, so that a carousel at rest has no listeners on the document.
 *
 * @param {HTMLElement} root
 * @param {{stopOnMouseEnter: boolean, stopOnFocusIn: boolean}} options
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
			[root, 'pointerenter', (event) => set('mouse', options.stopOnMouseEnter && event.pointerType === 'mouse')],
			[root, 'pointerleave', () => set('mouse', false)],
			// A mouse click also moves the focus to a button. Only the keyboard focus pauses.
			[root, 'focusin', (event) => set('focus', options.stopOnFocusIn && event.target.matches(':focus-visible'))],
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
 *
 * @param {object} context What the features share. See carousel.js.
 * @param {string} name 'autoplay' or 'autoscroll', for the events.
 * @param {object} options The feature options.
 * @param {{play: () => void, stop: () => void, pause: (paused: boolean) => void, events?: Array<[string, Function]>}} hooks
 * events: more handlers of carousel events. remove() removes them.
 * @returns {{play: () => void, stop: () => void, isPlaying: () => boolean, paused: () => boolean, remove: () => void}}
 */
function controller(context, name, options, hooks) {
	const { api, root, container, cls, emit } = context,
		labels = context.options.labels,
		button = create('button', cls.button + ' ' + cls.play),
		handlers = [['init', show], ['reinit', show], ['resize', show], ...(hooks.events || [])];

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
				emit(name + ':play');
			}
		},
		stop() {
			if (playing) {
				playing = false;
				watch.remove();
				update();
				hooks.stop();
				emit(name + ':stop');
			}
		},
		isPlaying: () => playing,
		paused: () => !playing || watch.paused(),
		remove() {
			control.stop();
			handlers.forEach(([event, handler]) => api.off(event, handler));
			button.remove();
		}
	};

	handlers.forEach(([event, handler]) => api.on(event, handler));
	update();

	return control;
}

/**
 * Go to the next snap after a delay. The timer starts at "settle", so that a slow motion does not make the delay shorter.
 *
 * @param {object} context What the features share. See carousel.js.
 * @returns {object} The control: play(), stop(), reset(), isPlaying(), remove().
 */
export function autoplay(context) {
	const api = context.api,
		options = settings(autoplayDefaults, 'delay', context.options.autoplay);

	let timer = 0,
		// The function that the "timer" callback returned for the timer
		done = null,
		// true while the autoplay goes to the next slide, so that its own "select" is not an interaction
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
			api.goTo(0, options.instant);
		}
		self = false;
	}

	// A drag, an arrow, a dot or the keyboard stops the autoplay. With stopOnInteraction: false, the timer starts again at "settle".
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
		events: [['settle', reset], ['select', interact], ['pointerdown', interact]]
	});

	control.reset = reset;

	return control;
}

/**
 * Move the slides at a constant speed. With loop, the motion runs on the compositor: the container moves by one period in each iteration,
 * and each slide moves by one period at the time when it leaves the visible area. Without loop, the carousel goes to the end.
 *
 * @param {object} context What the features share. See carousel.js.
 * @returns {object} The play control in "control", remove(), and the calls that the carousel makes.
 */
export function autoScroll(context) {
	const options = settings(autoScrollDefaults, 'speed', context.options.autoScroll);

	// The motion of a loop: { from, direction, length, list, duration, animations }, or null
	let scroll = null,
		// The start delay
		timer = 0;

	const control = controller(context, 'autoscroll', options, {
		play: wait,
		stop() {
			wait(-1);
			context.halt();
		},
		pause(paused) {
			if (!scroll) {
				return paused ? context.halt() : timer || run();
			}
			scroll.animations.forEach((animation) => animation[paused ? 'pause' : 'play']());
			context.watch(!paused);
		}
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
		if (!geo || geo.fit || scroll || context.dragging() || control.paused()) {
			return;
		}

		const direction = options.direction === 'backward' ? -1 : 1,
			from = context.halt(),
			length = geo.period,
			speed = options.speed / 1000;

		if (!length) {
			const to = direction > 0 ? geo.min : geo.max;
			if (Math.abs(to - from) > 1) {
				context.glide(from, to, Math.abs(to - from) / speed);
			}
			return;
		}

		const list = steps(geo.slides, from, geo.area.size, length, direction, geo.area.start),
			timing = { duration: length / speed, iterations: Infinity },
			start = document.timeline.currentTime,
			css = context.css;

		context.write(from);
		scroll = {
			from,
			direction,
			length,
			list,
			duration: timing.duration,
			animations: [
				context.container.animate([{ translate: css(from) }, { translate: css(from - direction * length) }], timing),
				...context.nodes().map((node, index) => {
					const { k, offset } = list[index],
						before = css(k * length),
						after = css((k + direction) * length);
					return node.animate([{ translate: before }, { translate: before, offset }, { translate: after, offset }, { translate: after }], timing);
				})
			]
		};
		scroll.animations.forEach((animation) => animation.startTime = start);
		context.watch(true);
	}

	// The time in the iteration, from 0 to 1
	function phase() {
		return (scroll.animations[0].currentTime || 0) % scroll.duration / scroll.duration;
	}

	// The location of the loop motion now, or null
	function at() {
		return scroll ? scroll.from - scroll.direction * scroll.length * phase() : null;
	}

	return {
		control,
		remove: control.remove,
		at,

		// A drag, a wheel step or a goTo() from the user stops the auto scroll, or makes it wait until the next "settle"
		interrupt() {
			if (control.isPlaying()) {
				wait(-1);
				if (options.stopOnInteraction) {
					control.stop();
				}
			}
		},

		// A motion stopped: start again after the delay
		settled() {
			if (control.isPlaying() && !scroll) {
				wait();
			}
		},

		// A measure pass is done: start again now
		resume() {
			if (control.isPlaying() && !timer) {
				run();
			}
		},

		/**
		 * Stop the loop motion.
		 *
		 * @returns {number|null} The location where it stopped, or null if it did not run.
		 */
		cancel() {
			const location = at();
			scroll?.animations.forEach((animation) => animation.cancel());
			scroll = null;
			return location;
		},

		/**
		 * Get the translate values of the loop motion now.
		 *
		 * @param {number} sign -1 for a right-to-left carousel.
		 * @param {string} axis
		 * @returns {{axis: string, container: number, slides: number[]}|null}
		 */
		shown(sign, axis) {
			if (!scroll) {
				return null;
			}
			const time = phase();
			return { axis, container: sign * at(), slides: scroll.list.map(({ k, offset }) => sign * (time >= offset ? k + scroll.direction : k) * scroll.length) };
		}
	};
}
