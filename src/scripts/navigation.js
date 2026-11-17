/*
 * Navigation: the arrows, the dots, and the link to another carousel (the sync option).
 *
 * Each feature takes the context of a carousel (see carousel.js). It returns nothing if its option is off, or an object with remove().
 */

import { find } from './carousel.js';
import { create, optionElement, setAttribute, setClass } from './markup.js';

/**
 * Make the arrows and the dots of a carousel. They update on the carousel events.
 *
 * @param {object} context What the features share. See carousel.js.
 * @returns {{remove: () => void}|undefined} remove() removes the arrows and the dots.
 */
export function nav(context) {
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
export function sync(context) {
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
