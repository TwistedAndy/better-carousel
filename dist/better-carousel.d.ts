// The types of Better Carousel. This file is written by hand: the build does not make it.
// tests/docs.test.js compares the options and the events with the code.

/** The options of the autoplay. */
export interface AutoplayOptions {
	/** The time on each slide, in ms. A `data-delay` attribute on a slide sets the time of that slide. @default 4000 */
	delay?: number;
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
	/** The axis of the motion. With `'auto'`, the CSS of the container sets the axis. @default 'auto' */
	axis?: 'x' | 'y' | 'auto';
	/** The position of the selected snap in the viewport. A function returns the offset in px. With `'auto'`, `justify-content` sets the alignment. @default 'auto' */
	align?: 'start' | 'center' | 'end' | 'auto' | ((viewSize: number, snapSize: number, index: number) => number);
	/** The text direction. With `'auto'`, the CSS `direction` sets it. @default 'auto' */
	direction?: 'ltr' | 'rtl' | 'auto';
	/** The first slide comes after the last slide. @default false */
	loop?: boolean;
	/** `'auto'`: add clones only if the loop needs them. `'fill'`: add clones that fill the window. `false`: add no clones. @default 'auto' */
	clones?: 'auto' | 'fill' | false;
	/** `true`: glide after a drag and stop at any position. `'snap'`: glide and stop at the nearest snap. @default false */
	dragFree?: boolean | 'snap';
	/** `'trimSnaps'`: no empty space at the ends. `'keepSnaps'`: no empty space, but keep a snap for each group. `false`: snaps can show empty space. @default 'trimSnaps' */
	containScroll?: 'trimSnaps' | 'keepSnaps' | false;
	/** The number of slides in one snap. `'auto'`: the slides that fit in the viewport. @default 1 */
	slidesToScroll?: number | 'auto';
	/** A fast flick can move more than one snap. `false`: one snap. A number: the maximum number of snaps. @default true */
	skipSnaps?: boolean | number;
	/** The distance in px that the pointer moves before a drag starts. @default 10 */
	dragThreshold?: number;
	/** The duration of a motion by one snap, in ms. A longer motion takes more time, to a maximum of 2 times this value. @default 400 */
	duration?: number;
	/** The index of the snap at the start. @default 0 */
	startSnap?: number;
	/** `true`: start when the carousel comes within one screen of the view. A number: the distance in px. @default false */
	lazy?: boolean | number;
	/** Drag with the mouse, the pen and the finger. @default true */
	draggable?: boolean;
	/** The mouse wheel moves a vertical carousel. `'both'`: also a horizontal carousel. @default true */
	wheel?: boolean | 'both';
	/** Measure again when a size changes. @default true */
	resize?: boolean;
	/** Measure again when the page adds or removes a slide. @default true */
	slideChanges?: boolean;
	/** Go to a slide when it gets the keyboard focus. @default true */
	focus?: boolean;
	/** The part of a slide, from 0 to 1, that must show for `slidesInView()`. @default 0 */
	inViewThreshold?: number;
	/** `false`: do not start the carousel. Use it in `breakpoints`. @default true */
	active?: boolean;
	/** The options for media queries: `{ '(min-width: 768px)': { loop: true } }`. @default {} */
	breakpoints?: Record<string, Options>;
	/** The selector of the container, if the element is the root. @default null */
	container?: string | null;
	/** The selector of the slides. With `null`, all children of the container are slides. @default null */
	slides?: string | null;
	/** Add the root and the viewport if the page does not have them. @default true */
	wrap?: boolean;
	/** Add the arrows to the root. `false`: no arrows. An element or a selector: add the arrows to that element. @default true */
	arrows?: boolean | Element | string;
	/** Add the dots. The values are the same as for `arrows`. @default true */
	dots?: boolean | Element | string;
	/** The texts for screen readers. */
	labels?: Labels;
	/** A class prefix such as `'embla'`, or an object with the names to change. @default null */
	classes?: string | ClassNames | null;
	/** The prefix of the state classes, such as `'is_'`. @default '' */
	state?: string;
	/** Another carousel, its container or a selector. This carousel follows the selected slide of the other carousel. @default null */
	sync?: Carousel | Element | string | null;
	/** Go to the next slide after a delay. `true`, a delay in ms, or an object. @default false */
	autoplay?: boolean | number | AutoplayOptions;
	/** Move the slides at a constant speed. `true`, a speed in px/s, or an object. @default false */
	autoScroll?: boolean | number | AutoScrollOptions;
	/** The viewport gets the height of the tallest slide in view. @default false */
	autoHeight?: boolean;
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
