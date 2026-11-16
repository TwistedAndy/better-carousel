<div align="center">

<a href="https://twistedandy.github.io/better-carousel/"><img src="demo/assets/logo.svg" alt="Better Carousel" width="560" /></a>

<p>A small, fast and accessible JavaScript carousel.<br />The CSS sets the layout, and the motion runs on the compositor, also on slow phones.</p>

[![Gzip size](https://flat.badgen.net/static/gzip/10.4%20KB/green)](dist/better-carousel.min.js)
[![MIT license](https://flat.badgen.net/static/license/MIT/purple)](LICENSE)
[![No dependencies](https://flat.badgen.net/static/dependencies/0/blue)](package.json)

**[Documentation and live examples](https://twistedandy.github.io/better-carousel/)** · [Issues](https://github.com/TwistedAndy/better-carousel/issues)

</div>

## Features

- **Layout from CSS** - The sizes of the slides, the space between them, the axis and the alignment come from your CSS. One carousel can show 1 slide on a phone and 4 slides on a desktop.
- **Smooth** - Each motion is a Web Animations API animation of `translate`. No script runs for each frame, also during the auto scroll.
- **Small** - 10.4 KB gzip with loop, autoplay, auto scroll, auto height, thumbnails and the mouse wheel.
- **Loop** - The loop moves the original slides. It adds clones only if the slides are too few.
- **Vertical and grid** - A column layout makes a vertical carousel. A CSS grid with more rows also works.
- **Accessible** - WCAG 2.1 AA: names for the carousel, the slides and the buttons, the keyboard focus, a live region and reduced motion.
- **Lazy start** - A carousel out of view starts when it comes near the screen.

## Install

Install the package from npm. Then import the script and the stylesheet:

```sh
npm install better-carousel
```

```js
import BetterCarousel from 'better-carousel'
import 'better-carousel/css'
```

Or add the files to the page with script and link tags. The script adds the global `BetterCarousel` function.

```html
<link rel="stylesheet" href="dist/better-carousel.css" />
<script src="dist/better-carousel.min.js"></script>
```

| File                          | Format         | Use                                                    |
| ----------------------------- | -------------- | ------------------------------------------------------ |
| `dist/better-carousel.min.js` | IIFE, minified | For a script tag. It adds the global function.         |
| `dist/better-carousel.js`     | ES module      | For a bundler.                                         |
| `dist/better-carousel.css`    | CSS            | The styles with the default class names.               |
| `src/better-carousel.scss`    | SCSS           | The styles with your class names (`better-carousel/scss`). |

## Quick start

1. Put the slides into a container.
2. Give the container a flex row with CSS. Give each slide a width and a right margin.
3. Start the carousel.

```html
<div class="items carousel">
  <div class="item"><img src="photo-1.jpg" alt="Photo 1" /></div>
  <div class="item"><img src="photo-2.jpg" alt="Photo 2" /></div>
  <div class="item"><img src="photo-3.jpg" alt="Photo 3" /></div>
  <div class="item"><img src="photo-4.jpg" alt="Photo 4" /></div>
</div>
```

```css
/* The negative margin of the container cancels the margin of the last slide in the row */
.items {
  --gap: 20px;
  display: flex;
  width: calc(100% + var(--gap));
  margin-right: calc(-1 * var(--gap));
}

.items .item {
  flex: none;
  width: calc(100% / 3 - var(--gap));
  margin-right: var(--gap);
}
```

```js
// One carousel
const carousel = BetterCarousel(document.querySelector('.items'), { loop: true })

// All carousels on the page
const carousels = BetterCarousel.initAll('.items.carousel')
```

The library puts the container into a root and a viewport. Then it adds the arrows and the dots to the root. The [documentation](https://twistedandy.github.io/better-carousel/) has more examples: center alignment, vertical carousels, grids, free drag, thumbnails, autoplay, auto scroll and auto height.

## The layout comes from CSS

The library does not set the size of the slides or the space between them. It reads these values from the CSS and moves only the container.

| The CSS of the container                                        | The result                                     |
| --------------------------------------------------------------- | ---------------------------------------------- |
| `display: flex`, a row                                          | A horizontal carousel                          |
| `flex-direction: column`                                        | A vertical carousel                            |
| `display: grid` with `grid-auto-flow: column`                   | A horizontal carousel with more rows           |
| `justify-content: center`                                       | The selected slide is in the center            |
| `justify-content: flex-end`                                     | The selected slide is at the end               |
| The margins of the slides and a negative margin of the container | The space between the slides, also in a loop  |
| `direction: rtl`                                                | A right-to-left carousel                       |

The carousel measures again when the CSS changes, when a slide is added or removed, and when an image loads. To add or remove a slide, change the elements in the container.

## Frameworks

Render the root and the viewport in the component. Start the carousel after the component is mounted, and destroy it before the component is removed. Give the viewport to `BetterCarousel()`: the library finds the container in it and does not add a wrapper.

### React

In Strict Mode, React runs each effect two times in development. The cleanup function destroys the first carousel, and the second carousel replaces it.

```jsx
import { useEffect, useRef } from 'react'
import BetterCarousel from 'better-carousel'
import 'better-carousel/css'

export default function Carousel({ slides, options }) {
  const viewport = useRef(null)

  useEffect(() => {
    const carousel = BetterCarousel(viewport.current, options)
    return () => carousel.destroy()
  }, [])

  return (
    <div className="better">
      <div className="better_viewport" ref={viewport}>
        <div className="items">
          {slides.map((slide) => (
            <div className="item" key={slide.id}>
              <img src={slide.src} alt={slide.alt} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

### Vue

```vue
<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import BetterCarousel from 'better-carousel'
import 'better-carousel/css'

const props = defineProps({ slides: Array, options: Object })
const viewport = ref(null)
let carousel = null

onMounted(() => {
  carousel = BetterCarousel(viewport.value, props.options)
})

onBeforeUnmount(() => carousel?.destroy())
</script>

<template>
  <div class="better">
    <div ref="viewport" class="better_viewport">
      <div class="items">
        <div v-for="slide in slides" :key="slide.id" class="item">
          <img :src="slide.src" :alt="slide.alt" />
        </div>
      </div>
    </div>
  </div>
</template>
```

### Svelte

For Svelte 4, use `export let slides` and `export let options` in place of `$props()`.

```svelte
<script>
  import { onMount } from 'svelte'
  import BetterCarousel from 'better-carousel'
  import 'better-carousel/css'

  let { slides, options } = $props()
  let viewport

  onMount(() => {
    const carousel = BetterCarousel(viewport, options)
    return () => carousel.destroy()
  })
</script>

<div class="better">
  <div class="better_viewport" bind:this={viewport}>
    <div class="items">
      {#each slides as slide (slide.id)}
        <div class="item"><img src={slide.src} alt={slide.alt} /></div>
      {/each}
    </div>
  </div>
</div>
```

### Solid

```jsx
import { onMount, onCleanup, For } from 'solid-js'
import BetterCarousel from 'better-carousel'
import 'better-carousel/css'

export default function Carousel(props) {
  let viewport

  onMount(() => {
    const carousel = BetterCarousel(viewport, props.options)
    onCleanup(() => carousel.destroy())
  })

  return (
    <div class="better">
      <div class="better_viewport" ref={viewport}>
        <div class="items">
          <For each={props.slides}>
            {(slide) => <div class="item"><img src={slide.src} alt={slide.alt} /></div>}
          </For>
        </div>
      </div>
    </div>
  )
}
```

### Things to know

- **Arrows and dots:** the library adds them at the end of the root. Do not render other elements after the viewport in the root, or set [`arrows`](#options) and [`dots`](#options) to an element of your own.
- **Slides from data:** when the framework adds or removes a slide, the carousel measures again. You do not have to call `reInit()`.
- **New options:** call `reInit(newOptions)`. The selected slide stays.
- **Server rendering:** the library needs the DOM. Start the carousel only in the browser: in `useEffect`, `onMounted` or `onMount`.

## Options

Set the options in the call, in the `data-carousel` attribute as JSON, or in `BetterCarousel.defaults` for all carousels. If the call and the attribute set the same option, the value of the attribute applies.

```html
<div class="items carousel" data-carousel='{"loop":true,"autoplay":3000}'>...</div>
```

```js
BetterCarousel.defaults = { dragThreshold: 2 }

BetterCarousel(element, {
  align: 'center',
  breakpoints: {
    '(min-width: 1024px)': { draggable: false },
  },
})
```

| Option            | Type                              | Default       | Description                                                                                          |
| ----------------- | --------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------- |
| `axis`            | `'x'`, `'y'`, `'auto'`            | `'auto'`      | The axis. With `'auto'`, the CSS of the container sets it.                                            |
| `align`           | `string` or `function`            | `'auto'`      | `'start'`, `'center'`, `'end'` or `(viewSize, snapSize, index) => offset`. With `'auto'`, `justify-content` sets it. |
| `direction`       | `'ltr'`, `'rtl'`, `'auto'`        | `'auto'`      | The direction. With `'auto'`, the CSS `direction` sets it.                                            |
| `loop`            | `boolean`                         | `false`       | The first slide comes after the last slide.                                                           |
| `clones`          | `'auto'`, `'fill'`, `false`       | `'auto'`      | `'auto'`: clones only if the loop needs them. `'fill'`: clones that fill the window.                  |
| `dragFree`        | `boolean` or `'snap'`             | `false`       | `true`: glide and stop at any location. `'snap'`: glide and stop at a snap.                           |
| `containScroll`   | `'trimSnaps'`, `'keepSnaps'`, `false` | `'trimSnaps'` | `'trimSnaps'`: no empty space at the ends.                                                        |
| `slidesToScroll`  | `number` or `'auto'`              | `1`           | The number of slides in one snap. `'auto'`: the slides that fit in the viewport.                      |
| `skipSnaps`       | `boolean` or `number`             | `true`        | A fast flick can move more than one snap. A number sets the maximum.                                  |
| `dragThreshold`   | `number`                          | `10`          | The distance in px that the pointer moves before a drag starts.                                       |
| `duration`        | `number`                          | `400`         | The duration of a motion by one snap, in ms.                                                          |
| `startSnap`       | `number`                          | `0`           | The snap at the start.                                                                                |
| `lazy`            | `boolean` or `number`             | `false`       | Start when the carousel comes within one screen of the view, or within this distance in px.           |
| `draggable`       | `boolean`                         | `true`        | Drag with the mouse, the pen and the finger.                                                          |
| `wheel`           | `boolean` or `'both'`             | `true`        | The mouse wheel moves a vertical carousel. `'both'`: also a horizontal carousel.                      |
| `resize`          | `boolean`                         | `true`        | Measure again when a size changes.                                                                    |
| `slideChanges`    | `boolean`                         | `true`        | Measure again when a slide is added or removed.                                                       |
| `focus`           | `boolean`                         | `true`        | Go to a slide when it gets the keyboard focus.                                                        |
| `inViewThreshold` | `number`                          | `0`           | The part of a slide, from 0 to 1, that must show for `slidesInView()`.                                |
| `active`          | `boolean`                         | `true`        | `false`: do not start. Use it in `breakpoints`.                                                       |
| `breakpoints`     | `object`                          | `{}`          | The options for media queries.                                                                        |
| `container`       | `string`                          | `null`        | The selector of the container, if the element is the root.                                            |
| `slides`          | `string`                          | `null`        | The selector of the slides. With `null`, all children of the container are slides.                    |
| `wrap`            | `boolean`                         | `true`        | Add the root and the viewport if the page does not have them.                                         |
| `arrows`          | `boolean`, `Element` or `string`  | `true`        | Add the arrows to the root, or to an element or a selector.                                           |
| `dots`            | `boolean`, `Element` or `string`  | `true`        | Add the dots. The values are the same as for `arrows`.                                                |
| `labels`          | `object`                          | English       | The texts for screen readers: `carousel`, `slide` (`'%d of %n'`), `prev`, `next`, `dot`, `play`, `pause`. |
| `classes`         | `string` or `object`              | `null`        | A class prefix such as `'embla'`, or an object with the names to change.                              |
| `state`           | `string`                          | `''`          | The prefix of the state classes, such as `'is_'`.                                                     |
| `sync`            | carousel, `Element` or `string`   | `null`        | Follow the slide of another carousel. A click on a slide selects it in the other carousel.            |
| `autoplay`        | `boolean`, `number` or `object`   | `false`       | Go to the next slide after a delay.                                                                   |
| `autoScroll`      | `boolean`, `number` or `object`   | `false`       | Move the slides at a constant speed.                                                                  |
| `autoHeight`      | `boolean`                         | `false`       | The viewport gets the height of the tallest slide in view.                                            |

### autoplay

`true`, a delay in ms, or an object. A `data-delay` attribute on a slide sets the delay of that slide. The autoplay pauses when the keyboard focus is in the carousel, when the tab is hidden, and when the carousel is out of view. If the user prefers reduced motion, it does not start.

```js
BetterCarousel(element, {
  autoplay: {
    delay: 4000,               // ms on each slide
    stopOnInteraction: true,   // A drag, an arrow or a dot stops the autoplay
    stopOnMouseEnter: false,   // Pause while the mouse is on the carousel
    stopOnFocusIn: true,       // Pause while the keyboard focus is in the carousel
    stopOnLastSnap: false,     // Stop at the last snap, if loop is false
    playOnInit: true,
    instant: false,            // Jump to the next slide with no motion
  },
})
```

### autoScroll

`true`, a speed in px/s, or an object. The motion is one animation on the compositor. The pause conditions are the same as for the autoplay.

```js
BetterCarousel(element, {
  loop: true,
  autoScroll: {
    speed: 120,                // px per second
    direction: 'forward',      // or 'backward'
    startDelay: 1000,          // ms before the start, and after an interaction
    stopOnInteraction: true,
    stopOnMouseEnter: false,
    stopOnFocusIn: true,
    playOnInit: true,
  },
})
```

### sync

Put the same slides into two carousels, in the same order. Give `sync` to the thumbnails. The thumbnails follow the main gallery, and a click on a thumbnail selects its photo. A drag moves the thumbnails only.

```html
<div class="items carousel gallery_main" data-carousel='{"dots":false}'>...</div>
<div class="items carousel gallery_thumbs" data-carousel='{"sync":".gallery_main","arrows":false,"dots":false}'>
  <button type="button" class="item"><img src="thumb-1.jpg" alt="Show photo 1" /></button>
  ...
</div>
```

## Methods

`BetterCarousel(element, options)` returns the carousel. Where a feature is the same as in Embla, the name is also the same.

| Method                                                      | Description                                                       |
| ----------------------------------------------------------- | ----------------------------------------------------------------- |
| `goTo(index, instant)`                                      | Go to a snap. With `instant`, jump with no motion.                |
| `goToNext(instant)`, `goToPrev(instant)`                    | Go to the next or the previous snap.                              |
| `goToSlide(index, instant)`                                 | Go to the snap that shows a slide.                                |
| `canGoToNext()`, `canGoToPrev()`                            | Return `true` if a next or a previous snap exists.                |
| `selectedSnap()`, `previousSnap()`                          | Return the index of the selected snap, or of the snap before it.  |
| `selectedSlide()`                                           | Return the index of the selected slide.                           |
| `snapOfSlide(index)`                                        | Return the snap that shows a slide.                               |
| `snapList()`                                                | Return the progress of each snap, from 0 to 1.                    |
| `scrollProgress()`                                          | Return the progress now, from 0 to 1, also during a motion.       |
| `slidesInView()`                                            | Return the indexes of the slides in view.                         |
| `slideNodes()`, `rootNode()`, `viewportNode()`, `containerNode()` | Return the elements of the carousel.                        |
| `isFit()`                                                   | Return `true` if all slides fit in the viewport.                  |
| `options()`                                                 | Return the options that apply now, with the breakpoints.          |
| `reInit(options)`                                           | Merge new options and start again. The selected slide stays.      |
| `destroy()`                                                 | Stop the carousel and restore the markup.                         |
| `on(name, handler)`, `off(name, handler)`                   | Add or remove an event handler. The handler gets `(carousel, name)`. |
| `autoplay`, `autoScroll`                                    | With the option: `play()`, `stop()` and `isPlaying()`. Autoplay also has `reset()`. |
| `BetterCarousel.get(element)`                               | Return the carousel of a root, a viewport or a container.         |
| `BetterCarousel.initAll(selector, options)`                 | Start a carousel on each element that matches. Return the carousels. |
| `BetterCarousel.defaults`                                   | The options for all carousels.                                    |

```js
const carousel = BetterCarousel(element)

carousel.on('select', (carousel) => {
  console.log('Slide', carousel.selectedSlide())
})
```

## Events

| Event                                 | When                                                             |
| ------------------------------------- | ---------------------------------------------------------------- |
| `init`                                | The first measure is complete.                                   |
| `reinit`                              | A `reInit()` call or a breakpoint started the carousel again.    |
| `resize`                              | The layout changed.                                              |
| `select`                              | The selected snap changed.                                       |
| `scroll`                              | The location changed during a motion or a drag. A handler for this event makes the motion run in a `requestAnimationFrame` loop. |
| `settle`                              | A motion stopped.                                                |
| `pointerdown`, `pointerup`            | A drag started or stopped.                                       |
| `slidesinview`                        | The slides in view changed.                                      |
| `slideschanged`                       | A slide was added or removed.                                    |
| `slidefocus`                          | A slide got the keyboard focus.                                  |
| `autoplay:play`, `autoplay:stop`      | The autoplay started or stopped.                                 |
| `autoscroll:play`, `autoscroll:stop`  | The auto scroll started or stopped.                              |
| `destroy`                             | The carousel stopped, and the markup is restored.                |

## Styling

The stylesheet has the rules that the carousel needs. It also has the look of the arrows, the dots and the play button. These use the button variables of the theme. The arrow icon is an inline SVG in the stylesheet, so no image file is necessary. Set the variables to change the look:

```css
:root {
  --button-arrow: url(arrow.svg);  /* Optional: the default is a chevron */
  --height-button: 2.5rem;         /* The size of the buttons */
  --button-border: #7c3aed;
  --button-base: #7c3aed;          /* Also the selected dot */
  --button-text: #fff;
  --button-border-active: #6d28d9;
  --button-base-active: #6d28d9;
  --button-text-active: #fff;
  --button-border-disabled: #e8e8e8;
  --button-base-disabled: #f5f5f5;
  --button-text-disabled: #74787d; /* Also the dots */
}
```

To use other class names, compile the SCSS file. It uses `@import` and global variables, so it compiles with Dart Sass and with node-sass:

```scss
$better: 'embla';              // The class prefix: .embla, .embla_viewport, .embla_button
$better-state: 'is_';          // The prefix of the state classes: .is_active, .is_current
$better-look: false;           // Only the rules that the carousel needs
$better-arrow: url(arrow.svg); // The default icon of the arrows

@import 'better-carousel';
```

Then set the same names in the options: `{ classes: 'embla', state: 'is_' }`.

| Class                                                       | Element                                              |
| ----------------------------------------------------------- | ---------------------------------------------------- |
| `better`, `better_viewport`, `better_container`             | The root, the viewport and the container             |
| `better_horizontal`, `better_vertical`                      | The axis, on the root                                |
| `better_dynamic`                                            | On the root, if the slides do not fit                |
| `better_auto_height`                                        | On the root, with `autoHeight`                       |
| `better_button`, `better_prev`, `better_next`, `better_play` | The buttons                                          |
| `better_dots`, `better_dot`                                 | The dots                                             |
| `active`, `clone`                                           | The selected slide, and a clone of a slide           |
| `dragging`, `playing`                                       | On the root, during a drag and while a motion plays  |
| `current`, `prev`, `next`, `first`, `last`                  | The selected dot and the four dots around it         |

## Accessibility

The carousel follows the carousel pattern of the WAI-ARIA Authoring Practices and WCAG 2.1 AA.

- The root is a region with the name "Carousel". Each slide has a name such as "2 of 8". A slide that is an `article` or a list item keeps its own role.
- The arrows and the dots are buttons with names. A screen reader reads each new slide, but not during the autoplay.
- Tab moves the focus through the links and the fields in the slides. The carousel moves to show the focused element.
- Clones are `inert` and hidden from screen readers.
- The autoplay and the auto scroll have a play and pause button. If the user prefers reduced motion, they do not start.
- A drag across the axis scrolls the page. A link opens on a click, but not after a drag.

## Development

```sh
npm install
npm run dev     # build again after each change
npm run build   # build dist/ and demo/demo.css
npm test        # unit tests
npm run e2e     # browser tests in Chrome
```

The browser tests open `http://better.test/` in Chrome. Set `URL` and `CHROME` to use another address or another Chrome. The docs page is [`index.html`](index.html), with its scripts and styles in [`demo/`](demo).

## Performance

| File                     | Minified | Gzipped | Brotli |
| ------------------------ | -------: | ------: | -----: |
| `better-carousel.min.js` |  26.4 KB | 10.4 KB | 9.5 KB |
| `better-carousel.css`    |   3.9 KB |  1.2 KB | 1.0 KB |
| **Total**                |  30.3 KB | 11.7 KB | 10.5 KB |

The same features in Embla 9 (the core, three plugins and a wrapper) are 12.6 KB gzip.

- A motion is a Web Animations API animation of `translate`. No script runs for each frame.
- The auto scroll is one animation that does not stop. During the motion, the browser does no script, style, layout or paint work.
- One `ResizeObserver` serves all carousels. It reads the layout of all carousels first, and then it writes. Thus the browser calculates the layout one time only.
- A carousel at rest uses no CPU. The listeners for the autoplay and the mouse wheel exist only while they can do something.

## License

[MIT](LICENSE)
