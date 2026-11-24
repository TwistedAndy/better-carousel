import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alignOffset, columns, compute, groups, inView, nearestSnap, physicalSnap, progress, snapOfSlide, snapPosition, snaps, targetLocation } from '../src/scripts/geometry.js';

// The %item model: 300 px slides with a 20 px right margin, in a 940 px viewport (3 slides)
const row = (count, size = 300, gap = 20) => Array.from({ length: count }, (item, index) => ({ start: index * (size + gap), end: index * (size + gap) + size }));

const view = 940;

const base = { view, slidesPerSnap: 1, containScroll: 'trimSnaps' };

test('center: the slide center is at the viewport center, with no half-gap offset', () => {
	const slides = row(6),
		result = snaps({ ...base, slides, align: 'center', containScroll: false });

	result.snaps.forEach((snap, index) => {
		const slide = slides[index];
		assert.equal((slide.start + slide.end) / 2 + snap.location, view / 2);
		assert.equal(snap.slide, index);
	});
});

test('center with trimSnaps: merged edge snaps and the active slide of each snap', () => {
	const slides = row(6),
		result = snaps({ ...base, slides, align: 'center' });

	assert.deepEqual(result.snaps.map((snap) => snap.location), [0, -320, -640, -960]);
	assert.deepEqual(result.snaps.map((snap) => snap.slide), [1, 2, 3, 4]);
	assert.equal(result.max, 0);
	assert.equal(result.min, -960);
	assert.deepEqual(slides.map((slide, index) => snapOfSlide({ ...result, slides, view, align: 'center' }, index)), [0, 0, 1, 2, 3, 3]);
});

test('center with keepSnaps: one snap for each slide, clamped', () => {
	const slides = row(6),
		result = snaps({ ...base, slides, align: 'center', containScroll: 'keepSnaps' });

	assert.deepEqual(result.snaps.map((snap) => snap.location), [0, 0, -320, -640, -960, -960]);
	assert.equal(snapOfSlide({ ...result, slides, view, align: 'center' }, 0), 0);
});

test('containScroll false: the limits are the first and the last snap', () => {
	const slides = row(6),
		result = snaps({ ...base, slides, align: 'center', containScroll: false });

	assert.equal(result.max, 320);
	assert.equal(result.min, -1280);
	assert.equal(result.snaps.length, 6);
});

test('start and end alignment', () => {
	const slides = row(6),
		start = snaps({ ...base, slides, align: 'start' }),
		end = snaps({ ...base, slides, align: 'end' });

	assert.deepEqual(start.snaps.map((snap) => snap.location), [0, -320, -640, -960]);
	assert.deepEqual(start.snaps.map((snap) => snap.slide), [0, 1, 2, 3]);
	assert.deepEqual(end.snaps.map((snap) => snap.location), [0, -320, -640, -960]);
	assert.deepEqual(end.snaps.map((snap) => snap.slide), [2, 3, 4, 5]);
});

test('align function', () => {
	assert.equal(alignOffset((viewSize, snapSize) => viewSize - snapSize - 10, 940, 300, 0), 630);
});

test('center with trimSnaps: each trimmed end snap takes a slide on its own side', () => {
	// 4 slides in the viewport: the slides 1 and 2, then 5 and 6, have the same distance to the center at the trimmed snaps
	const four = snaps({ ...base, slides: row(8, 220, 20), align: 'center' });
	assert.deepEqual(four.snaps.map((snap) => snap.location), [0, -120, -360, -600, -840, -960]);
	assert.deepEqual(four.snaps.map((snap) => snap.slide), [1, 2, 3, 4, 5, 6]);

	// A narrow first slide: at the first snap, slide 2 is nearest to the center, but the second snap centers it
	const narrow = [{ start: 0, end: 100 }, ...row(4).map((slide) => ({ start: slide.start + 120, end: slide.end + 120 }))],
		result = snaps({ ...base, slides: narrow, align: 'center' });
	assert.deepEqual(result.snaps.map((snap) => snap.location), [0, -120, -440]);
	assert.deepEqual(result.snaps.map((snap) => snap.slide), [1, 2, 3]);
});

test('2-row grid: columns, snaps, the top slide wins, and the trimmed end snap takes the next column', () => {
	// Column pitch 110 px: a 2 x 2 slide, then 4 single slides in 2 columns, then a 2 x 2 slide
	const slides = [
		{ start: 0, end: 210 },
		{ start: 220, end: 320 },
		{ start: 220, end: 320 },
		{ start: 330, end: 430 },
		{ start: 330, end: 430 },
		{ start: 440, end: 650 },
		{ start: 660, end: 760 },
		{ start: 660, end: 760 }
	];

	assert.equal(columns(slides).length, 5);

	const result = snaps({ ...base, view: 300, slides, align: 'start' });

	assert.deepEqual(result.snaps.map((snap) => snap.location), [0, -220, -330, -440, -460]);
	assert.deepEqual(result.snaps.map((snap) => snap.slide), [0, 1, 3, 5, 6]);
});

test('slidesPerSnap: a number and auto', () => {
	const slides = row(6);

	assert.deepEqual(snaps({ ...base, slides, align: 'start', slidesPerSnap: 2 }).snaps.map((snap) => snap.location), [0, -640, -960]);
	assert.equal(groups(columns(slides), view, 'auto').length, 2);
	assert.deepEqual(snaps({ ...base, slides, align: 'start', slidesPerSnap: 'auto' }).snaps.map((snap) => snap.location), [0, -960]);
});

test('loop snaps: no clamp and the last snap is not a copy of the first', () => {
	const slides = row(6),
		result = snaps({ ...base, slides, align: 'center', period: 1920 });

	assert.deepEqual(result.snaps.map((snap) => snap.location), [320, 0, -320, -640, -960, -1280]);
	assert.equal(result.max, 320);
	assert.deepEqual(result.snaps.map((snap) => snap.slide), [0, 1, 2, 3, 4, 5]);
});

test('loop: target locations and the nearest snap modulo the period', () => {
	assert.equal(targetLocation(320, -1300, 1920), -1600);
	assert.equal(targetLocation(320, -1280, 1920, 1), -1600);
	assert.equal(targetLocation(-1280, 320, 1920, -1), 640);
	assert.equal(nearestSnap([{ location: 320 }, { location: -1280 }], -1500, 1920), 0);
});

test('progress and slides in view', () => {
	assert.equal(progress(-480, { min: -960, max: 0 }), 0.5);
	assert.equal(progress(-480, { min: 0, max: 0, cycle: 1920 }), 0.25);
	// With the loop, the progress starts at the first snap, also if its location is not 0
	assert.equal(progress(-160, { min: 0, max: 320, cycle: 1920 }), 0.25);
	assert.equal(progress(320, { min: 0, max: 320, cycle: 1920 }), 0);

	const slides = row(6);

	assert.deepEqual(inView({ slides, view }, -160, 0), [0, 1, 2, 3]);
	assert.deepEqual(inView({ slides, view }, -160, 1), [1, 2]);
	// A slide that is larger than the viewport is fully in view when it fills the viewport
	assert.deepEqual(inView({ slides: [{ start: 0, end: 500 }], view: 400 }, -50, 1), [0]);
	assert.deepEqual(inView({ slides: [{ start: 0, end: 500 }], view: 400 }, 50, 1), []);
	assert.deepEqual(inView({ slides, view, period: 1920 }, 0, 0), [0, 1, 2]);
	assert.deepEqual(inView({ slides, view, period: 1920 }, 320, 0), [0, 1, 5]);
});

test('snap position: the fraction between two snaps, clamped at the ends, and modulo the period in loop mode', () => {
	const list = [0, -320, -640, -960].map((location) => ({ location })),
		loop = [320, 0, -320, -640, -960, -1280].map((location) => ({ location }));

	assert.equal(snapPosition(list, -160, 0), 0.5);
	assert.equal(snapPosition(list, -960, 0), 3);
	assert.equal(snapPosition(list, 100, 0), 0);
	assert.equal(snapPosition(list, -1200, 0), 3);
	assert.equal(snapPosition(loop, 160, 1920), 0.5);
	// After the last snap, the motion goes to the first snap of the next period
	assert.equal(snapPosition(loop, -1440, 1920), 5.5);
	assert.equal(snapPosition(loop, 480, 1920), 5.5);
});

// The arguments of compute(): a horizontal row with a 20 px gap
const layout = { axis: 'x', align: 'start', rtl: false, sign: 1, gap: 20 },
	options = { loop: false, clones: 'auto', slidesPerSnap: 1, containScroll: 'trimSnaps', autoScroll: false },
	rects = (count, size = view) => ({ view, slides: row(count), gap: 20, area: { start: 0, size } });

test('compute: slides that fit get one snap at 0', () => {
	const geo = compute(layout, rects(3), 3, options);

	assert.equal(geo.fit, true);
	assert.deepEqual(geo.snaps, [{ location: 0, slide: 0 }]);
	assert.deepEqual(geo.map, [0]);
});

test('compute: a loop with no clones gets the period and one logical snap for each snap', () => {
	const geo = compute(layout, rects(6), 6, { ...options, loop: true });

	assert.equal(geo.period, 1920);
	assert.equal(geo.snaps.length, 6);
	assert.deepEqual(geo.logical, [0, 1, 2, 3, 4, 5]);
	assert.deepEqual(geo.map, [0, 1, 2, 3, 4, 5]);
});

test('compute: a loop that needs clones asks for them, then maps each clone snap to its logical snap', () => {
	const loop = { ...options, loop: true };

	assert.deepEqual(compute(layout, rects(4, 1000), 4, loop), { copies: 1 });

	const geo = compute(layout, rects(8, 1000), 4, loop);

	assert.equal(geo.period, 2560);
	assert.equal(geo.cycle, 1280);
	assert.deepEqual(geo.logical, [0, 1, 2, 3]);
	assert.deepEqual(geo.map, [0, 1, 2, 3, 0, 1, 2, 3]);
	// A logical snap has two snaps: the one nearest to the location wins
	assert.equal(physicalSnap(geo, 1, 0), 1);
	assert.equal(physicalSnap(geo, 1, -1500), 5);
	// A logical snap out of range goes to the last or the first logical snap, not to a clone snap of another logical snap
	assert.equal(physicalSnap(geo, 20, 0), 7);
	assert.equal(geo.map[physicalSnap(geo, 4, 0)], 3);
	assert.equal(geo.map[physicalSnap(geo, -2, 0)], 0);
	assert.equal(physicalSnap(geo, NaN, 0), 0);
});

test('compute: an auto scroll loop with no slide that shows fits, so it gets one snap', () => {
	const hidden = rects(4).slides.map(() => ({ start: 0, end: 0, hidden: true })),
		geo = compute(layout, { ...rects(4), slides: hidden }, 4, { ...options, loop: true, autoScroll: true });

	assert.equal(geo.fit, true);
	assert.equal(geo.snaps.length, 1);
});
