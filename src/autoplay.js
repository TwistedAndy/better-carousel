import { create, setAttribute, setClass } from './dom.js';

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
 * @param {object} api
 * @param {string} name 'autoplay' or 'autoscroll', for the events.
 * @param {object} options The feature options.
 * @param {object} cls The class names.
 * @param {object} labels
 * @param {(name: string) => void} emit
 * @param {(value: string) => void} live Set aria-live on the container.
 * @param {{play: () => void, stop: () => void, pause: (paused: boolean) => void}} hooks
 * @returns {{play: () => void, stop: () => void, isPlaying: () => boolean, paused: () => boolean, remove: () => void}}
 */
export function controller(api, name, options, cls, labels, emit, live, hooks) {
	const root = api.rootNode(),
		button = create('button', cls.button + ' ' + cls.play),
		names = ['init', 'reinit', 'resize'];

	let playing = false,
		watch = null;

	button.type = 'button';
	button.setAttribute('aria-controls', api.containerNode().id);
	button.addEventListener('click', () => playing ? control.stop() : control.play());

	function update() {
		setAttribute(button, 'aria-label', playing ? labels.pause : labels.play);
		setClass(root, cls.playing, playing);
		// A screen reader does not read each automatic change
		live(playing ? 'off' : 'polite');
	}

	function show() {
		if (api.isFit()) {
			button.remove();
		} else if (!button.isConnected) {
			root.append(button);
		}
	}

	// Start at the first init, unless the user prefers less motion
	function begin() {
		api.off('init', begin);
		api.off('reinit', begin);
		if (options.playOnInit && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
			control.play();
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
			names.forEach((item) => api.off(item, show));
			button.remove();
		}
	};

	names.forEach((item) => api.on(item, show));
	api.on('init', begin);
	api.on('reinit', begin);
	update();

	return control;
}

/**
 * Go to the next snap after a delay. The timer starts at "settle", so that a slow motion does not make the delay shorter.
 *
 * @param {object} api
 * @param {boolean|number|object} value The "autoplay" option: true, a delay in ms, or an object.
 * @param {object} cls
 * @param {object} labels
 * @param {(name: string) => void} emit
 * @param {(value: string) => void} live
 * @returns {object} The control: play(), stop(), reset(), isPlaying(), remove().
 */
export function autoplay(api, value, cls, labels, emit, live) {
	const options = { delay: 4000, stopOnInteraction: true, stopOnMouseEnter: false, stopOnFocusIn: true, stopOnLastSnap: false, playOnInit: true, instant: false, ...(value > 0 ? { delay: value } : value) };

	let timer = 0,
		own = false;

	// The delay: data-delay on the selected slide, one value for each snap, or one value
	function delay() {
		const value = api.slideNodes()[api.selectedSlide()]?.dataset.delay || options.delay;
		return +(Array.isArray(value) ? value[api.selectedSnap()] : value);
	}

	function reset() {
		clearTimeout(timer);
		if (!control.paused() && !api.isFit()) {
			timer = setTimeout(next, delay());
		}
	}

	function next() {
		own = true;
		if (api.canGoToNext()) {
			api.goToNext(options.instant);
		} else if (options.stopOnLastSnap) {
			control.stop();
		} else {
			api.goTo(0, options.instant);
		}
		own = false;
	}

	// A drag, an arrow, a dot or the keyboard stops the autoplay. With stopOnInteraction: false, the timer starts again at "settle".
	function interact() {
		if (!own) {
			clearTimeout(timer);
			if (options.stopOnInteraction) {
				control.stop();
			}
		}
	}

	const control = controller(api, 'autoplay', options, cls, labels, emit, live, { play: reset, stop: () => clearTimeout(timer), pause: reset }),
		remove = control.remove;

	api.on('settle', reset);
	api.on('select', interact);
	api.on('pointerdown', interact);

	control.reset = reset;
	control.remove = () => {
		remove();
		api.off('settle', reset);
		api.off('select', interact);
		api.off('pointerdown', interact);
	};

	return control;
}
