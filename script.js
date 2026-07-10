const film = document.querySelector("[data-film]");
const stage = document.querySelector("[data-stage]");
const progressBar = document.querySelector("[data-progress-bar]");
const quietNav = document.querySelector("[data-quiet-nav]");
const shotLayers = [...document.querySelectorAll("[data-shot]")];
const filmCueNodes = [...document.querySelectorAll("[data-film-cue]")];
const commerceChapters = [...document.querySelectorAll("[data-commerce-chapter]")];
const bloom = document.querySelector("[data-light-bloom]");
const firstScrollCue = document.querySelector("[data-first-scroll-cue]");
const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

let rafId = 0;
let lastPreloadIndex = -1;
let firstScrollCueDismissed = false;
const enteredScenes = new Set();

const clamp = (value, min = 0, max = 1) => Math.min(Math.max(value, min), max);

const smoothstep = (edge0, edge1, value) => {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

const readNumber = (node, name, fallback) => {
  const value = Number.parseFloat(node.dataset[name]);
  return Number.isFinite(value) ? value : fallback;
};

const rangeOpacity = (progress, start, end, fade = 2) => {
  const fadeIn = start <= 0 ? 1 : smoothstep(start, Math.min(start + fade, end), progress);
  const fadeOut = end >= 100 ? 1 : 1 - smoothstep(Math.max(start, end - fade), end, progress);
  return clamp(Math.min(fadeIn, fadeOut));
};

const localProgress = (progress, start, end) => clamp((progress - start) / Math.max(end - start, 0.001));

const track = (event, payload = {}) => {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...payload });
};

const easeInOutCubic = (progress) =>
  progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

const getBuyScrollTarget = () => {
  const target = document.querySelector("#buy");
  if (!target) return 0;
  const navBottom = quietNav ? quietNav.getBoundingClientRect().bottom : 0;
  const offset = Math.ceil(navBottom + 12);
  return Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset);
};

const scrollToBuy = () => {
  const targetY = getBuyScrollTarget();

  if (reduceMotionQuery.matches) {
    window.scrollTo({ top: targetY });
    requestUpdate();
    return;
  }

  const startY = window.scrollY;
  const distance = targetY - startY;
  const duration = 820;
  const startedAt = window.performance.now();

  const step = (now) => {
    const progress = clamp((now - startedAt) / duration);
    const nextY = startY + distance * easeInOutCubic(progress);
    window.scrollTo(0, nextY);

    if (progress < 1) {
      window.requestAnimationFrame(step);
      return;
    }

    requestUpdate();
  };

  window.requestAnimationFrame(step);
};

const preloadAround = (activeIndex) => {
  if (activeIndex === lastPreloadIndex || activeIndex < 0) return;
  lastPreloadIndex = activeIndex;

  for (let index = activeIndex + 1; index <= activeIndex + 2; index += 1) {
    const layer = shotLayers[index];
    const src = window.matchMedia("(max-width: 759px)").matches ? layer?.dataset.srcMobile || layer?.dataset.src : layer?.dataset.src;
    if (!src) continue;
    const img = new Image();
    img.decoding = "async";
    img.src = src;
  }
};

const readSrcsetCandidate = (srcset, preferMobile) => {
  const candidates = srcset
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .filter(Boolean);
  return preferMobile ? candidates[0] : candidates[candidates.length - 1];
};

const getImagePreloadSrc = (image) => {
  const picture = image.closest("picture");
  const preferMobile = window.matchMedia("(max-width: 759px)").matches;
  const source = picture?.querySelector('source[type="image/avif"]') || picture?.querySelector("source");
  return source?.getAttribute("srcset")
    ? readSrcsetCandidate(source.getAttribute("srcset"), preferMobile)
    : image.currentSrc || image.getAttribute("src");
};

const preloadChapterImages = (chapter) => {
  chapter.querySelectorAll("img[loading='lazy']").forEach((image) => {
    if (image.dataset.preloaded !== "true") {
      image.dataset.preloaded = "true";
      const preload = new Image();
      preload.decoding = "async";
      preload.src = getImagePreloadSrc(image);
    }
  });
};

const updateShot = (layer, progress, reduced) => {
  const start = readNumber(layer, "start", 0);
  const end = readNumber(layer, "end", 100);
  const opacity = rangeOpacity(progress, start, end, 2.25);
  const local = localProgress(progress, start, end);
  const scaleStart = readNumber(layer, "scaleStart", 1);
  const scaleEnd = readNumber(layer, "scaleEnd", 1);
  const blurStart = readNumber(layer, "blurStart", 0);
  const blurEnd = readNumber(layer, "blurEnd", 0);
  const scale = reduced ? 1 : scaleStart + (scaleEnd - scaleStart) * local;
  const blur = reduced ? 0 : blurStart + (blurEnd - blurStart) * local;

  layer.style.setProperty("--shot-opacity", opacity.toFixed(3));
  layer.style.setProperty("--shot-scale", scale.toFixed(4));
  layer.style.setProperty("--shot-blur", `${blur.toFixed(2)}px`);

  if (layer.dataset.mask === "true") {
    const reveal = reduced ? 0 : 22 - local * 22;
    layer.style.setProperty("--shot-reveal", `${reveal.toFixed(2)}%`);
  }

  if (opacity > 0.35 && !enteredScenes.has(layer.dataset.shot)) {
    enteredScenes.add(layer.dataset.shot);
    track("scene_enter", { scene: layer.dataset.shot });
  }

  return opacity;
};

const updateCue = (cue, progress) => {
  const start = readNumber(cue, "start", 0);
  const end = readNumber(cue, "end", 100);
  const opacity = rangeOpacity(progress, start, end, 1.35);
  const y = (1 - opacity) * 14;

  cue.style.setProperty("--cue-opacity", opacity.toFixed(3));
  cue.style.setProperty("--cue-y", `${y.toFixed(2)}px`);
};

const updateFilm = (reduced) => {
  if (!film || !stage) return 0;

  const rect = film.getBoundingClientRect();
  const scrollable = Math.max(rect.height - window.innerHeight, 1);
  const progress = clamp(-rect.top / scrollable) * 100;

  document.documentElement.style.setProperty("--film-progress", (progress / 100).toFixed(4));

  let strongestIndex = 0;
  let strongestOpacity = -1;

  shotLayers.forEach((layer, index) => {
    const opacity = updateShot(layer, progress, reduced);
    if (opacity > strongestOpacity) {
      strongestOpacity = opacity;
      strongestIndex = index;
    }
  });

  filmCueNodes.forEach((cue) => updateCue(cue, progress));

  if (bloom) {
    const underwaterBloom = smoothstep(72, 86, progress) * (1 - smoothstep(90, 96, progress));
    const finalBloom = smoothstep(90, 100, progress) * 0.22;
    bloom.style.setProperty("--bloom-opacity", Math.min(0.48, underwaterBloom * 0.34 + finalBloom).toFixed(3));
  }

  preloadAround(strongestIndex);
  return progress;
};

const updateCommerceChapter = (chapter, reduced) => {
  const rect = chapter.getBoundingClientRect();
  const travel = Math.max(rect.height - window.innerHeight, 1);
  const progress = reduced ? 1 : clamp(-rect.top / travel);
  const exitOpacity = chapter.dataset.chapter === "BUY" || reduced ? 1 : 1 - smoothstep(0.82, 0.98, progress);
  chapter.style.setProperty("--chapter-progress", progress.toFixed(4));
  chapter.style.setProperty("--chapter-base-opacity", exitOpacity.toFixed(3));
  chapter.style.setProperty("--chapter-scale", (1.015 + progress * 0.018).toFixed(4));
  chapter.style.setProperty("--chapter-object-scale", (0.985 + progress * 0.025).toFixed(4));
  chapter.style.setProperty("--chapter-shift", `${((0.5 - progress) * 14).toFixed(2)}px`);
  chapter.style.setProperty("--chapter-shift-mobile", `${((0.5 - progress) * 10).toFixed(2)}px`);
  chapter.style.setProperty("--memory-scale", (1.02 + progress * 0.025).toFixed(4));
  const sceneOpacity = (enterStart, enterEnd, exitStart, exitEnd) =>
    smoothstep(enterStart, enterEnd, progress) * (1 - smoothstep(exitStart, exitEnd, progress));
  chapter.style.setProperty("--mexico-city-opacity", (1 - smoothstep(0.16, 0.34, progress)).toFixed(3));
  chapter.style.setProperty("--mexico-car-opacity", sceneOpacity(0.18, 0.36, 0.38, 0.55).toFixed(3));
  chapter.style.setProperty("--mexico-beach-opacity", sceneOpacity(0.4, 0.56, 0.6, 0.74).toFixed(3));
  chapter.style.setProperty("--mexico-sup-opacity", sceneOpacity(0.62, 0.76, 0.8, 0.91).toFixed(3));
  chapter.style.setProperty("--mexico-yacht-opacity", smoothstep(0.82, 0.94, progress).toFixed(3));
  chapter.style.setProperty("--mexico-push", (1.006 + progress * 0.028).toFixed(4));
  chapter.style.setProperty("--ocean-coral-opacity", (1 - smoothstep(0.18, 0.42, progress)).toFixed(3));
  chapter.style.setProperty("--ocean-cenote-opacity", (smoothstep(0.2, 0.46, progress) * (1 - smoothstep(0.62, 0.84, progress))).toFixed(3));
  chapter.style.setProperty("--ocean-wave-opacity", smoothstep(0.6, 0.88, progress).toFixed(3));
  chapter.style.setProperty("--story-a-opacity", clamp(1 - progress * 2.2).toFixed(3));
  chapter.style.setProperty("--story-b-opacity", clamp((progress - 0.27) * 3).toFixed(3));
  chapter.style.setProperty("--story-c-opacity", clamp((progress - 0.62) * 3).toFixed(3));
  chapter.classList.toggle("is-visible", rect.top < window.innerHeight * 0.58 && rect.bottom > window.innerHeight * 0.28);

  chapter.querySelectorAll("[data-commerce-step]").forEach((node) => {
    const start = readNumber(node, "commerceStep", 0.2);
    const opacity = reduced ? 1 : smoothstep(start, Math.min(start + 0.1, 1), progress) * exitOpacity;
    const y = (1 - opacity) * 14;
    node.style.setProperty("--cue-opacity", opacity.toFixed(3));
    node.style.setProperty("--cue-y", `${y.toFixed(2)}px`);
  });

  if (progress > 0.08 && !enteredScenes.has(chapter.dataset.chapter)) {
    enteredScenes.add(chapter.dataset.chapter);
    track("chapter_enter", { chapter: chapter.dataset.chapter });
    preloadChapterImages(chapter);
  }

  if (chapter.dataset.chapter === "BUY" && rect.top < window.innerHeight * 1.6) {
    preloadChapterImages(chapter);
  }
};

const updateChrome = (filmProgress) => {
  const pageScrollable = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
  const pageProgress = clamp(window.scrollY / pageScrollable) * 100;
  const navOpacity = smoothstep(94, 100, filmProgress);

  if (progressBar) progressBar.style.width = `${pageProgress.toFixed(2)}%`;
  if (quietNav) quietNav.style.setProperty("--nav-opacity", navOpacity.toFixed(3));
};

const updateFrame = () => {
  rafId = 0;
  const reduced = reduceMotionQuery.matches;
  const filmProgress = updateFilm(reduced);

  commerceChapters.forEach((chapter) => updateCommerceChapter(chapter, reduced));
  updateChrome(filmProgress);
};

const requestUpdate = () => {
  if (rafId) return;
  rafId = window.requestAnimationFrame(updateFrame);
};

const dismissFirstScrollCue = () => {
  if (firstScrollCueDismissed || window.scrollY <= 2) return;
  firstScrollCueDismissed = true;
  firstScrollCue?.classList.add("is-hidden");
};

document.querySelectorAll("[data-event]").forEach((node) => {
  node.addEventListener("click", () => {
    track(node.dataset.event, {
      label: node.textContent.trim(),
      href: node.getAttribute("href") || "",
    });
  });
});

document.querySelectorAll("[data-scroll-buy]").forEach((node) => {
  node.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }

    event.preventDefault();
    scrollToBuy();
    window.history.pushState(null, "", "#buy");
  });
});

const visibilityObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const scene = entry.target.dataset.chapter || "film";
      track("viewport_enter", { scene });
      requestUpdate();
    });
  },
  { threshold: 0.08, rootMargin: "10% 0px 10% 0px" }
);

if (film) visibilityObserver.observe(film);
commerceChapters.forEach((chapter) => visibilityObserver.observe(chapter));

reduceMotionQuery.addEventListener?.("change", requestUpdate);
window.addEventListener(
  "scroll",
  () => {
    dismissFirstScrollCue();
    requestUpdate();
  },
  { passive: true }
);
window.addEventListener("resize", requestUpdate);
window.addEventListener("load", () => {
  dismissFirstScrollCue();
  requestUpdate();
});
requestUpdate();
