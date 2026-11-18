/*
 * Navigation: the arrows, the dots, and the link to another carousel (the sync option).
 *
 * Each feature takes the context of a carousel (see carousel.js). It returns nothing if its option is off, or an object with remove().
 */

import { bind, create, createButton, optionElement, setAttribute, setClass, setStyle } from './markup.js';

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
