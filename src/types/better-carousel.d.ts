// The types of Better Carousel. The members of Options come from scripts/reference.js: run "npm run docs" after a change there.
// The other types are written by hand. tests/docs.test.js compares the options and the events with the code.

/** The options of the autoplay. */
export interface AutoplayOptions {
	/** The time on each slide, in ms, or an array with one time for each snap. A `data-delay` attribute on a slide sets the time of that slide. @default 4000 */
	delay?: number | number[];
	/** A drag, an arrow or a dot stops the autoplay. @default true */
	stopOnInteraction?: boolean;
	/** Pause while the mouse is on the carousel. @default false */
	stopOnMouseEnter?: boolean;
	/** Pause while the keyboard focus is in the carousel. @default true */
	stopOnFocusIn?: boolean;
	/** Stop at the last snap, if `loop` is `false`. @default false */
	stopOnLastSnap?: boolean;
	/** Start with the carousel. @default true */
	playOnInit?: boolean;
	/** Jump to the next slide with no motion. @default false */
	instant?: boolean;
	/**
	 * Show the time to the next slide. The carousel calls this function when the timer starts, with the delay in ms.
	 * The function can return a function that the carousel calls when this timer ends or stops. @default null
	 */
	timer?: ((delay: number, carousel: Carousel) => (() => void) | void) | null;
}

/** The options of the auto scroll. */
export interface AutoScrollOptions {
	/** The speed in px per second. @default 120 */
	speed?: number;
	/** @default 'forward' */
	direction?: 'forward' | 'backward';
	/** The time in ms before the start, and after an interaction. @default 1000 */
	startDelay?: number;
	/** A drag, an arrow or a dot stops the auto scroll. @default true */
	stopOnInteraction?: boolean;
	/** Pause while the mouse is on the carousel. @default false */
	stopOnMouseEnter?: boolean;
	/** Pause while the keyboard focus is in the carousel. @default true */
	stopOnFocusIn?: boolean;
	/** Start with the carousel. @default true */
	playOnInit?: boolean;
}

/** The state that the `progress` callback gets. The carousel uses the same object for each call: read the values during the call. */
export interface ProgressState {
	/** The progress, from 0 to 1. In loop mode, it goes from 1 back to 0. */
	progress: number;
	/** The position between the snaps: 2.4 is between snap 2 and snap 3. */
	snap: number;
}

/** The state that the `offset` callback gets for a slide. The carousel uses the same object for each call: read the values during the call. */
export interface OffsetState {
	/** The slide, or a clone of it. */
	slide: HTMLElement;
	/** The slide index. A clone gives the index of its slide. */
	index: number;
	/** The distance from the snap position of the slide, in slides: 0 at the snap position, 1 for the next slide, -1 for the previous slide. */
	offset: number;
	/** The same distance in px, on the screen: a positive value is to the right or down. */
	distance: number;
	/** The size of the slide on the main axis, in px. */
	size: number;
	/** The part of the slide in the viewport, from 0 to 1. */
	visible: number;
}

/** The texts for screen readers. `%d` is the slide number, and `%n` is the number of slides. */
export interface Labels {
	/** @default 'Carousel' */
	carousel?: string;
	/** @default '%d of %n' */
	slide?: string;
	/** @default 'Previous slide' */
	prev?: string;
	/** @default 'Next slide' */
	next?: string;
	/** @default 'Go to slide %d' */
	dot?: string;
	/** @default 'Start the slide show' */
	play?: string;
	/** @default 'Stop the slide show' */
	pause?: string;
}

/** The class names to change. `prefix` sets the names that the object does not change. */
export interface ClassNames {
	/** @default 'better' */
	prefix?: string;
	root?: string;
	viewport?: string;
	container?: string;
	/** On the root, if not all slides fit. */
	dynamic?: string;
	horizontal?: string;
	vertical?: string;
	/** On the root, with `autoHeight`. */
	autoHeight?: string;
	button?: string;
	prev?: string;
	next?: string;
	dots?: string;
	dot?: string;
	play?: string;
	/** @default 'clone' */
	clone?: string;
	/** The selected slide. @default 'active' */
	active?: string;
	/** The slides in view. The default is an empty string: no class. */
	inView?: string;
	/** @default 'dragging' */
	dragging?: string;
	/** @default 'playing' */
	playing?: string;
	/** The dot two places before the selected dot. @default 'first' */
	first?: string;
	/** The dot before the selected dot. @default 'prev' */
	before?: string;
	/** The selected dot. @default 'current' */
	current?: string;
	/** The dot after the selected dot. @default 'next' */
	after?: string;
	/** The dot two places after the selected dot. @default 'last' */
	last?: string;
}

/** The options. Set them in the call, in the `data-carousel` attribute as JSON, or in `BetterCarousel.defaults`. */
export interface Options {
	// <!-- generated:options -->
	/** The axis of the motion. With `'auto'`, the CSS of the container sets the axis. @default 'auto' @see {@link https://twistedandy.github.io/better-carousel/#switch | example} */
	axis?: 'x' | 'y' | 'auto';
	/** The position of the selected snap in the viewport. A function gets `(viewSize, snapSize, index)` and returns the offset in px. With `'auto'`, `justify-content` sets the alignment. @default 'auto' @see {@link https://twistedandy.github.io/better-carousel/#center | example} */
	align?: 'start' | 'center' | 'end' | 'auto' | ((viewSize: number, snapSize: number, index: number) => number);
	/** The text direction. With `'auto'`, the CSS `direction` sets it. @default 'auto' @see {@link https://twistedandy.github.io/better-carousel/#rtl | example} */
	direction?: 'ltr' | 'rtl' | 'auto';
	/** The first slide comes after the last slide. @default false @see {@link https://twistedandy.github.io/better-carousel/#loop | example} */
	loop?: boolean;
	/** `'auto'`: add clones only if the loop needs them. `'fill'`: add clones that fill the window. `false`: add no clones. @default 'auto' @see {@link https://twistedandy.github.io/better-carousel/#clones | example} */
	clones?: 'auto' | 'fill' | false;
	/** `true`: glide after a drag and stop at any position. `'snap'`: glide and stop at the nearest snap. @default false @see {@link https://twistedandy.github.io/better-carousel/#free | example} */
	dragFree?: boolean | 'snap';
	/** The length of the glide after a fast drag: the glide distance is divided by this number. `2`: half the distance. `0.5`: 2 times the distance. It also changes how many snaps a flick moves. The value must be more than 0. @default 1 @see {@link https://twistedandy.github.io/better-carousel/#free | example} */
	friction?: number;
	/** `'trimSnaps'`: no empty space at the ends. `'keepSnaps'`: no empty space, but keep a snap for each group. `false`: snaps can show empty space. @default 'trimSnaps' @see {@link https://twistedandy.github.io/better-carousel/#contain | example} */
	containScroll?: 'trimSnaps' | 'keepSnaps' | false;
	/** The number of slides in one snap. `'auto'`: the slides that fit in the viewport. @default 1 @see {@link https://twistedandy.github.io/better-carousel/#groups | example} */
	slidesToScroll?: number | 'auto';
	/** A fast flick can move more than one snap. `false`: one snap. A number: the maximum number of snaps. @default true @see {@link https://twistedandy.github.io/better-carousel/#skip | example} */
	skipSnaps?: boolean | number;
	/** The distance in px that the pointer moves before a drag starts. @default 10 */
	dragThreshold?: number;
	/** The duration of a motion by one snap, in ms. A longer motion takes more time, to a maximum of 2 times this value. @default 400 @see {@link https://twistedandy.github.io/better-carousel/#options-usage | example} */
	duration?: number;
	/** The index of the snap at the start. @default 0 @see {@link https://twistedandy.github.io/better-carousel/#options-usage | example} */
	startSnap?: number;
	/** `true`: start when the carousel comes within one screen of the view. A number: the distance in px. @default false @see {@link https://twistedandy.github.io/better-carousel/#lazy | example} */
	lazy?: boolean | number;
	/** Drag with the mouse, the pen and the finger. @default true */
	draggable?: boolean;
	/** The mouse wheel moves a vertical carousel. `'both'`: also a horizontal carousel. `false`: the wheel does not move the carousel. @default true @see {@link https://twistedandy.github.io/better-carousel/#vertical | example} */
	wheel?: boolean | 'both';
	/** Measure again when a size changes. @default true @see {@link https://twistedandy.github.io/better-carousel/#options-usage | example} */
	resize?: boolean;
	/** Measure again when the page adds or removes a slide. @default true @see {@link https://twistedandy.github.io/better-carousel/#changes | example} */
	slideChanges?: boolean;
	/** Go to a slide when it gets the keyboard focus. @default true @see {@link https://twistedandy.github.io/better-carousel/#controls | example} */
	focus?: boolean;
	/** The part of a slide, from 0 to 1, that must show for `slidesInView()`. @default 0 @see {@link https://twistedandy.github.io/better-carousel/#options-usage | example} */
	inViewThreshold?: number;
	/** `false`: do not start the carousel. Use it in `breakpoints`. @default true @see {@link https://twistedandy.github.io/better-carousel/#breakpoints | example} */
	active?: boolean;
	/** The options for media queries: `{ '(min-width: 768px)': { loop: true } }`. @default {} @see {@link https://twistedandy.github.io/better-carousel/#breakpoints | example} */
	breakpoints?: Record<string, Options>;
	/** The selector of the container, if the element is the root. @default null */
	container?: string | null;
	/** The selector of the slides. With `null`, all children of the container are slides. @default null */
	slides?: string | null;
	/** Add the root and the viewport if the page does not have them. @default true @see {@link https://twistedandy.github.io/better-carousel/#options-usage | example} */
	wrap?: boolean;
	/** Add the arrows to the root. `false`: no arrows. An element or a selector: add the arrows to that element. @default true @see {@link https://twistedandy.github.io/better-carousel/#heading | example} */
	arrows?: boolean | Element | string;
	/** Add the dots. The values are the same as for `arrows`. @default true @see {@link https://twistedandy.github.io/better-carousel/#heading | example} */
	dots?: boolean | Element | string;
	/** The texts for screen readers: `carousel`, `slide` (`'%d of %n'`), `prev`, `next`, `dot` (`'Go to slide %d'`), `play`, `pause`. `%d` is the slide number, and `%n` is the number of slides. @see {@link https://twistedandy.github.io/better-carousel/#accessibility | example} */
	labels?: Labels;
	/** A class prefix such as `'embla'`, or an object with the names to change. The Classes table gives all names. @default null @see {@link https://twistedandy.github.io/better-carousel/#embla | example} */
	classes?: string | ClassNames | null;
	/** The prefix of the state classes, such as `'is_'`. @default '' @see {@link https://twistedandy.github.io/better-carousel/#embla | example} */
	state?: string;
	/** Another carousel, its container or a selector. This carousel follows the selected slide of the other carousel. A click on a slide selects it in the other carousel. @default null @see {@link https://twistedandy.github.io/better-carousel/#product | example} */
	sync?: Carousel | Element | string | null;
	/** Go to the next slide after a delay. `true`, a delay in ms, or an object. @default false @see {@link https://twistedandy.github.io/better-carousel/#autoplay | example} */
	autoplay?: boolean | number | AutoplayOptions;
	/** Move the slides at a constant speed. `true`, a speed in px/s, or an object. @default false @see {@link https://twistedandy.github.io/better-carousel/#logos | example} */
	autoScroll?: boolean | number | AutoScrollOptions;
	/** The viewport gets the height of the tallest slide in view. @default false @see {@link https://twistedandy.github.io/better-carousel/#height | example} */
	autoHeight?: boolean;
	/** Follow the progress, from 0 to 1. `true` sets `--better-progress` on the root. A function gets `{ progress, snap }` on each frame of a motion. See Progress and offset. @default false */
	progress?: boolean | ((state: ProgressState, carousel: Carousel) => void);
	/** Follow the distance of each slide from its snap position, in slides. `true` sets `--better-offset` on each slide. A function gets `{ slide, index, offset, distance, size, visible }` for each slide on each frame of a motion. @default false */
	offset?: boolean | ((state: OffsetState, carousel: Carousel) => void);
	// <!-- /generated -->
}

/** The names of the events. */
export type EventName =
	| 'init'
	| 'reinit'
	| 'resize'
	| 'select'
	| 'scroll'
	| 'settle'
	| 'pointerdown'
	| 'pointerup'
	| 'slidesinview'
	| 'slideschanged'
	| 'slidefocus'
	| 'autoplay:play'
	| 'autoplay:stop'
	| 'autoscroll:play'
	| 'autoscroll:stop'
	| 'destroy';

export type EventHandler = (carousel: Carousel, name: EventName) => void;

/** The control of the auto scroll. */
export interface PlayControl {
	play(): void;
	stop(): void;
	isPlaying(): boolean;
}

/** The control of the autoplay. */
export interface AutoplayControl extends PlayControl {
	/** Start the delay again. */
	reset(): void;
}

/** A carousel. A snap index and a slide index are different: a snap can show more than one slide. */
export interface Carousel {
	/** Go to a snap. With `instant` set to `true`, jump with no motion. */
	goTo(snap: number, instant?: boolean): void;
	goToNext(instant?: boolean): void;
	goToPrev(instant?: boolean): void;
	/** Go to the snap that shows a slide. This slide becomes the selected slide. */
	goToSlide(slide: number, instant?: boolean): void;
	/** `true` if a next snap exists. In a loop, `true` if not all slides fit. */
	canGoToNext(): boolean;
	/** `true` if a previous snap exists. In a loop, `true` if not all slides fit. */
	canGoToPrev(): boolean;
	/** The index of the selected snap. */
	selectedSnap(): number;
	/** The index of the snap before the selected snap. */
	previousSnap(): number;
	/** The index of the selected slide. With `sync`, the slide that is selected in the other carousel. */
	selectedSlide(): number;
	/** The index of the snap that shows a slide. */
	snapOfSlide(slide: number): number;
	/** The progress of each snap, from 0 to 1. */
	snapList(): number[];
	/** The progress now, from 0 to 1, also during a motion. */
	scrollProgress(): number;
	/** The indexes of the slides in view. */
	slidesInView(): number[];
	/** The slides. The list does not include the clones. */
	slideNodes(): HTMLElement[];
	rootNode(): HTMLElement;
	viewportNode(): HTMLElement;
	containerNode(): HTMLElement;
	/** `true` if all slides fit in the viewport. */
	isFit(): boolean;
	/** The options that apply now, after the breakpoints. */
	options(): Options;
	/** Merge new options and start again. The selected slide stays. */
	reInit(options?: Options): void;
	/** Stop the carousel and restore the markup. */
	destroy(): void;
	on(name: EventName, handler: EventHandler): Carousel;
	off(name: EventName, handler: EventHandler): Carousel;
	/** Only with the `autoplay` option. */
	autoplay?: AutoplayControl;
	/** Only with the `autoScroll` option. */
	autoScroll?: PlayControl;
}

declare const BetterCarousel: {
	/** Start a carousel on a container or on its viewport. If the element has a carousel, return that carousel. */
	(element: HTMLElement, options?: Options): Carousel;
	/** The options for all carousels. Set it before you start the carousels. */
	defaults: Options;
	/** The carousel of a root, a viewport or a container. */
	get(element: Element): Carousel | undefined;
	/** Start a carousel on each element that matches the selector. */
	initAll(selector: string, options?: Options): Carousel[];
};

export default BetterCarousel;
