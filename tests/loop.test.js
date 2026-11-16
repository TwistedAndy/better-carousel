import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canLoop, cloneCount, normalize, pathFits, period, placement, steps } from '../src/loop.js';

const row = (count, size = 300, gap = 20) => Array.from({ length: count }, (item, index) => ({ start: index * (size + gap), end: index * (size + gap) + size }));

const view = 940;

test('period and the loop condition', () => {
	assert.equal(period(0, 1900, 20), 1920);
	assert.equal(canLoop(1920, view, 300), true);
	assert.equal(canLoop(960, view, 300), false);
});

test('clone count', () => {
	assert.equal(cloneCount(period(0, 940, 20), view, 300), 1);
	assert.equal(cloneCount(period(0, 3180, 20), view, 300), 0);
	assert.equal(cloneCount(period(0, 300, 20), view, 300), 3);
	assert.equal(cloneCount(0, view, 300), 0);
});

test('placement at rest: each visible slide is at its correct copy', () => {
	const slides = row(6),
		length = 1920;

	assert.deepEqual(placement(slides, 0, 0, view, length), [0, 0, 0, 0, 0, -1]);

	// At each location, the slides that show cover the viewport with no gap
	for (let location = 0; location > -length; location -= 37) {
		const list = placement(slides, location, location, view, length).map((k, index) => slides[index].start + k * length + location);
		for (let point = 0; point < view; point += 10) {
			assert.ok(list.some((start) => start <= point + 20 && start + 300 >= point), 'gap at ' + point + ', location ' + location);
		}
	}
});

test('path test', () => {
	const slides = row(6);

	assert.equal(pathFits(slides, 0, -320, view, 1920), true);
	assert.equal(pathFits(slides, 0, -1000, view, 1920), false);
});

test('auto scroll steps match the placement at each time', () => {
	const slides = row(6),
		length = 1920;

	for (const direction of [1, -1]) {
		const list = steps(slides, -100, view, length, direction);
		list.forEach((step) => assert.ok(step.offset > 0 && step.offset <= 1));

		for (let time = 0.01; time < 1; time += 0.05) {
			const location = -100 - direction * time * length,
				expected = placement(slides, location, location, view, length);
			list.forEach((step, index) => {
				assert.equal(step.k + (time >= step.offset ? direction : 0), expected[index], 'slide ' + index + ' at ' + time.toFixed(2));
			});
		}
	}
});

test('normalize', () => {
	assert.equal(normalize(0, 1920), 0);
	assert.equal(normalize(-1920, 1920), 0);
	assert.equal(normalize(-2000, 1920), -80);
	assert.equal(normalize(100, 1920), -1820);
});

test('placement with an offset: the window moves with the visible area', () => {
	const slides = row(6),
		length = 1920;

	// A visible area of 1920 px that starts 600 px before the viewport
	assert.deepEqual(placement(slides, 0, 0, 1920, length, -600), [0, 0, 0, 0, -1, -1]);
});
