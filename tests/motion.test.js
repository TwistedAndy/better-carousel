import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bezier, EASE, GLIDE, goToDuration, releaseDuration, releaseTarget, velocity } from '../src/scripts/motion.js';

// Find the easing value by a dense sample of the curve
const sample = ([x1, y1, x2, y2], x) => {
	const at = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
	let best = 0;
	for (let t = 0; t <= 1; t += 1e-5) {
		if (Math.abs(at(x1, x2, t) - x) < Math.abs(at(x1, x2, best) - x)) {
			best = t;
		}
	}
	return at(y1, y2, best);
};

test('easing', () => {
	const ease = bezier(EASE);

	assert.equal(ease(0), 0);
	assert.equal(ease(1), 1);

	for (const x of [0.1, 0.5, 0.9]) {
		assert.ok(Math.abs(ease(x) - sample(EASE, x)) < 1e-3, 'EASE at ' + x);
		assert.ok(Math.abs(bezier(GLIDE)(x) - sample(GLIDE, x)) < 1e-3, 'GLIDE at ' + x);
	}

	assert.ok(Math.abs(bezier([0.25, 0.25, 0.75, 0.75])(0.5) - 0.5) < 1e-4);
});

test('durations', () => {
	assert.equal(goToDuration(400, 1), 400);
	assert.equal(goToDuration(400, 2), 800);
	assert.equal(goToDuration(400, 10), 800);
	assert.equal(releaseDuration(-300, -1, GLIDE, 400), 900);
	assert.equal(releaseDuration(-300, 1, GLIDE, 400), 400);
	assert.equal(releaseDuration(-300, -0.01, GLIDE, 400), 400);
	assert.equal(releaseDuration(-10, -5, GLIDE, 400), 200);
});

test('release target: the friction divides the glide distance', () => {
	const snaps = [0, -320, -640, -960, -1280, -1600].map((location) => ({ location })),
		args = { snaps, min: -1600, max: 0, current: 0, from: 0, location: -100, velocity: -2, dragFree: true };

	assert.deepEqual(releaseTarget(args), { location: -750, snap: 2 });
	assert.deepEqual(releaseTarget({ ...args, friction: 2 }), { location: -425, snap: 1 });
	assert.deepEqual(releaseTarget({ ...args, friction: 0.5 }), { location: -1400, snap: 4 });
});

test('release target: a number in skipSnaps limits the snaps of one flick', () => {
	const snaps = [0, -320, -640, -960, -1280, -1600].map((location) => ({ location })),
		args = { snaps, min: -1600, max: 0, current: 1, from: -320 };

	assert.deepEqual(releaseTarget({ ...args, location: -400, velocity: -5, skipSnaps: true }), { location: -1600, snap: 5 });
	assert.deepEqual(releaseTarget({ ...args, location: -400, velocity: -5, skipSnaps: 2 }), { location: -960, snap: 3 });
	assert.deepEqual(releaseTarget({ ...args, location: -300, velocity: 5, skipSnaps: 2 }), { location: 0, snap: 0 });

	// A slow drag still goes to the nearest snap
	assert.deepEqual(releaseTarget({ ...args, location: -700, velocity: 0, skipSnaps: 2 }), { location: -640, snap: 2 });

	// Loop: the limit goes across the end of the period
	assert.deepEqual(releaseTarget({ ...args, current: 5, from: -1600, location: -1650, velocity: -5, period: 1920, skipSnaps: 2 }), { location: -2240, snap: 1 });
});

test('velocity from the last 100 ms', () => {
	assert.equal(velocity([[0, 0], [10, 16], [20, 32], [30, 48]]), 30 / 48);
	assert.equal(velocity([[0, 0], [100, 500], [110, 516]]), 10 / 16);
	assert.equal(velocity([[5, 10]]), 0);
});

test('release target', () => {
	const snaps = [0, -320, -640, -960].map((location) => ({ location })),
		args = { snaps, min: -960, max: 0, current: 1, from: -320 };

	// A short slow drag goes back
	assert.deepEqual(releaseTarget({ ...args, location: -330, velocity: -0.1 }), { location: -320, snap: 1 });

	// A drag of more than 20 px or a fast flick goes one snap in the drag direction
	assert.deepEqual(releaseTarget({ ...args, location: -350, velocity: -0.1 }), { location: -640, snap: 2 });
	assert.deepEqual(releaseTarget({ ...args, location: -325, velocity: 1 }), { location: 0, snap: 0 });

	// A long drag does not skip snaps
	assert.deepEqual(releaseTarget({ ...args, location: -900, velocity: -2 }), { location: -640, snap: 2 });

	// skipSnaps goes to the snap nearest to the projected location
	assert.deepEqual(releaseTarget({ ...args, location: -400, velocity: -1.5, skipSnaps: true }), { location: -960, snap: 3 });

	// dragFree stops at the projected location, in the limits
	assert.deepEqual(releaseTarget({ ...args, location: -400, velocity: -0.5, dragFree: true }), { location: -562.5, snap: 2 });
	assert.deepEqual(releaseTarget({ ...args, location: -400, velocity: -5, dragFree: true }), { location: -960, snap: 3 });

	// Loop: the next snap after the last one is the first one, in the forward direction
	const loop = { snaps, current: 3, from: -960, period: 1280 };
	assert.deepEqual(releaseTarget({ ...loop, location: -1000, velocity: -1 }), { location: -1280, snap: 0 });
	assert.deepEqual(releaseTarget({ ...loop, current: 0, from: 0, location: 40, velocity: 1 }), { location: 320, snap: 3 });
});
