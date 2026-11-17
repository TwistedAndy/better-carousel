import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settings } from '../src/scripts/autoplay.js';
import { classNames, defaults, merge } from '../src/scripts/options.js';

test('class names: the root class is the prefix', () => {
	assert.equal(classNames(null, '').root, 'better');
	assert.equal(classNames(null, '').viewport, 'better_viewport');
	assert.equal(classNames('embla', '').root, 'embla');
	assert.equal(classNames('embla', '').dots, 'embla_dots');

	const slider = classNames('slider', '');
	assert.equal(slider.root, 'slider');
	assert.equal(slider.viewport, 'slider_viewport');
	assert.equal(slider.nextButton, 'slider_next');
	assert.equal(slider.next, 'next');
});

test('class names: an object changes only its keys, on top of its prefix', () => {
	const result = classNames({ prefix: 'embla', selected: 'snapped', dots: 'pager' }, 'is_');

	assert.equal(result.root, 'embla');
	assert.equal(result.dots, 'pager');
	assert.equal(result.selected, 'is_snapped');
	assert.equal(result.current, 'is_current');
	assert.equal(result.button, 'embla_button');
	assert.equal(classNames({ inView: 'visible' }, '').inView, 'visible');
});

test('options: the defaults and the merge order', () => {
	assert.equal(defaults.skipSnaps, true);

	const result = merge(defaults, { loop: true, labels: { prev: 'Back' } }, { loop: false });
	assert.equal(result.loop, false);
	assert.equal(result.labels.prev, 'Back');
	assert.equal(result.labels.next, 'Next slide');
});

test('settings: true keeps the defaults, a number sets the key, an object merges', () => {
	const base = { delay: 4000, instant: false };
	assert.deepEqual(settings(base, 'delay', true), base);
	assert.deepEqual(settings(base, 'delay', 2000), { delay: 2000, instant: false });
	assert.deepEqual(settings(base, 'delay', { instant: true }), { delay: 4000, instant: true });
});
