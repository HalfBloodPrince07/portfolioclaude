import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { Sound } from './ui/sound.js';
import { initGraph } from './ui/graph.js';
import { initPodcast } from './ui/podcast.js';
import { initLab } from './ui/lab.js';
import { initAsk } from './ui/ask.js';

gsap.registerPlugin(ScrollTrigger, SplitText);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const isTouch = matchMedia('(hover: none), (pointer: coarse)').matches;
const isMobile = window.innerWidth < 860;
const params = new URLSearchParams(location.search);
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = { motion: !prefersReduced, quality: !isMobile, field: null };
const sound = new Sound();

document.body.classList.add('is-loading');
if (!isTouch) document.documentElement.classList.add('has-cursor');

/* ------------------------------------------------------------------ smooth scroll */
const lenis = new Lenis({ lerp: 0.09, smoothWheel: state.motion, wheelMultiplier: 0.9 });
lenis.stop();
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);

$$('a[href^="#"]').forEach((a) =>
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2 && id !== '#') return;
    e.preventDefault();
    closeMenu();
    lenis.scrollTo(id === '#top' || id === '#' ? 0 : id, { duration: 1.6, easing: (x) => 1 - Math.pow(1 - x, 4) });
  })
);

/* ------------------------------------------------------------------ WebGPU field */
async function startField() {
  if (params.has('nogl')) return null;
  try {
    const { LatentField } = await import('./gl/scene.js');
    const count = Number(params.get('n')) || (isMobile ? 22000 : 64000);
    const field = new LatentField($('#gl'), { count, bloom: state.quality });
    await field.init();
    if (!state.motion) field.u.calm.value = 0.15;
    $$('[data-hud-backend]').forEach((el) => (el.textContent = field.backend));
    $('[data-hud-particles]').textContent = count.toLocaleString('en-US');
    return field;
  } catch (err) {
    console.warn('[portfolio] WebGPU/WebGL unavailable — running without the particle field.', err);
    $$('[data-hud-backend]').forEach((el) => (el.textContent = 'CSS'));
    document.body.classList.add('no-gl');
    return null;
  }
}

/* ------------------------------------------------------------------ loader */
const LOGS = ['› loading weights…', '› compiling TensorRT engine…', '› quantizing to INT8…', '› building BM25 index…',
  '› embedding 768-d vectors…', '› spawning 15 agents…', '› warming KV cache…', '› ready.'];

async function boot() {
  const countEl = $('[data-loader-count]');
  const bar = $('[data-loader-bar]');
  const logEl = $('[data-loader-log]');
  const prog = { v: 0 };
  const render = () => {
    const v = Math.round(prog.v);
    countEl.textContent = String(v).padStart(3, '0');
    bar.style.transform = `scaleX(${prog.v / 100})`;
    logEl.textContent = LOGS[Math.min(LOGS.length - 1, Math.floor((prog.v / 100) * LOGS.length))];
  };
  const fake = gsap.to(prog, { v: 82, duration: 2.2, ease: 'power2.out', onUpdate: render });
  await document.fonts.ready;
  measureFit();
  splitReveals();
  const field = await startField();
  state.field = field;
  await fake;
  await gsap.to(prog, { v: 100, duration: 0.5, ease: 'power2.inOut', onUpdate: render });
  $('[data-loader-status]').textContent = 'Latent space ready';
  intro();
}

function intro() {
  const tl = gsap.timeline({
    onComplete: () => {
      document.body.classList.remove('is-loading');
      $('#loader').remove();
      lenis.start();
      ScrollTrigger.refresh();
      adaptQuality();
    },
  });
  tl.to('#loader', { opacity: 0, duration: 1.2, ease: 'power2.inOut' });
  if (state.field) tl.to(state.field.u.intro, { value: 1, duration: 3.2, ease: 'power3.out' }, 0.25);
  tl.from('[data-hero-line]', { yPercent: 105, duration: 1.8, stagger: 0.16, ease: 'expo.out' }, 0.55);
  tl.from('[data-reveal-fade]', { opacity: 0, y: 20, duration: 1, stagger: 0.08, ease: 'power3.out' }, 0.95);
  tl.from('.nav, .hud', { opacity: 0, duration: 1 }, 1.1);
}

/* ------------------------------------------------------------------ scroll → GL formations */
const shapeSections = $$('[data-shape]');
const hudLayer = $('[data-hud-layer]');
const hudTitle = $('[data-hud-title]');
let currentShape = 0;

function goToShape(sec) {
  const idx = Number(sec.dataset.shape);
  const cfg = JSON.parse(sec.dataset.gl || '{}');
  const mobile = window.innerWidth < 860;
  if (state.field) {
    const f = state.field;
    gsap.to(f.u.morph, { value: idx, duration: 2.2, ease: 'power2.inOut', overwrite: true });
    Object.assign(f.state, {
      x: mobile ? cfg.mx ?? 0 : cfg.x ?? 0,
      y: mobile ? cfg.my ?? cfg.y ?? 0 : cfg.y ?? 0,
      scale: mobile ? cfg.mscale ?? cfg.scale ?? 1 : cfg.scale ?? 1,
      rotX: cfg.rotX ?? 0,
    });
  }
  if (idx !== currentShape) {
    sound.whoosh();
    currentShape = idx;
  }
  hudLayer.textContent = String(idx).padStart(2, '0');
  gsap.timeline()
    .to(hudTitle, { opacity: 0, duration: 0.3 })
    .add(() => (hudTitle.textContent = sec.dataset.title))
    .to(hudTitle, { opacity: 1, duration: 0.5 });
}

shapeSections.forEach((sec) =>
  ScrollTrigger.create({
    trigger: sec,
    start: 'top 55%',
    end: 'bottom 55%',
    onEnter: () => goToShape(sec),
    onEnterBack: () => goToShape(sec),
  })
);

ScrollTrigger.create({
  start: 0,
  end: 'max',
  onUpdate: (self) => {
    $('[data-hud-progress]').style.transform = `scaleX(${self.progress})`;
    if (state.field) {
      state.field.velocity = self.getVelocity() / 100;
      state.field.scrollProgress = self.progress;
    }
  },
});

/* ------------------------------------------------------------------ hero parallax */
gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } })
  .to('.hero__title .line:nth-child(1)', { xPercent: -5 }, 0)
  .to('.hero__title .line:nth-child(2)', { xPercent: 4 }, 0)
  .to('.hero__main, .hero__bottom', { yPercent: -12, opacity: 0.2 }, 0);

/* ------------------------------------------------------------------ marquee (velocity-reactive) */
{
  const track = $('[data-marquee]');
  track.innerHTML += track.innerHTML;
  let x = 0, dir = -1;
  const speed = () => (state.motion ? 1 : 0.15);
  gsap.ticker.add((_, dt) => {
    const v = lenis.velocity || 0;
    if (Math.abs(v) > 0.5) dir = v > 0 ? -1 : 1;
    x += dir * (0.035 * dt * speed() + Math.abs(v) * 0.04);
    const w = track.scrollWidth / 2;
    if (x < -w) x += w;
    if (x > 0) x -= w;
    track.style.transform = `translate3d(${x}px,0,0)`;
  });
}


/* ------------------------------------------------------------------ fit display type */
// Syne 800 is very wide: shrink big headings so their longest word never overflows.
const fitTargets = [];
function measureFit() {
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;left:-9999px;top:0';
  document.body.appendChild(probe);
  const words = (el) => el.textContent.trim().split(/\s+/);
  const ratioFor = (el, text) => {
    const cs = getComputedStyle(el);
    probe.style.font = cs.font;
    probe.style.letterSpacing = cs.letterSpacing;
    probe.style.textTransform = cs.textTransform;
    probe.textContent = text;
    return probe.getBoundingClientRect().width / parseFloat(cs.fontSize);
  };
  // hero: one word per line, line 2 is indented
  const hero = $('.hero__title');
  fitTargets.push({
    el: hero,
    lines: $$('.line', hero).map((line) => ({ line, ratio: ratioFor(hero, line.textContent.trim()) })),
  });
  $$('.h-xl, .contact__big, .work__more-big, .project__title, .h-lg').forEach((el) => {
    fitTargets.push({ el, ratio: Math.max(...words(el).map((w) => ratioFor(el, w))) });
  });
  document.body.removeChild(probe);
  applyFit();
}
function applyFit() {
  for (const t of fitTargets) {
    t.el.style.fontSize = '';
    const css = parseFloat(getComputedStyle(t.el).fontSize);
    let max;
    if (t.lines) {
      max = Math.min(...t.lines.map(({ line, ratio }) => {
        const cs = getComputedStyle(line);
        const avail = line.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        return (avail * 0.97) / ratio;
      }));
    } else {
      const par = t.el.parentElement, pcs = getComputedStyle(par);
      const avail = par.clientWidth - parseFloat(pcs.paddingLeft) - parseFloat(pcs.paddingRight);
      max = (avail * 0.97) / t.ratio;
    }
    if (css > max) t.el.style.fontSize = `${max}px`;
  }
}
window.addEventListener('resize', () => { applyFit(); ScrollTrigger.refresh(); });

/* ------------------------------------------------------------------ text reveals */
function splitReveals() {
  $$('[data-split]').forEach((el) => {
    SplitText.create(el, {
      type: 'lines,words', mask: 'lines', linesClass: 'split-line', wordsClass: 'split-word', autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.lines, {
          yPercent: 105, duration: 1.5, ease: 'expo.out', stagger: 0.12,
          scrollTrigger: { trigger: el, start: 'top 85%' },
        }),
    });
  });

  // manifesto: words light up as you scroll
  $$('[data-words]').forEach((el) => {
    const split = SplitText.create(el, { type: 'words', wordsClass: 'w' });
    gsap.to(split.words, {
      opacity: 1, stagger: 0.1, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 75%', end: 'bottom 45%', scrub: true },
    });
  });

  $$('[data-reveal]').forEach((el) =>
    gsap.from(el, { opacity: 0, y: 24, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' } })
  );
  gsap.utils.toArray('.pillar, .stat, .lane, .award, .edu, .project').forEach((el) =>
    gsap.from(el, { opacity: 0, y: 40, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%' } })
  );
}

/* ------------------------------------------------------------------ counters */
$$('[data-count]').forEach((el) => {
  const end = Number(el.dataset.count);
  ScrollTrigger.create({
    trigger: el,
    start: 'top 85%',
    once: true,
    onEnter: () => {
      if (el.dataset.final) {
        el.textContent = el.dataset.final;
        gsap.from(el, { opacity: 0, duration: 1.4, ease: 'power2.out' });
        return;
      }
      const o = { v: 0 };
      gsap.to(o, { v: end, duration: 2, ease: 'power3.out', onUpdate: () => (el.textContent = Math.round(o.v)) });
    },
  });
});

/* ------------------------------------------------------------------ capabilities accordion */
$$('.cap').forEach((cap, i) => {
  const head = $('.cap__head', cap);
  head.addEventListener('click', () => {
    const open = !cap.classList.contains('is-open');
    cap.classList.toggle('is-open', open);
    head.setAttribute('aria-expanded', open);
    sound.blip(open ? 1600 : 900);
  });
  if (i === 0) { cap.classList.add('is-open'); head.setAttribute('aria-expanded', 'true'); }
});

/* ------------------------------------------------------------------ cursor */
if (!isTouch) {
  const cursor = $('.cursor');
  const dot = $('.cursor__dot'), ring = $('.cursor__ring'), label = $('.cursor__label');
  const dx = gsap.quickTo(dot, 'x', { duration: 0.08 }), dy = gsap.quickTo(dot, 'y', { duration: 0.08 });
  const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' }), ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });
  window.addEventListener('pointermove', (e) => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); }, { passive: true });
  document.addEventListener('pointerover', (e) => {
    const lab = e.target.closest('[data-cursor]');
    const link = e.target.closest('a, button');
    cursor.classList.toggle('is-label', !!lab && !link);
    cursor.classList.toggle('is-hover', !!link);
    if (lab) label.textContent = lab.dataset.cursor;
    if (link && !link.dataset.blipped) { sound.blip(); }
  });
}

/* ------------------------------------------------------------------ magnetic + tilt */
if (!isTouch) {
  $$('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.9, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.9, ease: 'power3.out' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const s = el.classList.contains('contact__big') ? 0.06 : 0.2;
      xTo((e.clientX - r.left - r.width / 2) * s);
      yTo((e.clientY - r.top - r.height / 2) * s);
    });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });

  $$('[data-tilt]').forEach((el) => {
    const rxTo = gsap.quickTo(el, 'rotationX', { duration: 0.6 }), ryTo = gsap.quickTo(el, 'rotationY', { duration: 0.6 });
    gsap.set(el, { transformPerspective: 900 });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      el.style.setProperty('--mx', `${px * 100}%`);
      el.style.setProperty('--my', `${py * 100}%`);
      rxTo((0.5 - py) * 4); ryTo((px - 0.5) * 5);
    });
    el.addEventListener('pointerleave', () => { rxTo(0); ryTo(0); });
  });
}


/* ------------------------------------------------------------------ menu + settings */
const menuBtn = $('[data-menu]');
function closeMenu() {
  document.documentElement.classList.remove('menu-open');
  menuBtn.setAttribute('aria-expanded', 'false');
  $('[data-menu-panel]').setAttribute('aria-hidden', 'true');
}
menuBtn.addEventListener('click', () => {
  const open = !document.documentElement.classList.contains('menu-open');
  document.documentElement.classList.toggle('menu-open', open);
  menuBtn.setAttribute('aria-expanded', open);
  $('[data-menu-panel]').setAttribute('aria-hidden', !open);
  if (open) gsap.from('.menu__list li', { yPercent: 60, opacity: 0, stagger: 0.06, duration: 0.9, ease: 'expo.out', delay: 0.2 });
});
window.addEventListener('keydown', (e) => e.key === 'Escape' && closeMenu());

$$('[data-sound]').forEach((b) =>
  b.addEventListener('click', () => {
    const on = sound.toggle();
    document.documentElement.classList.toggle('is-sound', on);
    $$('[data-sound]').forEach((x) => x.setAttribute('aria-pressed', on));
    $$('[data-sound-label]').forEach((x) => (x.textContent = on ? 'Sound on' : 'Sound off'));
  })
);
$('[data-motion]').addEventListener('click', (e) => {
  state.motion = !state.motion;
  e.currentTarget.setAttribute('aria-pressed', state.motion);
  e.currentTarget.textContent = state.motion ? 'Motion on' : 'Motion off';
  lenis.options.smoothWheel = state.motion;
  if (state.field) state.field.u.calm.value = state.motion ? 1 : 0.15;
});
$('[data-quality]').addEventListener('click', (e) => {
  state.quality = !state.quality;
  e.currentTarget.setAttribute('aria-pressed', state.quality);
  e.currentTarget.textContent = state.quality ? 'Quality high' : 'Quality low';
  state.field?.setQuality(state.quality);
});

/* ------------------------------------------------------------------ misc */
const clock = $('[data-clock]');
const tickClock = () =>
  (clock.textContent = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date()));
tickClock();
setInterval(tickClock, 10000);

$('[data-copy]').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const lbl = $('[data-copy-label]', btn);
  try { await navigator.clipboard.writeText(btn.dataset.copy); } catch { /* ignore */ }
  lbl.textContent = 'Copied to clipboard';
  sound.blip(2000);
  setTimeout(() => (lbl.textContent = btn.dataset.copy), 1800);
});


initGraph($('[data-graph]'));
initPodcast($('.project__visual--pod'));
const lab = initLab($('#lab'));

/* ------------------------------------------------------------------ ask my résumé */
const consoleEl = $('.console');
let busyTimer = 0;
const asker = initAsk($('#ask'), {
  onQuery: () => {
    state.field?.pulse(0.7);
    sound.whoosh();
    consoleEl.classList.add('is-busy');
    clearTimeout(busyTimer);
    busyTimer = setTimeout(() => consoleEl.classList.remove('is-busy'), 1500);
  },
});
window.addEventListener('keydown', (e) => {
  const typing = /input|textarea/i.test(document.activeElement?.tagName || '');
  if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) {
    e.preventDefault();
    closeMenu();
    lenis.scrollTo('#ask', { offset: -40, duration: 1.4, onComplete: () => asker.focus() });
  }
});

/* ------------------------------------------------------------------ chapter rail */
{
  const links = $$('[data-rail]');
  const setActive = (id) => links.forEach((a) => a.classList.toggle('is-active', a.dataset.rail === id));
  links.forEach((a) => {
    const target = a.dataset.rail === 'top' ? $('.hero') : document.getElementById(a.dataset.rail);
    if (!target) return;
    ScrollTrigger.create({ trigger: target, start: 'top 50%', end: 'bottom 50%', onToggle: (self) => self.isActive && setActive(a.dataset.rail) });
  });
  setActive('top');
}

/* ------------------------------------------------------------------ experience progress */
$$('.job__list').forEach((list) => {
  const items = $$('li', list);
  ScrollTrigger.create({
    trigger: list, start: 'top 65%', end: 'bottom 65%', scrub: true,
    onUpdate: (self) => {
      list.style.setProperty('--p', self.progress.toFixed(4));
      items.forEach((li, i) => li.classList.toggle('is-lit', self.progress >= i / items.length));
    },
  });
});

/* ------------------------------------------------------------------ adaptive quality */
// Measure real frame rate after the intro; step down bloom/DPR on slow GPUs.
function adaptQuality() {
  if (!state.field || !state.quality || params.has('hq')) return;
  let frames = 0;
  const start = performance.now();
  const count = () => frames++;
  gsap.ticker.add(count);
  setTimeout(() => {
    gsap.ticker.remove(count);
    const fps = (frames * 1000) / (performance.now() - start);
    if (fps < 40) {
      state.quality = false;
      state.field.setQuality(false);
      const btn = $('[data-quality]');
      btn.setAttribute('aria-pressed', 'false');
      btn.textContent = 'Quality low';
    }
  }, 2500);
}
ScrollTrigger.create({ trigger: '#lab', start: 'top 45%', once: true, onEnter: () => lab.run() });

boot();
