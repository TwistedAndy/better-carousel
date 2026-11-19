/*
 * The thumbnails (sync) and the lazy load of the Embla vanilla examples, as they are in the Embla repository at v8.6.0 (MIT license):
 * packages/embla-carousel-docs/src/components/Sandbox/Vanilla/SandboxFilesDist/Thumbs/EmblaCarouselThumbsButton.js and LazyLoad/EmblaCarouselLazyLoad.js
 */
export const addThumbBtnsClickHandlers = (emblaApiMain, emblaApiThumb) => {
  const slidesThumbs = emblaApiThumb.slideNodes()

  const scrollToIndex = slidesThumbs.map(
    (_, index) => () => emblaApiMain.scrollTo(index)
  )

  slidesThumbs.forEach((slideNode, index) => {
    slideNode.addEventListener('click', scrollToIndex[index], false)
  })

  return () => {
    slidesThumbs.forEach((slideNode, index) => {
      slideNode.removeEventListener('click', scrollToIndex[index], false)
    })
  }
}

export const addToggleThumbBtnsActive = (emblaApiMain, emblaApiThumb) => {
  const slidesThumbs = emblaApiThumb.slideNodes()

  const toggleThumbBtnsState = () => {
    emblaApiThumb.scrollTo(emblaApiMain.selectedScrollSnap())
    const previous = emblaApiMain.previousScrollSnap()
    const selected = emblaApiMain.selectedScrollSnap()
    slidesThumbs[previous].classList.remove('embla-thumbs__slide--selected')
    slidesThumbs[selected].classList.add('embla-thumbs__slide--selected')
  }

  emblaApiMain.on('select', toggleThumbBtnsState)
  emblaApiThumb.on('init', toggleThumbBtnsState)

  return () => {
    const selected = emblaApiMain.selectedScrollSnap()
    slidesThumbs[selected].classList.remove('embla-thumbs__slide--selected')
  }
}

export const setupLazyLoadImage = (emblaApi) => {
  const imagesInView = []
  const slideNodes = emblaApi.slideNodes()
  const spinnerNodes = slideNodes.map((slideNode) =>
    slideNode.querySelector('.embla__lazy-load__spinner')
  )
  const imageNodes = slideNodes.map((slideNode) =>
    slideNode.querySelector('.embla__lazy-load__img')
  )

  const loadImageInView = (index) => {
    const imageNode = imageNodes[index]
    const slideNode = slideNodes[index]
    const spinnerNode = spinnerNodes[index]
    const src = imageNode.getAttribute('data-src')

    imageNode.src = src
    imagesInView.push(index)

    const onLoad = () => {
      slideNode.classList.add('embla__lazy-load--has-loaded')
      spinnerNode.parentElement?.removeChild(spinnerNode)
      imageNode.removeEventListener('load', onLoad)
    }
    imageNode.addEventListener('load', onLoad)
  }

  const loadImagesInView = () => {
    emblaApi
      .slidesInView()
      .filter((index) => !imagesInView.includes(index))
      .forEach(loadImageInView)
    return imagesInView.length === imageNodes.length
  }

  const loadImagesInViewAndDestroyIfDone = (emblaApi, eventName) => {
    const loadedAll = loadImagesInView()
    if (loadedAll) emblaApi.off(eventName, loadImagesInViewAndDestroyIfDone)
  }

  return loadImagesInViewAndDestroyIfDone
}
