# Carousel benchmark

This benchmark compares Better Carousel with Swiper, Embla Carousel and Glide in Chrome. It measures the bundle size, the main-thread time, the paints, the frames and the layout shift. The [Comparison](../README.md#comparison) section of the main README gives the results.

## Run it

You need Node.js 20 or later and Google Chrome or Chromium. In the project root, run:

```sh
npm install
npm run bench
```

The command builds the library, installs the benchmark packages, builds the test pages and measures all libraries in a headless Chrome. The full run takes about 20 minutes. For a first look, run one round only, in about 7 minutes:

```sh
npm run bench -- --quick
```

At the end, the console shows three tables: the bundle sizes, the mobile results and the desktop results. `results/REPORT.md` has all values, the range of the rounds and the feature table. `results/sizes.json` and `results/runtime.json` have the raw values.

To get the same results again, close the other apps, connect the computer to mains power, and do not use the computer during the run. The absolute values change with the computer, so compare the values of one run only.

### Options

Add the options after `--`, for example `npm run bench -- --profiles mobile --libs better,swiper,none`. In this folder, `npm start -- <options>` does the same without the build of the library.

| Option | Default | Description |
| --- | --- | --- |
| `--quick` | off | One round instead of 3. |
| `--rounds` | `3` | The number of measurements of each library in each scenario. The tables give the median. |
| `--profiles` | `mobile,desktop` | The device profiles. |
| `--libs` | all | The libraries: `better`, `swiper`, `embla`, `glide`, and `none` for the page with no carousel. |
| `--scenarios` | all | The scenarios: `load`, `idle`, `navigate`, `autoplay`, `drag`, `busy`. |
| `--seed` | `1` | The seed of the random order of the libraries in each round. |
| `--headed` | off | Show the Chrome window. By default, Chrome runs headless. |

The script finds Chrome in the usual places. If it does not find Chrome, set the `CHROME` environment variable to the path of Chrome or Chromium.

## Method

Each library makes the same carousel: 10 slides with a 400 × 400 image and a caption, a gap of 16 px, the loop, the drag, the arrows, the dots and a motion of 400 ms. Each measurement opens the page in a new incognito context, with the cache off. A local server sends the files with no compression. In each round, a seeded random function (mulberry32, seed 1) sets the order of the libraries. The tables give the median of the rounds.

A page with the same slides and no carousel script ("No carousel") shows the cost of the browser and of the measurement itself. Compare each library with this page, not with zero.

### Profiles

| Profile | Screen | CPU | Input | Slides in view |
| --- | --- | --- | --- | --- |
| Mobile | 412 × 823, device pixel ratio 1.75, the user agent of a Moto G Power (2022) | 4 times slower, as in the Lighthouse mobile setting | touch | 1 |
| Desktop | 1350 × 940, device pixel ratio 1 | not throttled | mouse | 3 |

### Scenarios

The measurement starts 1 s after the `load` event.

| Scenario | Carousels | What it does |
| --- | --- | --- |
| Page load | 10 | The values from the start of the page to 1 s after the `load` event |
| Idle | 1 | The carousel at rest for 2 s |
| Navigate | 1 | 6 calls of `next()`, one each 700 ms |
| Autoplay | 1 | The autoplay with a delay of 1500 ms, for 4.5 s |
| Drag | 1 | 5 drags from 85% to 15% of the width, each in 18 moves of 16 ms, and a wait of 700 ms after the release |
| Busy | 1 | Navigate, while a `setInterval` of 50 ms blocks the main thread for 35 ms each time |

After each action, the runner reads the selected slide, to make sure that the carousel moved. The tables show "did not move" if a carousel did not move.

### Metrics

| Metric | What it shows | Source |
| --- | --- | --- |
| Main-thread time | The time of all tasks on the main thread of the page, in ms | The change of `TaskDuration` from `Performance.getMetrics`, in the default wall-time domain. The wall time includes the CPU throttling. |
| CPU | The main-thread time as a share of the scenario time | `TaskDuration` |
| Script, layouts, style recalcs | The time of the JavaScript, and the number of layout and style passes | `ScriptDuration`, `LayoutCount`, `RecalcStyleCount` |
| Paints | The paints on the main thread. A motion on the compositor needs no paint. | The `Paint` events of the `CrRendererMain` thread in a trace with the categories `devtools.timeline` and `disabled-by-default-devtools.timeline.frame` |
| Frames dropped or late | The frames that a user sees as a stutter, as a share of the frames with an update. It shows only if 20 or more frames had an update. | The top `PipelineReporter` event of each frame in the same trace. A frame with an update has a state other than `STATE_NO_UPDATE_DESIRED`. A bad frame has `affects_smoothness` and the state `STATE_DROPPED` or `STATE_PRESENTED_PARTIAL`. |
| Total Blocking Time (TBT) | The part of each long task that is more than 50 ms | A `longtask` observer in the page |
| Cumulative Layout Shift (CLS) | The layout shift from the start of the page | A `layout-shift` observer in the page, with `buffered: true` |
| DOM nodes, JS heap | The size of the page in memory | `Nodes` and `JSHeapUsedSize` after `HeapProfiler.collectGarbage` |

### Libraries and options

| Library | Package | Modules and options |
| --- | --- | --- |
| Better Carousel | this repository, built from `src/` | `{ loop: true, duration: 400, dotsStyle: 'all', autoplay: { delay, stopOnInteraction: true } }` |
| Swiper | `swiper` 14.4.0 | Modules `Navigation`, `Pagination`, `Autoplay`, `A11y`. `{ slidesPerView, spaceBetween: 16, loop: true, speed: 400, autoplay: { delay, disableOnInteraction: true }, navigation, pagination: { clickable: true } }` |
| Embla Carousel | `embla-carousel`, `embla-carousel-autoplay`, `embla-carousel-class-names` 8.6.0 | `{ loop: true, duration: 25 }` (Embla has no duration in ms), `ClassNames()` and `Autoplay({ delay, stopOnInteraction: true })` |
| Glide | `@glidejs/glide` 3.7.1, `dist/glide.modular.esm.js` | Components `Swipe`, `Controls`, `Autoplay`, `Anchors`, `Images`. `{ type: 'carousel', perView, gap: 16, animationDuration: 400, autoplay }` |

- Embla has no arrows and dots. The Embla page uses the markup, the script (`adapters/embla-controls.js`) and the CSS (`adapters/embla-controls.css`) of the Embla vanilla examples at v8.6.0.
- Better Carousel uses `dotsStyle: 'all'`: all dots have one size, as in the other libraries. Its default `'zoom'` style also slides a window of 5 dots.
- The autoplay is on only in the autoplay scenario.

### Bundle size

`build.mjs` bundles each library with esbuild and the same options: `{ bundle: true, minify: true, format: 'iife', target: 'es2020', legalComments: 'none', define: { 'process.env.NODE_ENV': '"production"' } }`. It joins the CSS files of each set and minifies them with esbuild, `target: 'chrome100'`. Node.js `zlib` gives the gzip size at level 9 and the brotli size at quality 11. The total is the compressed JS plus the compressed CSS.

| Set | What it has |
| --- | --- |
| Core | The smallest import that makes a carousel that the user can drag, and the core CSS |
| Typical | The setup of the test page, with the accessibility module if the library has one, and the CSS of the arrows and the dots |
| All features | The typical set, the mouse wheel, the auto scroll, the auto height, the free drag and the sync. Swiper adds `FreeMode`, `Mousewheel` and `Thumbs`. Embla adds `embla-carousel-auto-scroll` and `-auto-height` 8.6.0, and `embla-carousel-wheel-gestures` 8.1.0. Glide does not have all of these features. |
| Shipped files | The minified JS and CSS files that the package gives for a script tag, as they are |

The test page markup and the measurement script are not in the sizes.

### Test page and runner

- The page has a box of `max-width: 1200px` with `padding: 24px 16px`. The CSS of the library is in the `head`, and its script is at the end of the `body`. The script makes the markup of all carousels, and then calls all constructors in one task.
- Chrome starts with these flags: `--hide-scrollbars --no-first-run --no-default-browser-check --disable-extensions --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --mute-audio`.
- The CPU throttling is `Emulation.setCPUThrottlingRate` 4.
- Mobile uses `Input.dispatchTouchEvent` for the drag, desktop uses `Input.dispatchMouseEvent`. The drag is at 150 px from the top of the carousel.
- Before the first round, each page opens one time, so that the start of Chrome does not change the values of the first library.

### Limits

- The CPU throttling slows the main thread only. The compositor and the GPU keep the speed of the computer. For this reason, a motion on the compositor looks better here than on a real phone, for all libraries that use it.
- Headless Chrome uses the same frame pipeline as Chrome with a window, but it does not show the frames on a screen. To compare, run with `--headed`.
- The trace adds a small cost to each measurement. The cost is the same for all libraries, and the "No carousel" page shows it.
- Synthetic input events go through the real input pipeline, but a real finger has a different speed curve.
- The feature table comes from the documentation and the types of each library at the versions above. It does not measure the quality of a feature.
- The author of Better Carousel wrote this benchmark. All adapters, options and scripts are in this folder, so that anyone can examine them and send changes.

## Files

| File | Description |
| --- | --- |
| `libs.mjs` | The libraries, the imports for the size sets and the feature table |
| `adapters/` | The markup and the options of each library on the test page |
| `page.html`, `harness.js` | The test page, and the script that makes the carousels and records the layout shift and the long tasks |
| `build.mjs` | Builds the test pages with esbuild and measures the bundle sizes |
| `run.mjs` | Opens the test pages in Chrome and measures each scenario |
| `report.mjs` | Writes `results/REPORT.md` and the console tables. `npm run report` in this folder makes them again from the saved results. |
