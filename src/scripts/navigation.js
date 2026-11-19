/*
 * Navigation: the arrows, the dots, and the link to another carousel (the sync option).
 *
 * Each feature takes the context of a carousel (see carousel.js). It returns nothing if its option is off, or an object with remove().
 */

import { bind, create, createButton, optionElement, setAttribute, setClass, setStyle } from './markup.js';

// The state classes of the 5 dots of the zoom, from the left
const STATES = ['first', 'prev', 'current', 'next', 'last'];

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
		// The class of each dot
		marks = [],
		// dotsStyle: 'zoom': a window of 5 dots, with a track that slides in it and a marker of the selected dot. 'glide': the zoom, and the marker
		// stretches on its way. 'all': all dots, directly in the window, and the selected dot gets a class.
		style = options.dotsStyle,
		zoom = style !== 'all',
		glide = style === 'glide',
		reduced = glide && matchMedia('(prefers-reduced-motion: reduce)'),
		list = box && create('div', cls.dots + (zoom ? (glide ? ' ' + cls.dotsGlide : '') : ' ' + cls.dotsAll)),
		track = list && (zoom ? create('div', cls.dotsTrack) : list),
		marker = list && zoom && create('span', cls.dotsMarker);

	// The dot under the marker
	let shown = -1;

	if (!arrows && !box) {
		return;
	}

	// Add the window of the dots now: its CSS height is fixed, so the dots that the first measure adds do not shift the page
	if (marker) {
		track.append(marker);
		list.append(track);
	}
	if (list) {
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
			marks.length = dots.length;
		}

		while (dots.length < count) {
			const index = dots.length,
				dot = createButton(cls.dot, context.container, labels.dot.replace('%d', index + 1), () => api.goToSnap(index));
			dots.push(dot);
			track.append(dot);
		}

		if (!list.isConnected) {
			box.append(list);
		}

		// The zoom effect: the 5 dots around the selected dot get state classes, and the window hides the other dots: they are out of the tab order.
		// With dotsStyle: 'all', only the selected dot gets a class: each change of a class makes the browser calculate the style of the dot again.
		dots.forEach((dot, index) => {
			const name = ((zoom || index === selected) && cls[STATES[index - selected + 2]]) || '';

			if (marks[index] !== name) {
				setClass(dot, marks[index], false);
				setClass(dot, name, true);
				setAttribute(dot, 'aria-current', index === selected && 'true');
				setAttribute(dot, 'tabindex', zoom && !name && '-1');
				marks[index] = name;
			}
		});

		// Center the group of up to 5 dots in the window, and move the marker to the selected dot. The CSS moves the track and the marker with "translate".
		// Each variable is on the element that uses it: a variable on the window makes the browser calculate the style of all dots again.
		if (zoom) {
			setStyle(track, '--better-shift', 2 - (Math.max(0, selected - 2) + Math.min(count - 1, selected + 2)) / 2);
			setStyle(marker, '--better-dot', selected);

			// dotsStyle: 'glide': the marker stretches along the axis on its way, more for a longer way. The animation of "scale" runs on the compositor
			// with the "translate" transition, and has the same duration and curve.
			if (glide && shown >= 0 && shown !== selected && !reduced.matches) {
				const stretch = 1 + Math.min(Math.abs(selected - shown), 3) * 0.5;
				marker.animate([{ scale: 1 }, { scale: context.geo().axis === 'x' ? stretch + ' 0.8' : '0.8 ' + stretch, offset: 0.35 }, { scale: 1 }], { duration: 400, easing: 'ease' });
			}
			shown = selected;
		}
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
