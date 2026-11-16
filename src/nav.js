import { create, setAttribute, setClass } from './dom.js';

/**
 * Find the element for the arrows or the dots.
 * A selector is searched in the root and then in each ancestor of the root, so that it finds a heading in the section of the carousel.
 *
 * @param {boolean|string|Element} value The "arrows" or "dots" option.
 * @param {HTMLElement} root
 * @returns {Element|null}
 */
export function place(value, root) {
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

/**
 * Make the arrows and the dots of a carousel. They update on the carousel events.
 *
 * @param {object} api
 * @param {HTMLElement} root
 * @param {object} cls The class names.
 * @param {object} options
 * @returns {() => void} A function that removes the arrows and the dots.
 */
export function nav(api, root, cls, options) {
	const labels = options.labels,
		arrows = place(options.arrows, root),
		box = place(options.dots, root),
		buttons = [],
		dots = [],
		list = box && create('div', cls.dots);

	let marks = new Map();

	if (arrows) {
		[['prev', 'goToPrev'], ['next', 'goToNext']].forEach(([key, method]) => {
			const button = create('button', cls.button + ' ' + cls[key]);
			button.type = 'button';
			button.setAttribute('aria-label', labels[key]);
			button.setAttribute('aria-controls', api.containerNode().id);
			button.addEventListener('click', () => api[method]());
			buttons.push(button);
		});
	}

	function update() {
		const fit = api.isFit(),
			count = fit ? 0 : api.snapList().length,
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
			dot.setAttribute('aria-controls', api.containerNode().id);
			// The window of the dots hides the dots out of the zoom: keep them out of the tab order
			dot.tabIndex = -1;
			dot.addEventListener('click', () => api.goTo(index));
			dots.push(dot);
			list.append(dot);
		}

		if (!list.isConnected) {
			box.append(list);
		}

		// The zoom effect: the 5 dots around the selected dot get state classes
		const next = new Map();

		['first', 'before', 'current', 'after', 'last'].forEach((key, offset) => {
			if (dots[selected + offset - 2]) {
				next.set(selected + offset - 2, cls[key]);
			}
		});

		marks.forEach((name, index) => {
			if (next.get(index) !== name && dots[index]) {
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

	const names = ['init', 'reinit', 'resize', 'select', 'slideschanged'];

	names.forEach((name) => api.on(name, update));

	return () => {
		names.forEach((name) => api.off(name, update));
		buttons.forEach((button) => button.remove());
		list?.remove();
	};
}
