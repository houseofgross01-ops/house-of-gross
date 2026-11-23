/* HOGS motion engine. No dependencies.
   Principles (from Apple's fluid-interface model):
   - every animation starts from the current on-screen value and can be interrupted
   - gestures hand their release velocity to a spring, and flicks project momentum
   - one requestAnimationFrame loop drives everything and sleeps when nothing moves
   - layout is measured on resize only; scroll frames never read layout */
(() => {
'use strict';
const d = document, root = d.documentElement, body = d.body;
const $ = (q, r = d) => r.querySelector(q), $$ = (q, r = d) => [...r.querySelectorAll(q)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
let RM = mqReduce.matches;
const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
const isNarrow = () => innerWidth <= 900;
const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { sessionStorage.removeItem(k); } catch (e) {} },
};

/* ---------- spring: damping ratio + response (seconds), mass 1 ---------- */
class Spring {
  constructor(v = 0, damping = 1, response = .4) { this.x = v; this.t = v; this.v = 0; this.tune(damping, response); }
  tune(z, r) { this.k = (2 * Math.PI / r) ** 2; this.c = 4 * Math.PI * z / r; return this; }
  to(t, vel) { this.t = t; if (vel !== undefined) this.v = vel; return this; }
  snap(v) { this.x = this.t = v; this.v = 0; return this; }
  step(dt) {
    const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
    for (let i = 0; i < n; i++) { const a = -this.k * (this.x - this.t) - this.c * this.v; this.v += a * h; this.x += this.v * h; }
    if (this.rest) { this.x = this.t; this.v = 0; }
    return this.x;
  }
  get rest() { return Math.abs(this.x - this.t) < .005 && Math.abs(this.v) < .02; }
}
// Apple's momentum projection (exponential decay, as in Designing Fluid Interfaces)
const project = (v, rate = .998) => (v / 1000) * rate / (1 - rate);
const rubber = (o, dim, c = .55) => (o * dim * c) / (dim + c * Math.abs(o));

/* ---------- the loop ---------- */
const tasks = new Set();
let raf = 0, last = 0, idle = 0;
function frame(now) {
  const dt = Math.min(.1, Math.max(.001, (now - last) / 1000)); last = now;
  let busy = false;
  for (const t of tasks) { try { if (t(dt, now)) busy = true; } catch (e) { tasks.delete(t); console.error(e); } }
  idle = busy ? 0 : idle + 1;
  raf = idle > 40 ? 0 : requestAnimationFrame(frame);
}
function wake() { idle = 0; if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
const addTask = fn => { tasks.add(fn); wake(); return () => tasks.delete(fn); };

/* ---------- scroll state ---------- */
const S = { y: scrollY, vel: 0, vh: innerHeight, vw: innerWidth, max: 1, dir: 1 };
let prevY = scrollY;
let stepSmooth = () => false;
addTask(dt => {
  const sm = stepSmooth(dt);          // write the smoothed position first, so every effect reads this frame's scroll
  S.y = scrollY;
  const raw = (S.y - prevY) / dt; prevY = S.y;
  S.vel += (raw - S.vel) * Math.min(1, dt * 12);
  if (Math.abs(raw) > 30) S.dir = Math.sign(raw);
  const sc = Math.abs(S.vel) > 60; if (sc !== S.scrolling) { S.scrolling = sc; root.classList.toggle('is-scrolling', sc); }
  return sm || Math.abs(S.vel) > 5;
});
addEventListener('scroll', wake, { passive: true });

/* ---------- smooth wheel (desktop mouse/trackpad only) ---------- */
const smooth = { on: false, target: scrollY, cur: scrollY, written: -1, lock: false };
function scrollableParent(el) {
  for (; el && el !== body && el !== root; el = el.parentElement) {
    if (el.matches && el.matches('[data-lb], .menu, textarea')) return el;
    const cs = getComputedStyle(el);
    if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) return el;
  }
  return null;
}
function initSmooth() {
  if (RM || !FINE) return;
  smooth.on = true; root.classList.add('has-smooth');
  addEventListener('wheel', e => {
    if (e.ctrlKey || smooth.lock || e.defaultPrevented) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (scrollableParent(e.target)) return;
    e.preventDefault();
    const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? S.vh : 1;
    smooth.target = clamp(smooth.target + e.deltaY * k, 0, S.max);
    wake();
  }, { passive: false });
  addEventListener('scroll', () => {
    // anything that isn't us (keyboard, scrollbar, find-in-page) resyncs the target
    if (Math.abs(scrollY - smooth.written) > 2) { smooth.target = smooth.cur = scrollY; }
  }, { passive: true });
  stepSmooth = dt => {
    const diff = smooth.target - smooth.cur;
    if (Math.abs(diff) < .4) { if (smooth.cur !== smooth.target) { smooth.cur = smooth.target; } return false; }
    smooth.cur += diff * (1 - Math.exp(-dt * 9.5));
    smooth.written = Math.round(smooth.cur);
    scrollTo(0, smooth.cur);
    return true;
  };
}
function goTo(y, instant) {
  y = clamp(y, 0, S.max);
  if (RM || instant) { scrollTo(0, y); smooth.target = smooth.cur = y; return; }
  if (smooth.on) { smooth.target = y; wake(); } else scrollTo({ top: y, behavior: 'smooth' });
}

/* ---------- measurement ---------- */
const measurers = new Set();
function measure() {
  S.vh = innerHeight; S.vw = innerWidth;
  for (let pass = 0; pass < 2; pass++) for (const m of measurers) m();
  S.max = Math.max(1, root.scrollHeight - innerHeight);
  smooth.target = clamp(smooth.target, 0, S.max);
  wake();
}
let rT;
addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(measure, 120); });
const docTop = el => { const r = el.getBoundingClientRect(); return r.top + scrollY; };

/* ---------- split text ---------- */
function split(el) {
  const mode = el.dataset.split; let ci = 0, wi = 0;
  const label = el.textContent.replace(/\s+/g, ' ').trim();
  const walk = node => {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const parts = n.textContent.split(/(\s+)/); const frag = d.createDocumentFragment();
        parts.forEach(p => {
          if (!p) return;
          if (/^\s+$/.test(p)) { frag.append(d.createTextNode(' ')); return; }
          const w = d.createElement('span'); w.className = 'sw';
          if (mode === 'chars') {
            [...p].forEach(ch => { const c = d.createElement('span'); c.className = 'sc'; c.style.setProperty('--ci', ci++); c.textContent = ch; w.append(c); });
          } else {
            const i = d.createElement('span'); i.className = 'swi'; i.style.setProperty('--wi', wi); i.textContent = p; w.append(i);
          }
          wi++; frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.getAttribute('aria-hidden') !== 'true' && n.tagName !== 'IMG' && n.tagName !== 'BR') walk(n);
    });
  };
  walk(el);
  if (mode === 'chars' && !el.hasAttribute('aria-label')) el.setAttribute('aria-label', label);
  if (mode === 'chars') $$('.sw', el).forEach(w => w.setAttribute('aria-hidden', 'true'));
}


function initNav() {
  const nav = $('[data-nav]'); if (!nav) return;
  const prog = $('.nav__progress', nav);
  let hidden = false, scrolled = false, anchorY = 0;
  addTask(() => {
    const y = S.y;
    const sc = y > 40; if (sc !== scrolled) { scrolled = sc; nav.classList.toggle('is-scrolled', sc); }
    const focused = nav.contains(d.activeElement) && d.activeElement.matches(':focus-visible');
    if (focused) { if (hidden) { hidden = false; nav.classList.remove('is-hidden'); } anchorY = y; }
    else if (!root.classList.contains('menu-open')) {
      if (y < 140) { if (hidden) { hidden = false; nav.classList.remove('is-hidden'); } anchorY = y; }
      else if (y > anchorY + 60 && !hidden) { hidden = true; nav.classList.add('is-hidden'); anchorY = y; }
      else if (y < anchorY - 40 && hidden) { hidden = false; nav.classList.remove('is-hidden'); anchorY = y; }
      else if ((hidden && y > anchorY) || (!hidden && y < anchorY)) anchorY = y;
    }
    prog.style.setProperty('--sp', (y / S.max).toFixed(4));
    return false;
  });
  // keyboard users should always be able to reach the nav
  nav.addEventListener('focusin', () => { hidden = false; nav.classList.remove('is-hidden'); });
}

function initGlass() {
  if (FINE) {
    d.addEventListener('pointermove', e => {
      const g = e.target.closest && e.target.closest('.glass, .btn--glass'); if (!g) return;
      const r = g.getBoundingClientRect();
      g.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      g.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    }, { passive: true });
  }
  const chromium = !!(navigator.userAgentData && navigator.userAgentData.brands && navigator.userAgentData.brands.some(b => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand)));
  if (!chromium || matchMedia('(prefers-reduced-transparency: reduce)').matches) return;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = d.createElementNS(NS, 'svg'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  body.append(svg);
  let n = 0;
  const lens = el => {
    const id = 'hogs-lens-' + (n++);
    const filter = d.createElementNS(NS, 'filter');
    filter.setAttribute('id', id); filter.setAttribute('color-interpolation-filters', 'sRGB');
    filter.setAttribute('x', '0'); filter.setAttribute('y', '0'); filter.setAttribute('width', '100%'); filter.setAttribute('height', '100%');
    const fe = d.createElementNS(NS, 'feImage'); fe.setAttribute('result', 'map'); fe.setAttribute('preserveAspectRatio', 'none');
    const dm = d.createElementNS(NS, 'feDisplacementMap');
    dm.setAttribute('in', 'SourceGraphic'); dm.setAttribute('in2', 'map'); dm.setAttribute('xChannelSelector', 'R'); dm.setAttribute('yChannelSelector', 'G');
    filter.append(fe, dm); svg.append(filter);
    const build = () => {
      const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight); if (!w || !h) return;
      const rad = Math.min(h / 2, parseFloat(getComputedStyle(el).borderTopLeftRadius) || h / 2);
      const band = Math.min(22, h * .36);
      const c = d.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d'); const img = ctx.createImageData(w, h); const px = img.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        // signed distance to a rounded rect, and its inward normal
        const qx = Math.abs(x + .5 - w / 2) - (w / 2 - rad), qy = Math.abs(y + .5 - h / 2) - (h / 2 - rad);
        const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
        const dist = rad - (Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0));
        let nx = 0, ny = 0;
        if (qx > 0 || qy > 0) { const l = Math.hypot(ox, oy) || 1; nx = ox / l; ny = oy / l; }
        else if (qx > qy) nx = 1; else ny = 1;
        nx *= Math.sign(x + .5 - w / 2); ny *= Math.sign(y + .5 - h / 2);
        const t = clamp(1 - dist / band, 0, 1), m = t * t * (3 - 2 * t);
        const i = (y * w + x) * 4;
        px[i] = 128 - nx * m * 127; px[i + 1] = 128 - ny * m * 127; px[i + 2] = 128; px[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      fe.setAttribute('href', c.toDataURL()); fe.setAttribute('width', w); fe.setAttribute('height', h);
      dm.setAttribute('scale', Math.round(Math.min(46, h * .7)));
      el.style.backdropFilter = el.style.webkitBackdropFilter = `blur(2px) url(#${id}) blur(12px) saturate(190%) brightness(1.06)`;
    };
    build(); new ResizeObserver(() => build()).observe(el);
  };
  $$('[data-glass], .wk__bar').forEach(lens);
}

function initMagnetic() {
  if (!FINE || RM) return;
  $$('[data-magnetic]').forEach(el => {
    const sx = new Spring(0, .7, .45), sy = new Spring(0, .7, .45); let on = false;
    const move = e => {
      const r = el.getBoundingClientRect();
      sx.to(clamp((e.clientX - (r.left + r.width / 2)) * .32, -16, 16)); sy.to(clamp((e.clientY - (r.top + r.height / 2)) * .38, -12, 12));
      if (!on) { on = true; addTask(tick); }
    };
    const tick = dt => {
      sx.step(dt); sy.step(dt); el.style.translate = `${sx.x.toFixed(2)}px ${sy.x.toFixed(2)}px`;
      if (sx.rest && sy.rest && sx.t === 0 && sy.t === 0) { on = false; tasks.delete(tick); el.style.translate = ''; return false; }
      return true;
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', () => { sx.to(0); sy.to(0); wake(); });
  });
}

function initHoverLists() {
  if (!FINE || RM) return;
  $$('[data-hover-list]').forEach(list => {
    const sec = list.closest('section'); const f = $('[data-hover-follower]', sec); if (!f) return;
    const inner = $('.hover-img__inner', f); const imgs = new Map();
    const sx = new Spring(0, .9, .5), sy = new Spring(0, .9, .5); let on = false, seen = false, rot = 0;
    $$('[data-hover-img]', list).forEach(row => {
      row.addEventListener('pointerenter', () => {
        const src = row.dataset.hoverImg;
        if (!imgs.has(src)) { const i = new Image(); i.src = src; i.alt = ''; i.decoding = 'async'; imgs.set(src, i); }
        const i = imgs.get(src);
        if (inner.firstChild !== i) { inner.replaceChildren(i); i.animate([{ transform: 'scale(1.3)', opacity: .4 }, { transform: 'scale(1)', opacity: 1 }], { duration: 700, easing: 'cubic-bezier(.16,1,.3,1)' }); }
      });
    });
    list.addEventListener('pointerenter', e => { if (!seen) { sx.snap(Math.min(e.clientX + 56, S.vw - f.offsetWidth - 24)); sy.snap(e.clientY - f.offsetHeight / 2); seen = true; } f.classList.add('is-on'); on = true; wake(); });
    list.addEventListener('pointerleave', () => { f.classList.remove('is-on'); on = false; });
    let fw = 0, fh = 0;
    list.addEventListener('pointermove', e => {
      if (!fw) { fw = f.offsetWidth; fh = f.offsetHeight; }
      // trail beside the cursor so the image never covers the word being read; stay on screen
      sx.to(Math.min(e.clientX + 56, S.vw - fw - 24)); sy.to(clamp(e.clientY - fh / 2, 16, S.vh - fh - 16)); wake();
    }, { passive: true });
    addEventListener('resize', () => { fw = 0; });
    addTask(dt => {
      sx.step(dt); sy.step(dt); rot += (clamp(sx.v * .012, -10, 10) - rot) * Math.min(1, dt * 10);
      f.style.setProperty('--hx', sx.x.toFixed(1) + 'px'); f.style.setProperty('--hy', sy.x.toFixed(1) + 'px'); f.style.setProperty('--hr', rot.toFixed(2) + 'deg');
      return on || !(sx.rest && sy.rest) || Math.abs(rot) > .05;
    });
  });
}

function initTilt() {
  if (!FINE || RM) return;
  $$('[data-tilt]').forEach(el => {
    const rx = new Spring(0, .8, .5), ry = new Spring(0, .8, .5); let on = false;
    const tick = dt => {
      rx.step(dt); ry.step(dt);
      el.style.setProperty('--rx', rx.x.toFixed(2) + 'deg'); el.style.setProperty('--ry', ry.x.toFixed(2) + 'deg');
      const live = !(rx.rest && ry.rest) || rx.t || ry.t; if (!live) { on = false; tasks.delete(tick); }
      return live;
    };
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      rx.to((.5 - y) * 9); ry.to((x - .5) * 11);
      el.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      if (!on) { on = true; addTask(tick); }
    });
    el.addEventListener('pointerleave', () => { rx.to(0); ry.to(0); wake(); });
  });
}

function initProximity() {
  if (!FINE || RM) return;
  $$('[data-proximity]').forEach(host => {
    let chars = [], on = false, mx = 0, my = 0, live = false, y0 = 0;
    // centres are measured once when the pointer arrives (relative to the page), never inside the frame loop
    const prep = () => { y0 = S.y; chars = $$('.sc', host).map(el => { const r = el.getBoundingClientRect(); return { el, em: !!el.closest('em'), v: 0, x: r.left + r.width / 2, y: r.top + r.height / 2, w: -1 }; }); };
    const tick = dt => {
      const k = 1 - Math.exp(-13 * dt), rad = 260, dy = S.y - y0; let moving = false;
      for (const c of chars) {
        let t = 0;
        if (on) { t = clamp(1 - Math.hypot(mx - c.x, my - (c.y - dy)) / rad, 0, 1); t = t * t * (3 - 2 * t); }
        c.v += (t - c.v) * k; if (Math.abs(t - c.v) > .002) moving = true;
        const wgt = Math.round(c.em ? 420 + c.v * 420 : 340 + c.v * 380);
        if (wgt !== c.w) { c.w = wgt; c.el.style.fontWeight = wgt; }
      }
      if (!moving && !on) { live = false; tasks.delete(tick); }
      return moving || on;
    };
    host.addEventListener('pointerenter', () => { if (!live) prep(); });
    host.addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; on = true; if (!chars.length) prep(); if (!live) { live = true; addTask(tick); } wake(); });
    host.addEventListener('pointerleave', () => { on = false; wake(); });
  });
}

function initMotionToggle() {
  const b = $('[data-motion-toggle]'); if (!b) return;
  const set = on => { root.classList.toggle('motion-paused', on); b.setAttribute('aria-pressed', String(on)); $('.roll__a', b) && ($('.roll__a', b).textContent = on ? 'Play motion' : 'Pause motion'); $('.roll__b', b) && ($('.roll__b', b).textContent = on ? 'Play motion' : 'Pause motion'); };
  let on = false; try { on = localStorage.getItem('hogs:paused') === '1'; } catch (e) {}
  set(on);
  b.addEventListener('click', () => { on = !on; set(on); try { localStorage.setItem('hogs:paused', on ? '1' : '0'); } catch (e) {} wake(); });
}

function initPanels() {
  $$('[data-xp]').forEach(list => {
    const ps = $$('.xp__panel', list); let cur = 0;
    const set = i => { cur = i; ps.forEach((p, k) => { p.classList.toggle('is-on', k === i); }); };
    set(0);
    ps.forEach((p, i) => {
      p.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') set(i); });
      p.addEventListener('focusin', () => set(i));
      // touch on wide screens: first tap opens the panel, second tap follows the link
      $('a', p).addEventListener('click', e => { if (!FINE && !isNarrow() && cur !== i) { e.preventDefault(); set(i); } });
    });
  });
}

function initCounters() {
  const els = $$('[data-countup]'); if (!els.length) return;
  const ob = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; ob.unobserve(e.target);
    const el = e.target, to = +el.dataset.countup, pad = el.dataset.countup.length;
    if (RM) { el.textContent = el.dataset.countup; return; }
    const t0 = performance.now(), dur = 1500 + to * 8;
    const step = now => { const k = Math.min(1, (now - t0) / dur), v = Math.round(to * (1 - Math.pow(1 - k, 4))); el.textContent = String(v).padStart(pad, '0'); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }), { threshold: .6 });
  els.forEach(el => { el.textContent = '0'.repeat(el.dataset.countup.length); ob.observe(el); });
}

function sceneRange(el) {
  const o = { el, top: 0, h: 1 };
  measurers.add(() => { o.top = docTop(el); o.h = el.offsetHeight; });
  return o;
}

function initLine() {
  $$('[data-scene="line"]').forEach(el => {
    const o = sceneRange(el); let last = -1;
    addTask(() => { if (RM) return false; const p = pinP(o); if (Math.abs(p - last) > .0004) { last = p; el.style.setProperty('--p', p.toFixed(4)); } return false; });
  });
}

function initSimpleProgress(sel, fn) {
  $$(sel).forEach(el => {
    const o = sceneRange(el); let last = -1;
    addTask(() => { if (RM) return false; const p = fn(o); if (Math.abs(p - last) > .0005) { last = p; el.style.setProperty('--p', p.toFixed(4)); } return false; });
  });
}

function initParallax() {
  if (RM) return;
  const items = $$('[data-parallax], .dx__fig').map(el => ({ el, f: parseFloat(el.dataset.parallax || '.1'), c: 0, h: 0, inner: el.matches('.dx__fig, .pov__wide') }));
  if (!items.length) return;
  measurers.add(() => items.forEach(it => { const t = it.el.style.getPropertyValue('--py'); it.el.style.removeProperty('--py'); it.c = docTop(it.el) + it.el.offsetHeight / 2; it.h = it.el.offsetHeight; if (t) it.el.style.setProperty('--py', t); }));
  let lastY = -1;
  addTask(() => {
    if (S.y === lastY) return false; lastY = S.y;
    const mid = S.y + S.vh / 2;
    for (const it of items) {
      const dlt = it.c - mid; if (Math.abs(dlt) > S.vh * 1.4) continue;
      let v = dlt * it.f; if (it.inner) v = clamp(v, -it.h * .09, it.h * .09) - it.h * .09;
      it.el.style.setProperty('--py', v.toFixed(1) + 'px');
    }
    return false;
  });
}

function initStack() {
  const list = $('[data-stack]'); if (!list || RM) return;
  const cards = $$('.stack__card', list); let tops = [], sticks = [];
  measurers.add(() => {
    cards.forEach(c => c.style.removeProperty('--ks'));
    const base = docTop(list); const gap = parseFloat(getComputedStyle(list).rowGap) || 0; let acc = 0;
    tops = cards.map(c => { const t = base + acc; acc += c.offsetHeight + gap; return t; });
    sticks = cards.map(c => parseFloat(getComputedStyle(c).top) || 0);
  });
  let lastY = -1;
  addTask(() => {
    if (S.y === lastY) return false; lastY = S.y;
    const arrive = cards.map((c, i) => clamp(1 - (tops[i] - S.y - sticks[i]) / (S.vh * .85), 0, 1));
    cards.forEach((c, i) => {
      let depth = 0; for (let j = i + 1; j < cards.length; j++) depth += arrive[j];
      c.style.setProperty('--ks', (1 - depth * .045).toFixed(4));
      $('.stack__inner', c).style.setProperty('--kd', Math.min(.55, depth * .28).toFixed(3));
    });
    return false;
  });
}

function initDx() {
  const sec = $('[data-scene="dx"]'); if (!sec) return;
  const items = $$('[data-dx]', sec), bigs = $$('[data-dx-big]', sec), bar = $('[data-dx-bar]', sec);
  let tops = [], cur = -1, start = 0, end = 1;
  measurers.add(() => { tops = items.map(docTop); start = tops[0]; const lastEl = items[items.length - 1]; end = docTop(lastEl) + lastEl.offsetHeight; });
  const setCur = i => { if (i === cur) return; cur = i; bigs.forEach((b, k) => { b.classList.toggle('is-on', k === i); b.classList.toggle('is-past', k < i); }); };
  setCur(0);
  addTask(() => {
    const mid = S.y + S.vh * .5; let i = 0; tops.forEach((t, k) => { if (mid >= t) i = k; }); setCur(i);
    bar && bar.parentElement.style.setProperty('--dxp', clamp((mid - start) / Math.max(1, end - start), 0, 1).toFixed(4));
    return false;
  });
}

function initMarquee() {
  $$('[data-marquee]').forEach(m => {
    const tr = $('.mq__track', m); let w = 0, x = 0, vis = false, skew = new Spring(0, 1, .5);
    measurers.add(() => { w = tr.offsetWidth; });
    new IntersectionObserver(([e]) => { vis = e.isIntersecting; if (vis) wake(); }).observe(m);
    let held = false; const host = m.closest('section') || m;
    host.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') held = true; });
    host.addEventListener('pointerleave', () => { held = false; wake(); });
    addTask(dt => {
      if (!vis) return false;
      if (RM) { m.style.setProperty('--mx-x', '0px'); return false; }
      const speed = held || root.classList.contains('motion-paused') ? 0 : 70 + Math.min(1600, Math.abs(S.vel)) * .5;
      x -= speed * S.dir * dt; if (w) { x %= w; if (x > 0) x -= w; }
      skew.to(clamp(-S.vel * .006, -10, 10)); skew.step(dt);
      m.style.setProperty('--mx-x', x.toFixed(1) + 'px'); m.style.setProperty('--mq-skew', skew.x.toFixed(2) + 'deg');
      return true;
    });
  });
}

function initTicker() {
  const w = $('[data-ticker]'); if (!w || RM) return;
  const words = ['Strategy', 'Creative', 'Storytelling']; let i = 0;
  setInterval(() => {
    if (d.hidden || root.classList.contains('motion-paused') || w.closest('.is-paused')) return;
    w.classList.add('is-out');
    setTimeout(() => { i = (i + 1) % words.length; w.textContent = words[i]; w.classList.remove('is-out'); w.classList.add('is-pre'); void w.offsetWidth; w.classList.remove('is-pre'); }, 650);
  }, 2600);
}

function toast(msg) {
  const t = $('[data-toast]'); if (!t) return;
  t.textContent = msg; t.classList.add('is-on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('is-on'), 2200);
}

function initCopyEmail() {
  $$('[data-copy]').forEach(b => b.addEventListener('click', async () => {
    const ok = await copy(b.dataset.copy);
    if (ok) { b.classList.add('is-done'); toast('Email copied. Talk soon.'); setTimeout(() => b.classList.remove('is-done'), 1800); }
    else location.href = 'mailto:' + b.dataset.copy;
  }));
}

function initAnchors() {
  d.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]'); if (!a || a.matches('[data-top], .skip')) return;
    const t = $(a.getAttribute('href')); if (!t) return;
    e.preventDefault(); goTo(docTop(t) - 90); history.replaceState(null, '', a.getAttribute('href'));
  });
}

function initWork() {
  const grid = $('[data-masonry]'); if (!grid) return;
  const items = $$('.wk__item', grid); const bar = $('[data-filter]'); const pill = $('.wk__pill', bar);
  let filter = 'All';
  const cols = () => { const w = S.vw; return w <= 640 ? 2 : w <= 1024 ? 3 : w <= 1600 ? 4 : 5; };
  const layout = () => {
    const cs = getComputedStyle(grid); const pad = parseFloat(cs.paddingLeft);
    const W = grid.clientWidth - pad * 2; const c = cols(); const gap = S.vw <= 640 ? 10 : 14; const cw = (W - gap * (c - 1)) / c;
    const hs = new Array(c).fill(0);
    items.forEach(it => {
      const out = filter !== 'All' && it.dataset.kind !== filter; it.classList.toggle('is-out', out); it.inert = out;
      it.style.setProperty('--iw', cw + 'px');
      if (out) return;
      const [aw, ah] = getComputedStyle(it).getPropertyValue('--ar').split('/').map(Number);
      const h = cw * ah / aw; let k = hs.indexOf(Math.min(...hs));
      it.style.setProperty('--ix', (pad + k * (cw + gap)) + 'px'); it.style.setProperty('--iy', hs[k] + 'px');
      hs[k] += h + gap;
    });
    grid.style.setProperty('--mh', Math.max(...hs) + 'px');
  };
  grid.classList.add('is-masonry', 'no-anim'); layout();
  requestAnimationFrame(() => requestAnimationFrame(() => grid.classList.remove('no-anim')));
  let lastW = grid.clientWidth;
  measurers.add(() => { const w = grid.clientWidth; if (w === lastW) return; lastW = w; grid.classList.add('no-anim'); layout(); requestAnimationFrame(() => grid.classList.remove('no-anim')); });
  const movePill = () => {
    const b = $('[aria-pressed="true"]', bar); pill.style.setProperty('--px', b.offsetLeft + 'px'); pill.style.setProperty('--pw', b.offsetWidth + 'px');
  };
  movePill(); if (d.fonts) d.fonts.ready.then(movePill);
  $$('button', bar).forEach(b => b.addEventListener('click', () => {
    filter = b.dataset.f; $$('button', bar).forEach(x => x.setAttribute('aria-pressed', String(x === b))); movePill();
    layout(); items.forEach(it => { if (!it.classList.contains('is-out')) it.classList.add('in'); });
    const shown = items.filter(it => !it.classList.contains('is-out')).length;
    const st = $('[data-filter-status]'); if (st) st.textContent = `Showing ${shown} ${filter === 'All' ? '' : filter.toLowerCase() + ' '}photographs`;
    const gt = docTop(grid); if (gt < S.y) goTo(gt - 140);
    setTimeout(measure, 900);
  }));
  initLightbox(items, () => filter);
  const qf = new URLSearchParams(location.search).get('f');
  if (qf) { const b = $(`[data-f="${CSS.escape(qf)}"]`, bar); if (b && b.getAttribute('aria-pressed') !== 'true') setTimeout(() => b.click(), 60); }
}

function initLightbox(items, getFilter) {
  const lb = $('[data-lb]'); body.append(lb); $('[data-lb-stage]', lb).setAttribute('tabindex', '-1'); const data = JSON.parse($('#wk-data').textContent);
  const stage = $('[data-lb-stage]', lb), cap = $('[data-lb-cap]', lb), count = $('[data-lb-count]', lb);
  let list = [], idx = 0, opener = null, open = false, closing = false;
  const sx = new Spring(0, 1, .42);           // strip offset (px)
  const ox = new Spring(0, 1, .42), oy = new Spring(0, 1, .42), os = new Spring(1, 1, .42); // current slide transform
  const slides = new Map();
  const box = n => {
    const it = data[n]; const pad = S.vw <= 640 ? 16 : 64; const top = S.vw <= 640 ? 80 : 90; const bottom = S.vw <= 640 ? 150 : 110;
    const mw = S.vw - pad * 2, mh = S.vh - top - bottom; const sc = Math.min(mw / it.w, mh / it.h);
    const w = it.w * sc, h = it.h * sc; return { w, h, x: (S.vw - w) / 2, y: top + (mh - h) / 2 };
  };
  const make = n => {
    const it = data[n]; const el = d.createElement('div'); el.className = 'lb__slide'; el.style.setProperty('--tone', getComputedStyle(items[n]).getPropertyValue('--tone'));
    const im = new Image(); im.alt = it.a; im.decoding = 'async';
    im.srcset = it.ws.map(w => `assets/img/${it.n}-${w}.webp ${w}w`).join(', '); im.sizes = '90vw';
    im.src = `assets/img/${it.n}-${Math.max(...it.ws)}.webp`; el.append(im); return el;
  };
  const render = () => {
    const want = new Set([idx - 1, idx, idx + 1].filter(k => k >= 0 && k < list.length).map(k => list[k]));
    for (const [n, el] of slides) if (!want.has(n)) { el.remove(); slides.delete(n); }
    want.forEach(n => { if (!slides.has(n)) { const el = make(n); slides.set(n, el); stage.append(el); } });
    for (const [n, el] of slides) el.setAttribute('aria-hidden', String(n !== list[idx]));
    const it = data[list[idx]];
    cap.innerHTML = ''; cap.append(it.t); const s = d.createElement('span'); s.textContent = it.k + ' photography'; cap.append(s);
    count.textContent = `${idx + 1} / ${list.length}`;
  };
  const paint = () => {
    const gapX = S.vw + 24;
    for (const [n, el] of slides) {
      const k = list.indexOf(n); const b = box(n); el.style.width = b.w + 'px'; el.style.height = b.h + 'px';
      if (k === idx) el.style.transform = `translate3d(${b.x + ox.x + sx.x}px,${b.y + oy.x}px,0) scale(${os.x})`;
      else el.style.transform = `translate3d(${b.x + (k - idx) * gapX + sx.x}px,${b.y}px,0)`;
    }
    const b = box(list[idx]);
    const dragFade = 1 - clamp(Math.abs(oy.x) / (S.vh * .6), 0, .7);
    const openness = clamp((os.x - startScale) / Math.max(.001, 1 - startScale), 0, 1);
    lb.style.setProperty('--so', (Math.min(openness, dragFade)).toFixed(3));
    lb.style.setProperty('--uo', (closing ? 0 : Math.min(openness, dragFade)).toFixed(3));
    void b;
  };
  let startScale = 0;
  const tick = dt => {
    sx.step(dt); ox.step(dt); oy.step(dt); os.step(dt); paint();
    const moving = !(sx.rest && ox.rest && oy.rest && os.rest);
    // finish as soon as it is visually done, not when the spring's invisible tail settles
    if (closing && Math.abs(os.x - os.t) < .004 && Math.abs(ox.x - ox.t) < .6 && Math.abs(oy.x - oy.t) < .6) { finishClose(); return false; }
    return open && (moving || drag.active);
  };
  const fromThumb = n => {
    const r = $('.wk__btn', items[n]).getBoundingClientRect(); const b = box(n);
    const s = r.width / b.w; return { x: r.left - b.x, y: r.top - b.y, s, r, b };
  };
  // transform-origin is top-left, so the thumb's top-left maps directly
  const openAt = n => {
    const f = getFilter(); list = data.map((_, i) => i).filter(i => f === 'All' || data[i].k === f);
    if (closing) finishClose(true);
    if (list.indexOf(n) < 0) list = data.map((_, i) => i);
    idx = Math.max(0, list.indexOf(n)); opener = $('.wk__btn', items[n]);
    lb.style.pointerEvents = ''; root.classList.remove('cursor-hide');
    lb.hidden = false; open = true; closing = false; root.classList.add('lb-open'); smooth.lock = true;
    render();
    $$('.lb__slide', stage).forEach(el => (el.style.transformOrigin = '0 0'));
    const t = fromThumb(n); startScale = t.s;
    ox.snap(t.x); oy.snap(t.y); os.snap(t.s); sx.snap(0);
    if (RM) { ox.snap(0); oy.snap(0); os.snap(1); } else { ox.to(0); oy.to(0); os.to(1); }
    paint(); addTask(tick);
    setTimeout(() => $('[data-lb-close]', lb.querySelector('.lb__ui')).focus({ preventScroll: true }), 50);
  };
  const close = (vy = 0) => {
    if (!open || closing) return; closing = true;
    lb.style.pointerEvents = 'none'; root.classList.remove('lb-open'); smooth.lock = false;
    const n = list[idx]; const vis = !items[n].classList.contains('is-out');
    const r = $('.wk__btn', items[n]).getBoundingClientRect(); const onScreen = vis && r.bottom > 0 && r.top < S.vh;
    if (onScreen && !RM) { const t = fromThumb(n); startScale = Math.min(startScale, t.s); ox.to(t.x); oy.to(t.y, vy); os.to(t.s); sx.to(0); }
    else { os.to(.85); oy.to(oy.x + (vy >= 0 ? 120 : -120), vy); startScale = .85; if (RM) finishClose(); }
    wake();
  };
  const finishClose = silent => {
    if (!open) return; open = false; closing = false; lb.hidden = true; root.classList.remove('lb-open'); smooth.lock = false;
    lb.style.pointerEvents = ''; stage.replaceChildren(); slides.clear(); tasks.delete(tick);
    if (silent) return;
    const n = list[idx]; const b = $('.wk__btn', items[n]) || opener; const r = b.getBoundingClientRect();
    if (r.bottom < 0 || r.top > S.vh) goTo(docTop(b) - S.vh / 2 + r.height / 2, true);
    b.focus({ preventScroll: true });
  };
  const go = (dir, vel = 0) => {
    const ni = idx + dir; if (ni < 0 || ni >= list.length) { sx.to(0, vel); wake(); return; }
    idx = ni; sx.snap(sx.x + dir * (S.vw + 24)); sx.to(0, vel); ox.snap(0); oy.snap(0); os.snap(1);
    render(); $$('.lb__slide', stage).forEach(el => (el.style.transformOrigin = '0 0')); paint(); wake();
  };
  items.forEach((it, i) => $('.wk__btn', it).addEventListener('click', () => openAt(i)));
  $$('[data-lb-close]', lb).forEach(b => b.addEventListener('click', () => close()));
  $('[data-lb-prev]', lb).addEventListener('click', () => go(-1));
  $('[data-lb-next]', lb).addEventListener('click', () => go(1));
  addEventListener('keydown', e => {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'Tab') {
      const f = $$('button', $('.lb__ui', lb)); const i = f.indexOf(d.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
  addEventListener('resize', () => { if (open) paint(); });
  // gestures
  const drag = { active: false, axis: '', x0: 0, y0: 0, hist: [] };
  stage.addEventListener('pointerdown', e => {
    if (!open || closing || e.button !== 0) return;
    stage.setPointerCapture(e.pointerId); stage.focus({ preventScroll: true });
    drag.active = true; drag.axis = ''; drag.x0 = e.clientX - sx.x; drag.y0 = e.clientY - oy.x; drag.hist = [[e.clientX, e.clientY, e.timeStamp]];
    drag.sx = e.clientX; drag.sy = e.clientY;
    // grab mid-flight: freeze springs at their current value
    sx.to(sx.x, 0); oy.to(oy.x, 0); ox.to(ox.x, 0); os.to(os.x, 0);
  });
  stage.addEventListener('pointermove', e => {
    if (!drag.active) return;
    drag.hist.push([e.clientX, e.clientY, e.timeStamp]); if (drag.hist.length > 6) drag.hist.shift();
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.axis && Math.hypot(dx, dy) > 10) drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (drag.axis === 'x') {
      let v = e.clientX - drag.x0;
      if ((idx === 0 && v > 0) || (idx === list.length - 1 && v < 0)) v = rubber(v, S.vw);
      sx.snap(v);
    } else if (drag.axis === 'y') {
      const v = e.clientY - drag.y0; oy.snap(v); os.snap(1 - clamp(Math.abs(v) / S.vh, 0, 1) * .25); ox.snap((e.clientX - drag.sx) * .4);
    }
    paint();
  });
  const end = e => {
    if (!drag.active) return; drag.active = false;
    const h = drag.hist; const a = h[0], b = h[h.length - 1]; const dt = Math.max(1, b[2] - a[2]);
    const vx = (b[0] - a[0]) / dt * 1000, vy = (b[1] - a[1]) / dt * 1000;
    if (drag.axis === 'x') {
      const proj = sx.x + project(vx, .995);
      if (proj < -S.vw * .28 && idx < list.length - 1) go(1, vx); else if (proj > S.vw * .28 && idx > 0) go(-1, vx); else { sx.to(0, vx); wake(); }
    } else if (drag.axis === 'y') {
      const proj = oy.x + project(vy, .995);
      if (Math.abs(proj) > S.vh * .2) close(vy); else { oy.to(0, vy); ox.to(0); os.to(1); wake(); }
    } else if (e.type === 'pointerup' && e.target === stage) close();
    addTask(tick);
  };
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
}

function initAccordion() {
  $$('.cg__det').forEach(det => {
    const sum = $('summary', det), bodyEl = $('.cg__body', det); let anim = null, want = det.open;
    sum.addEventListener('click', e => {
      if (RM) return; e.preventDefault();
      want = !want;                               // intended state lives here, not in animation callbacks
      const from = bodyEl.offsetHeight;           // start from what is on screen right now
      if (anim) { anim.cancel(); anim = null; }
      if (want) {
        det.open = true; const to = bodyEl.scrollHeight;
        anim = bodyEl.animate([{ height: from + 'px', opacity: from ? 1 : 0 }, { height: to + 'px', opacity: 1 }], { duration: 560, easing: 'cubic-bezier(.16,1,.3,1)' });
        if (!from) $$('li', bodyEl).forEach((li, i) => li.animate([{ transform: 'translateY(14px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520, delay: 60 + i * 35, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
      } else {
        anim = bodyEl.animate([{ height: from + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 360, easing: 'cubic-bezier(.76,0,.24,1)', fill: 'forwards' });
      }
      const mine = anim;
      anim.onfinish = () => { if (anim !== mine) return; if (!want) det.open = false; mine.cancel(); anim = null; measure(); };
    });
  });
}

function initLoopsVisibility() {
  const els = $$('.bento__cell--sonic, .bento__cell--lang, .ct__light, .ticker');
  if (!els.length) return;
  const ob = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('is-paused', !e.isIntersecting)));
  els.forEach(el => ob.observe(el));
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {
    const ta = d.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0';
    body.append(ta); ta.select(); let ok = false; try { ok = d.execCommand('copy'); } catch (er) {} ta.remove(); return ok;
  }
}

let closeMenu = () => {};
function initMenu() {
  const btn = $('[data-burger]'), menu = $('[data-menu]'); if (!btn || !menu) return;
  const links = $$('a, [data-menu-close]', menu); $$('.menu__list a', menu).forEach((a, i) => a.style.setProperty('--i', i));
  const outside = [$('main'), $('[data-foot]')].filter(Boolean);
  let open = false, tmr;
  const set = o => {
    clearTimeout(tmr); open = o; btn.setAttribute('aria-expanded', String(o));
    $('.sr-only', btn).textContent = o ? 'Close menu' : 'Open menu';
    if (o) {
      const r = btn.getBoundingClientRect();
      menu.style.setProperty('--ox', r.left + r.width / 2 + 'px'); menu.style.setProperty('--oy', r.top + r.height / 2 + 'px');
      menu.hidden = false; menu.classList.remove('is-closing'); root.classList.add('menu-open'); smooth.lock = true;
      outside.forEach(el => el.inert = true);
      requestAnimationFrame(() => requestAnimationFrame(() => { menu.classList.add('is-open'); }));
      setTimeout(() => links[0] && links[0].focus({ preventScroll: true }), 300);
    } else {
      menu.classList.add('is-closing'); menu.classList.remove('is-open');
      outside.forEach(el => el.inert = false); smooth.lock = false;
      tmr = setTimeout(() => { menu.hidden = true; menu.classList.remove('is-closing'); root.classList.remove('menu-open'); }, 600);
    }
  };
  closeMenu = instant => { if (!open) return; set(false); if (!instant) btn.focus({ preventScroll: true }); };
  btn.addEventListener('click', () => (open ? closeMenu() : set(true)));
  const mc = $('[data-menu-close]', menu); if (mc) mc.addEventListener('click', () => closeMenu());
  addEventListener('keydown', e => {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(); }
    if (e.key === 'Tab') {
      const f = [btn, ...links]; const i = f.indexOf(d.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
  addEventListener('resize', () => { if (open && !isNarrow()) closeMenu(true); });
}

const pinP = o => clamp((S.y - o.top) / Math.max(1, o.h - S.vh), 0, 1);

/* ---------- small maths ---------- */
const lerp = (a, b, t) => a + (b - a) * t;
const sat = v => clamp(v, 0, 1);
const smooth01 = t => t * t * (3 - 2 * t);
const eInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eOut3 = t => 1 - Math.pow(1 - t, 3);
const eIn2 = t => t * t;
const DEG = Math.PI / 180;
// CSS cubic-bezier as a function of progress (Newton with bisection fallback)
function bez(x1, y1, x2, y2) {
  const A = (a, b) => 1 - 3 * b + 3 * a, B = (a, b) => 3 * b - 6 * a, C = a => 3 * a;
  const calc = (t, a, b) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t;
  const slope = (t, a, b) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a);
  return x => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) { const s = slope(t, x1, x2); if (Math.abs(s) < 1e-6) break; t -= (calc(t, x1, x2) - x) / s; }
    if (t < 0 || t > 1 || Math.abs(calc(t, x1, x2) - x) > 1e-4) { let lo = 0, hi = 1; t = x; for (let i = 0; i < 30; i++) { const v = calc(t, x1, x2); if (Math.abs(v - x) < 1e-5) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; } }
    return calc(t, y1, y2);
  };
}
const easeGlide = bez(.25, .75, .2, 1);

/* ---------- reveals ---------- */
let ready, readyResolve; ready = new Promise(r => (readyResolve = r));
let io;
function initReveals() {
  $$('[data-split]').forEach(split);
  const groups = new Map();
  $$('[data-reveal]').forEach(el => { const p = el.parentElement; groups.set(p, (groups.get(p) || 0) + 1); el.style.setProperty('--d', (groups.get(p) - 1) * 90 + 120); });
  io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .14, rootMargin: '0px 0px -6% 0px' });
  ready.then(() => $$('[data-reveal], [data-split], .wk__item, .inl').forEach(el => io.observe(el)));
}

/* ---------- theme: paper or night, whichever section holds the middle of the screen ---------- */
function initTheme() {
  const secs = $$('main [data-theme], footer[data-theme]').map(el => ({ el, t: el.dataset.theme, top: 0, h: 0 }));
  if (!secs.length) return;
  const meta = $('meta[name="theme-color"]');
  measurers.add(() => secs.forEach(s => { s.top = docTop(s.el); s.h = s.el.offsetHeight; }));
  let cur = root.dataset.theme;
  const set = t => { if (t === cur) return; cur = t; root.dataset.theme = t; if (meta) meta.content = t === 'light' ? '#f2efe9' : '#0b0a0a'; };
  addTask(() => {
    const a = S.y + S.vh * .55, b = S.y + S.vh * .45; let t = null;
    for (const s of secs) if (s.top <= a && s.top + s.h >= b) { t = s.t; }
    if (t) set(t);
    return false;
  });
}

/* ---------- scribble wipe (after Kolibrie): unwinds on load, draws in before leaving ---------- */
const samePath = (a, b) => a.replace(/\/index\.html$/, '/') === b.replace(/\/index\.html$/, '/');
function initWipe() {
  const w = $('[data-wipe]'); const path = w && $('.wipe__path', w);
  const done = () => { root.classList.remove('is-wiping'); };
  if (!w || RM) { done(); readyResolve(); }
  else {
    const len = path.getTotalLength(); path.style.strokeDasharray = `${len} ${len}`; path.style.strokeDashoffset = '0';
    const go = () => {
      w.classList.add('is-unwinding');
      const a = path.animate([{ strokeDashoffset: 0, strokeWidth: 680 }, { strokeDashoffset: -len, strokeWidth: 50 }], { duration: 1250, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards' });
      setTimeout(() => readyResolve(), 380);
      a.onfinish = () => { done(); w.classList.remove('is-unwinding'); };
    };
    const fontsReady = d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve();
    Promise.race([fontsReady, new Promise(r => setTimeout(r, 900))]).then(() => setTimeout(go, 260));
    addEventListener('pageshow', e => { if (e.persisted) { root.classList.remove('is-leaving', 'is-wiping'); path.getAnimations().forEach(a => a.cancel()); } });
    w._leave = href => {
      root.classList.add('is-leaving'); w.classList.remove('is-unwinding');
      path.getAnimations().forEach(a => a.cancel());
      path.animate([{ strokeDashoffset: len, strokeWidth: 60 }, { strokeDashoffset: 0, strokeWidth: 680 }], { duration: 760, easing: 'cubic-bezier(.55,0,.6,1)', fill: 'forwards' })
        .onfinish = () => { location.href = href; };
    };
  }
  const internal = a => {
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return null;
    const href = a.getAttribute('href'); if (!href || href.startsWith('#') || /^(mailto|tel):/.test(href)) return null;
    let u; try { u = new URL(a.href, location.href); } catch (e) { return null; }
    if (u.origin !== location.origin && location.protocol !== 'file:') return null;
    if (samePath(u.pathname, location.pathname) && u.search === location.search && u.hash) return null;
    if (!/(\.html|\/)$/.test(u.pathname)) return null;
    return u;
  };
  const prefetched = new Set();
  const prefetch = e => {
    const a = e.target.closest && e.target.closest('a'); const u = internal(a);
    if (!u || prefetched.has(u.href) || location.protocol === 'file:') return;
    prefetched.add(u.href); const l = d.createElement('link'); l.rel = 'prefetch'; l.href = u.href; d.head.append(l);
  };
  d.addEventListener('pointerover', prefetch, { passive: true });
  d.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a'); const u = internal(a); if (!u) return;
    if (samePath(u.pathname, location.pathname) && u.search === location.search) { e.preventDefault(); closeMenu(true); goTo(0); return; }
    e.preventDefault(); closeMenu(true);
    if (RM || !w || !w._leave) { location.href = u.href; return; }
    w._leave(u.href);
  });
}

/* ---------- drawn underline (after Kolibrie's draw-line) ---------- */
const STROKES = [
  'M5 20.9999C26.7762 16.2245 49.5532 11.5572 71.7979 14.6666C84.9553 16.5057 97.0392 21.8432 109.987 24.3888C116.413 25.6523 123.012 25.5143 129.042 22.6388C135.981 19.3303 142.586 15.1422 150.092 13.3333C156.799 11.7168 161.702 14.6225 167.887 16.8333C181.562 21.7212 194.975 22.6234 209.252 21.3888C224.678 20.0548 239.912 17.991 255.42 18.3055C272.027 18.6422 288.409 18.867 305 17.9999',
  'M5 24.2592C26.233 20.2879 47.7083 16.9968 69.135 13.8421C98.0469 9.5853 128.407 4.02322 158.059 5.14674C172.583 5.69708 187.686 8.66104 201.598 11.9696C207.232 13.3093 215.437 14.9471 220.137 18.3619C224.401 21.4596 220.737 25.6575 217.184 27.6168C208.309 32.5097 197.199 34.281 186.698 34.8486C183.159 35.0399 147.197 36.2657 155.105 26.5837C158.11 22.9053 162.993 20.6229 167.764 18.7924C178.386 14.7164 190.115 12.1115 201.624 10.3984C218.367 7.90626 235.528 7.06127 252.521 7.49276C258.455 7.64343 264.389 7.92791 270.295 8.41825C280.321 9.25056 296 10.8932 305 13.0242',
  'M5 29.5014C9.61174 24.4515 12.9521 17.9873 20.9532 17.5292C23.7742 17.3676 27.0987 17.7897 29.6575 19.0014C33.2644 20.7093 35.6481 24.0004 39.4178 25.5014C48.3911 29.0744 55.7503 25.7731 63.3048 21.0292C67.9902 18.0869 73.7668 16.1366 79.3721 17.8903C85.1682 19.7036 88.2173 26.2464 94.4121 27.2514C102.584 28.5771 107.023 25.5064 113.276 20.6125C119.927 15.4067 128.83 12.3333 137.249 15.0014C141.418 16.3225 143.116 18.7528 146.581 21.0014C149.621 22.9736 152.78 23.6197 156.284 24.2514C165.142 25.8479 172.315 17.5185 179.144 13.5014C184.459 10.3746 191.785 8.74853 195.868 14.5292C199.252 19.3205 205.597 22.9057 211.621 22.5014C215.553 22.2374 220.183 17.8356 222.979 15.5569C225.4 13.5845 227.457 11.1105 230.742 10.5292C232.718 10.1794 234.784 12.9691 236.164 14.0014C238.543 15.7801 240.717 18.4775 243.356 19.8903C249.488 23.1729 255.706 21.2551 261.079 18.0014C266.571 14.6754 270.439 11.5202 277.146 13.6125C280.725 14.7289 283.221 17.209 286.393 19.0014C292.321 22.3517 298.255 22.5014 305 22.5014',
  'M17.0039 32.6826C32.2307 32.8412 47.4552 32.8277 62.676 32.8118C67.3044 32.807 96.546 33.0555 104.728 32.0775C113.615 31.0152 104.516 28.3028 102.022 27.2826C89.9573 22.3465 77.3751 19.0254 65.0451 15.0552C57.8987 12.7542 37.2813 8.49399 44.2314 6.10216C50.9667 3.78422 64.2873 5.81914 70.4249 5.96641C105.866 6.81677 141.306 7.58809 176.75 8.59886C217.874 9.77162 258.906 11.0553 300 14.4892',
  'M4.99805 20.9998C65.6267 17.4649 126.268 13.845 187.208 12.8887C226.483 12.2723 265.751 13.2796 304.998 13.9998',
  'M5 29.8857C52.3147 26.9322 99.4329 21.6611 146.503 17.1765C151.753 16.6763 157.115 15.9505 162.415 15.6551C163.28 15.6069 165.074 15.4123 164.383 16.4275C161.704 20.3627 157.134 23.7551 153.95 27.4983C153.209 28.3702 148.194 33.4751 150.669 34.6605C153.638 36.0819 163.621 32.6063 165.039 32.2029C178.55 28.3608 191.49 23.5968 204.869 19.5404C231.903 11.3436 259.347 5.83254 288.793 5.12258C294.094 4.99476 299.722 4.82265 305 5.45025',
];
let strokeI = Math.floor(Math.random() * STROKES.length);
function drawLine(host, always) {
  const NS = 'http://www.w3.org/2000/svg';
  const box = d.createElement('span'); box.className = 'dl'; box.setAttribute('aria-hidden', 'true');
  const svg = d.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 310 40'); svg.setAttribute('preserveAspectRatio', 'none');
  const p = d.createElementNS(NS, 'path'); p.setAttribute('d', STROKES[strokeI++ % STROKES.length]); svg.append(p); box.append(svg); host.append(box);
  const len = p.getTotalLength(); p.style.strokeDasharray = `${len} ${len}`; p.style.strokeDashoffset = len;
  const a = p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: always ? 600 : 500, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards' });
  return { box, p, len, a };
}
function initDraw() {
  $$('[data-draw]').forEach(el => {
    if (el.getAttribute('aria-current') === 'page') { ready.then(() => setTimeout(() => drawLine(el, true), 700)); return; }
    if (!FINE || RM) return;
    let cur = null;
    el.addEventListener('pointerenter', () => { if (cur) { cur.box.remove(); } cur = drawLine(el, false); });
    el.addEventListener('pointerleave', () => {
      const c = cur; if (!c) return; cur = null;
      c.a.finished.then(() => c.p.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: -c.len }], { duration: 500, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards' }).finished).then(() => c.box.remove());
    });
  });
}

/* ---------- cursor label: a marquee card that follows the pointer (after Kolibrie) ---------- */
function initCursor() {
  const c = $('[data-cursor-el]'); if (!c || !FINE || RM) return;
  const spans = $$('[data-cursor-txt]', c);
  const sx = new Spring(-300, 1, .32), sy = new Spring(-300, 1, .32); let on = false, seen = false, lx = -1, ly = -1, txt = '';
  const check = target => {
    const t = target && target.closest && target.closest('[data-cursor]');
    if (t && !root.classList.contains('lb-open')) {
      const s = t.dataset.cursor + ' →';
      if (s !== txt) { txt = s; spans.forEach(sp => (sp.textContent = s + ' ')); c.style.setProperty('--cd', Math.max(1.6, s.length / 5) + 's'); }
      if (!on) { on = true; c.classList.add('is-on'); }
    } else if (on) { on = false; c.classList.remove('is-on'); }
  };
  d.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    lx = e.clientX; ly = e.clientY;
    if (!seen) { sx.snap(lx); sy.snap(ly); seen = true; }
    sx.to(lx); sy.to(ly); check(e.target); wake();
  }, { passive: true });
  let pend = 0; addEventListener('scroll', () => { if (seen && !pend) { pend = 1; requestAnimationFrame(() => { pend = 0; check(d.elementFromPoint(lx, ly)); }); } }, { passive: true });
  d.addEventListener('pointerleave', () => { if (on) { on = false; c.classList.remove('is-on'); } });
  addTask(dt => { sx.step(dt); sy.step(dt); c.style.transform = `translate3d(${sx.x}px,${sy.x}px,0)`; return !(sx.rest && sy.rest); });
}

/* ==========================================================================
   HOVER INK (from the "IMAGINE" study). The pointer paints a gooey ink trail
   over a headline; inside the ink the same words appear inflated, in a
   material that changes with every stroke (chrome, balloon, slime, gold,
   purple chrome, red lacquer). Drips fall, splatter flies, and it all dries.
   ========================================================================== */
const MATS = [
  { k: 'chrome', pal: [[252, 252, 255], [206, 210, 220], [70, 72, 82], [22, 23, 28], [128, 134, 146], [236, 238, 244], [176, 180, 190]] },
  { k: 'balloon', cols: [[246, 160, 190], [130, 190, 238]] },
  { k: 'balloon', cols: [[184, 238, 44]] },
  { k: 'chrome', pal: [[255, 248, 206], [240, 196, 88], [122, 74, 12], [62, 34, 4], [204, 150, 44], [255, 230, 146], [214, 168, 70]] },
  { k: 'chrome', pal: [[246, 238, 255], [184, 160, 255], [86, 54, 176], [36, 18, 90], [146, 116, 236], [226, 212, 255], [170, 140, 250]] },
  { k: 'balloon', cols: [[232, 52, 30]] },
];
const PAL_STOPS = [0, .3, .46, .54, .68, .86, 1];
let matCursor = Math.floor(Math.random() * MATS.length);
function boxBlur(src, w, h, r) {
  // three separable box passes approximate a gaussian
  const tmp = new Float32Array(w * h), out = new Float32Array(src);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      let acc = 0; const o = y * w; const n = r * 2 + 1;
      for (let x = -r; x <= r; x++) acc += out[o + clamp(x, 0, w - 1)];
      for (let x = 0; x < w; x++) { tmp[o + x] = acc / n; acc += out[o + Math.min(w - 1, x + r + 1)] - out[o + Math.max(0, x - r)]; }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0; const n = r * 2 + 1;
      for (let y = -r; y <= r; y++) acc += tmp[clamp(y, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) { out[y * w + x] = acc / n; acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; }
    }
  }
  return out;
}
function palAt(pal, t) {
  t = sat(t); let i = 0; while (i < PAL_STOPS.length - 2 && t > PAL_STOPS[i + 1]) i++;
  const f = (t - PAL_STOPS[i]) / (PAL_STOPS[i + 1] - PAL_STOPS[i]); const a = pal[i], b = pal[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/* One shared WebGL canvas thresholds the soft ink mask into crisp, antialiased ink and lays the
   inflated letters inside it. Doing this on the GPU replaces an SVG filter that repainted on the
   CPU every frame, which is what made the trail feel sticky. Falls back to the filter if needed. */
const InkGL = cv => {
  const gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) return null;
  try {
    const sh = (t, src) => { const x = gl.createShader(t); gl.shaderSource(x, src); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}'));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, 'precision mediump float;varying vec2 v;uniform sampler2D m;uniform sampler2D t;uniform vec3 ink;uniform float has;' +
      'void main(){float a=smoothstep(.43,.5,texture2D(m,v).a);vec4 q=texture2D(t,v);vec3 c=mix(ink,q.rgb,q.a*has);gl_FragColor=vec4(c*a,a);}'));
    gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('link');
    gl.useProgram(pr);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const mk = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE)); [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.LINEAR)); return t; };
    const texM = [mk(), mk()], mats = new WeakMap();
    gl.uniform1i(gl.getUniformLocation(pr, 'm'), 0); gl.uniform1i(gl.getUniformLocation(pr, 't'), 1);
    const uInk = gl.getUniformLocation(pr, 'ink'), uHas = gl.getUniformLocation(pr, 'has');
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const hex = c => { const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(c.trim()) || [0, '0e', '0d', '0d']; return [1, 2, 3].map(i => parseInt(m[i], 16) / 255); };
    let lost = false; cv.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; });
    // layers: [[maskCanvas, materialCanvas|null, color], ...] drawn back to front
    return { get ok() { return !lost; }, draw(w, h, layers) {
      gl.viewport(0, 0, w, h); gl.clear(gl.COLOR_BUFFER_BIT);
      layers.forEach(([mask, mat, color], i) => {
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texM[i]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mask);
        gl.activeTexture(gl.TEXTURE1);
        if (mat) { let t = mats.get(mat); if (!t) { t = mk(); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mat); mats.set(mat, t); } else gl.bindTexture(gl.TEXTURE_2D, t); }
        gl.uniform1f(uHas, mat ? 1 : 0); gl.uniform3fv(uInk, hex(color));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      });
    } };
  } catch (e) { return null; }
};
// a pre-rendered soft brush; stamping a sprite is far cheaper than building a gradient per dab
const brushSprite = (() => {
  const c = d.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, '#000'); g.addColorStop(.55, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return c;
})();

function shadeMaterial(ea, oa, w, h, r, M) {
  const A = new Float32Array(w * h), P = new Uint8Array(w * h);
  for (let k = 0; k < w * h; k++) { const e = ea[k * 4 + 3], o = oa[k * 4 + 3]; A[k] = Math.max(e, o) / 255; P[k] = o > e ? 1 : 0; }
  const Hh = boxBlur(A, w, h, r), out = new Uint8ClampedArray(w * h * 4);
  const L = [-.42, -.66, .62], ll = Math.hypot(L[0], L[1], L[2]); L[0] /= ll; L[1] /= ll; L[2] /= ll;
  const Hv = [L[0], L[1], L[2] + 1], hl = Math.hypot(Hv[0], Hv[1], Hv[2]); Hv[0] /= hl; Hv[1] /= hl; Hv[2] /= hl;
  const S2 = r * 2.4;
  for (let y = 1; y < h - 1; y++) for (let X = 1; X < w - 1; X++) {
    const k = y * w + X; const al = A[k]; if (al < .02) continue;
    const hx = Math.sqrt(Hh[k + 1]) - Math.sqrt(Hh[k - 1]), hy = Math.sqrt(Hh[k + w]) - Math.sqrt(Hh[k - w]);
    let nx = -hx * S2, ny = -hy * S2, nz = 1; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    const ndl = nx * L[0] + ny * L[1] + nz * L[2], ndh = Math.max(0, nx * Hv[0] + ny * Hv[1] + nz * Hv[2]);
    let R, G, B;
    if (M.k === 'chrome') {
      const ry = 2 * nz * ny, rx = 2 * nz * nx;
      const col = palAt(M.pal, .5 + .5 * (ry * .95 + rx * .22));
      const sp = Math.pow(ndh, 70) * 255, sp2 = Math.pow(ndh, 14) * 60, lit = .78 + .3 * Math.max(0, ndl);
      R = col[0] * lit + sp + sp2; G = col[1] * lit + sp + sp2; B = col[2] * lit + sp + sp2;
    } else {
      const base = M.cols[M.cols.length > 1 ? P[k] : 0];
      const dif = .3 + .82 * Math.max(0, ndl), sp = Math.pow(ndh, 46) * 240, sh = Math.pow(ndh, 7) * 46, rim = Math.pow(1 - nz, 2) * 70;
      R = base[0] * dif + sp + sh + rim * .6; G = base[1] * dif + sp + sh + rim * .6; B = base[2] * dif + sp + sh + rim * .7;
    }
    const q = k * 4; out[q] = R; out[q + 1] = G; out[q + 2] = B; out[q + 3] = al * 255;
  }
  return out;
}
let shadeW = null, shadeId = 0; const shadeCb = new Map();
function shadeWorker() {
  if (shadeW !== null) return shadeW;
  try {
    const src = `const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),sat=v=>clamp(v,0,1),PAL_STOPS=${JSON.stringify(PAL_STOPS)};${boxBlur};${palAt};${shadeMaterial};` +
      `onmessage=e=>{const m=e.data;const o=shadeMaterial(m.e,m.o,m.w,m.h,m.r,m.M);postMessage({id:m.id,o},[o.buffer]);};`;
    shadeW = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    shadeW.onmessage = e => { const c = shadeCb.get(e.data.id); shadeCb.delete(e.data.id); if (c) c.done(e.data.o); };
    // if workers are blocked (some file:// setups), finish the queued jobs on the main thread
    shadeW.onerror = () => { shadeW = false; const q = [...shadeCb.values()]; shadeCb.clear(); q.forEach(c => c.run()); };
  } catch (e) { shadeW = false; }
  return shadeW;
}
class InkHost {
  constructor(el) {
    this.el = el; this.hero = el.hasAttribute('data-ink-hero');
    this.cv = d.createElement('canvas'); this.cv.className = 'inkc'; this.cv.setAttribute('aria-hidden', 'true'); el.append(this.cv);
    
    this.masks = [d.createElement('canvas'), d.createElement('canvas')]; this.mctx = this.masks.map(c => c.getContext('2d'));
    this.tmp = d.createElement('canvas'); this.tctx = this.tmp.getContext('2d');
    this.mat = [-1, -1]; this.energy = [0, 0]; this.slot = 0; this.cache = new Map(); this.pending = new Set(); this.key = '';
    this.parts = []; this.last = null; this.lastT = 0; this.live = false; this.visible = false; this.ms = .5;
    this.glr = InkGL(this.cv); if (this.glr) this.cv.classList.add('inkc--gl'); else this.ctx = this.cv.getContext('2d');
    this.colors = ['#0e0d0d', '#0e0d0d']; this.tgt = null; this.brush = null;
  }
  layout() {
    const el = this.el, r = el.getBoundingClientRect(); if (!r.width) return false;
    const cs = getComputedStyle(el); const fs = parseFloat(cs.fontSize);
    this.fs = fs; const px = fs * .6, py = fs * .55, pb = fs * 1.25;   // extra room below for drips
    this.W = Math.ceil(r.width + px * 2); this.H = Math.ceil(r.height + py + pb); this.ox = r.left - px; this.oy = r.top - py;
    this.ds = FINE ? Math.min(devicePixelRatio || 1, 1.25) : 1;
    Object.assign(this.cv.style, { left: -px + 'px', top: -py + 'px', width: this.W + 'px', height: this.H + 'px' });
    const cw = Math.round(this.W * this.ds), ch = Math.round(this.H * this.ds);
    if (this.cv.width !== cw || this.cv.height !== ch) { this.cv.width = this.tmp.width = cw; this.cv.height = this.tmp.height = ch; }
    const mw = Math.ceil(this.W * this.ms), mh = Math.ceil(this.H * this.ms);
    this.masks.forEach(m => { if (m.width !== mw || m.height !== mh) { m.width = mw; m.height = mh; } });
    // glyphs: one record per visible character, measured with Ranges
    const glyphs = []; const range = d.createRange();
    const walker = d.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.parentElement.closest('.sr-only, canvas, .inkc, .pill__slot, .tide__chip, .inl, sup') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    const meas = this.tctx;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const pcs = getComputedStyle(n.parentElement); const size = parseFloat(pcs.fontSize);
      const font = `${pcs.fontStyle} ${pcs.fontWeight} ${size}px ${pcs.fontFamily}`; meas.font = font;
      const upper = pcs.textTransform === 'uppercase';
      const t = n.textContent;
      for (let i = 0; i < t.length; i++) {
        let ch = t[i]; if (/\s/.test(ch)) continue; if (upper) ch = ch.toUpperCase();
        range.setStart(n, i); range.setEnd(n, i + 1); const b = range.getBoundingClientRect(); if (!b.width) continue;
        const m = meas.measureText(ch); const desc = m.fontBoundingBoxDescent || size * .22;
        glyphs.push({ ch, font, size, x: b.left - this.ox, y: b.bottom - desc - this.oy, w: b.width, h: b.height, cx: b.left - this.ox + b.width / 2 });
      }
    }
    this.glyphs = glyphs;
    const key = glyphs.map(g => g.ch + (g.x | 0) + ',' + (g.y | 0)).join('|') + this.W + 'x' + this.H;
    if (key !== this.key) { this.key = key; this.cache.clear(); this.pending = new Set(); }
    return glyphs.length > 0;
  }
  material(i) {
    if (this.cache.has(i)) return this.cache.get(i);
    if (this.pending.has(i) || !this.glyphs || !this.glyphs.length) return null;
    const M = MATS[i], ds = this.ds, w = this.cv.width, h = this.cv.height, key = this.key;
    // two alpha passes (even / odd glyphs) so balloon colours can alternate per letter
    const a = [0, 1].map(par => {
      const c = d.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true });
      x.fillStyle = x.strokeStyle = '#fff'; x.lineJoin = 'round'; x.lineCap = 'round';
      this.glyphs.forEach((g, k) => {
        if (k % 2 !== par) return;
        x.font = g.font.replace(/([\d.]+)px/, (_, v) => (v * ds) + 'px');
        x.lineWidth = g.size * .075 * ds;
        x.fillText(g.ch, g.x * ds, g.y * ds); x.strokeText(g.ch, g.x * ds, g.y * ds);
      });
      return x.getImageData(0, 0, w, h).data;
    });
    const r = Math.max(2, Math.round(this.fs * .065 * ds));
    this.pending.add(i);
    const done = o => {
      this.pending.delete(i); if (key !== this.key) return;
      const c = d.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(new ImageData(o, w, h), 0, 0);
      this.cache.set(i, c); wake();
    };
    const W = shadeWorker();
    if (W) { const id = ++shadeId; shadeCb.set(id, { done, run: () => done(shadeMaterial(a[0], a[1], w, h, r, M)) }); W.postMessage({ id, e: a[0], o: a[1], w, h, r, M }, [a[0].buffer, a[1].buffer]); }
    else done(shadeMaterial(a[0], a[1], w, h, r, M));
    return null;
  }
  ready() { return !this.el.hasAttribute('data-split') || (this.el.classList.contains('in') && performance.now() - (this.inAt || 0) > 1300); }
  begin() {
    if (!this.layout()) return false;
    this.slot = 1 - this.slot; const m = this.mctx[this.slot];
    m.clearRect(0, 0, this.masks[this.slot].width, this.masks[this.slot].height);
    let mi = matCursor; matCursor = (matCursor + 1) % MATS.length;
    if (!this.cache.has(mi)) { const ready = [...this.cache.keys()]; if (ready.length) mi = ready[(Math.random() * ready.length) | 0]; else this.material(mi); }  // flat ink until the letters arrive
    this.mat[this.slot] = mi;
    this.color = getComputedStyle(this.el).getPropertyValue('--ink-c').trim() || '#0e0d0d'; this.colors[this.slot] = this.color;
    this.energy[this.slot] = 1; this.cv.classList.add('is-on');
    this.prepare();
    return true;
  }
  stamp(x, y, r) {
    const m = this.mctx[this.slot], s = this.ms, R = r * s;
    m.globalCompositeOperation = 'source-over'; m.drawImage(brushSprite, x * s - R, y * s - R, R * 2, R * 2);
  }
  // build upcoming materials in idle time so a new stroke never waits on shading
  prepare() {
    // queue the next materials; the worker shades them one after another off the main thread
    const idle = window.requestIdleCallback || (f => setTimeout(f, 60));
    [matCursor, (matCursor + 1) % MATS.length].forEach(k => { if (!this.cache.has(k) && !this.pending.has(k)) idle(() => { try { this.material(k); } catch (e) {} }, { timeout: 2500 }); });
  }
  move(cx, cy, now) {
    if (!this.tgt || now - this.lastT > 380) {
      if (!this.begin()) return;
      const x = cx - this.ox, y = cy - this.oy;
      this.tgt = { x, y }; this.brush = { x, y }; this.stamp(x, y, Math.max(22, this.fs * .3));
    } else { this.tgt.x = cx - this.ox; this.tgt.y = cy - this.oy; }
    this.lastT = now;
    if (!this.live) { this.live = true; addTask(this.tick); }
    wake();
  }
  paint(x0, y0, x1, y1, dt, now) {
    const dx = x1 - x0, dy = y1 - y0, dist = Math.hypot(dx, dy); if (dist < .25) return;
    const speed = dist / Math.max(.004, dt); const R = Math.max(26, this.fs * .4) * (1 + Math.min(.4, speed / 4500));
    const steps = Math.max(1, Math.ceil(dist / (R * .2)));
    const ux = dx / dist, uy = dy / dist;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, px = x0 + dx * t, py = y0 + dy * t;
      const wob = Math.sin((px + py) * .045 + now * .003) * R * .14;
      const rr = R * (.84 + .26 * Math.sin(px * .029 + py * .017));
      this.stamp(px - uy * wob, py + ux * wob, rr);
      if (Math.random() < .1) this.stamp(px + (Math.random() - .5) * R * 1.2, py + (Math.random() - .5) * R, R * (.3 + Math.random() * .22));
      if (Math.random() < .022) this.parts.push({ x: px + (Math.random() - .5) * R * .9, y: py + R * .55, vx: 0, vy: 30, r: Math.max(7, R * (.2 + Math.random() * .08)), life: .55 + Math.random() * .6, t: 0, drip: true });
    }
    if (speed > 1100 && Math.random() < .5) {
      const side = Math.random() < .5 ? -1 : 1, off = R * (1 + Math.random() * .5);
      this.parts.push({ x: x1 - uy * off * side, y: y1 + ux * off * side, vx: ux * speed * .06 + (Math.random() - .5) * 120, vy: uy * speed * .06 - 50 * Math.random(), r: Math.max(4, R * (.1 + Math.random() * .12)), life: .18 + Math.random() * .2, t: 0 });
    }
  }
  tick = dt => {
    // the brush eases toward the pointer, so the stroke is a smooth curve whatever the event rate
    if (this.tgt && this.brush) {
      const k = 1 - Math.exp(-dt * 24), bx = this.brush.x + (this.tgt.x - this.brush.x) * k, by = this.brush.y + (this.tgt.y - this.brush.y) * k;
      this.paint(this.brush.x, this.brush.y, bx, by, dt, performance.now()); this.brush.x = bx; this.brush.y = by;
      if (this.energy[this.slot] > 0) this.energy[this.slot] = 1;
      if (performance.now() - this.lastT > 380 && Math.hypot(this.tgt.x - bx, this.tgt.y - by) < .5) { this.tgt = null; this.brush = null; }
    }
    // drying: multiplicative fade, so soft edges recede first and the blob shrinks
    const k = 1 - Math.pow(.5, dt / 1.0);
    for (let s = 0; s < 2; s++) {
      if (this.energy[s] <= 0) continue;
      const m = this.mctx[s]; m.globalCompositeOperation = 'destination-out'; m.fillStyle = `rgba(0,0,0,${k})`; m.fillRect(0, 0, this.masks[s].width, this.masks[s].height);
      this.energy[s] *= (1 - k); if (this.energy[s] < .4) { this.energy[s] = 0; m.globalCompositeOperation = 'source-over'; m.clearRect(0, 0, this.masks[s].width, this.masks[s].height); }
    }
    // drips and splatter keep painting into the newest slot
    if (this.parts.length) {
      const keep = [];
      for (const p of this.parts) {
        p.t += dt; if (p.t > p.life) continue;
        const ox = p.x, oy = p.y, rr = p.drip ? p.r * (1 - p.t / p.life * .6) : p.r;
        if (p.drip) { p.vy = Math.min(240, p.vy + 260 * dt); p.y += p.vy * dt; }
        else { p.vy += 1500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
        // stamp along the path travelled this frame so trails stay continuous at any frame rate
        if (p.drip) { const n = Math.max(1, Math.ceil(Math.hypot(p.x - ox, p.y - oy) / Math.max(1, rr * .45))); for (let j = 1; j <= n; j++) this.stamp(ox + (p.x - ox) * j / n, oy + (p.y - oy) * j / n, rr); }
        else if (p.t > p.life * .5) { this.stamp(p.x, p.y, rr); p.life = 0; }   // splatter lands as a droplet, not a streak
        keep.push(p);
      }
      this.parts = keep; if (this.parts.length) this.energy[this.slot] = 1;
    }
    // composite: ink, then the inflated letters only where the ink is
    const w = this.cv.width, h = this.cv.height;
    if (this.glr) { const L = []; for (const s of [1 - this.slot, this.slot]) if (this.energy[s] > 0) L.push([this.masks[s], this.cache.get(this.mat[s]) || null, this.colors[s]]); this.glr.draw(w, h, L); }
    else { const c = this.ctx; c.clearRect(0, 0, w, h);
    for (const s of [1 - this.slot, this.slot]) {
      if (this.energy[s] <= 0) continue;
      const t = this.tctx; t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, w, h);
      t.drawImage(this.masks[s], 0, 0, w, h); t.globalCompositeOperation = 'source-in'; t.fillStyle = this.colors[s]; t.fillRect(0, 0, w, h);
      const mat = this.cache.get(this.mat[s]); if (mat) { t.globalCompositeOperation = 'source-atop'; t.drawImage(mat, 0, 0); }
      c.drawImage(this.tmp, 0, 0);
    } }
    const alive = this.energy[0] > 0 || this.energy[1] > 0 || this.parts.length || this.tgt;
    if (!alive) { this.live = false; this.cv.classList.remove('is-on'); this.tgt = this.brush = null; tasks.delete(this.tick); }
    return !!alive;
  };
  sweep(dur = 1100) {
    // a scripted stroke for touch screens and the hero hint
    const r = this.el.getBoundingClientRect(); if (!r.width) return;
    const t0 = performance.now(); this.tgt = null; const amp = r.height * .28, ph = Math.random() * 6;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), e = eInOut(k);
      this.move(r.left + r.width * (.04 + .92 * e), r.top + r.height * .5 + Math.sin(e * 5 + ph) * amp, now);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}
function initInk() {
  if (RM) return;
  const els = $$('[data-inktext]'); if (!els.length) return;
  const hosts = els.map(el => new InkHost(el)); const vis = new Set();
  const ob = new IntersectionObserver(es => es.forEach(e => {
    const h = hosts.find(x => x.el === e.target); if (!h) return;
    if (e.isIntersecting) {
      vis.add(h);
      if (!h.glyphs && h.ready()) { setTimeout(() => { if (h.layout()) h.prepare(); }, 300); }
      if (!FINE && !h.swept && e.intersectionRatio > .5 && h.ready()) { h.swept = true; setTimeout(() => { const r = h.el.getBoundingClientRect(); if (r.top > S.vh * .18 && r.bottom < S.vh * .85) h.sweep(1300); else h.swept = false; }, 400); }
    } else vis.delete(h);
  }), { threshold: [0, .55] });
  hosts.forEach(h => ob.observe(h.el));
  // split headings only take ink once their letters have landed
  const mo = new MutationObserver(ms => ms.forEach(m => { const h = hosts.find(x => x.el === m.target); if (h && m.target.classList.contains('in') && !h.inAt) h.inAt = performance.now(); }));
  hosts.forEach(h => mo.observe(h.el, { attributes: true, attributeFilter: ['class'] }));
  d.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || root.classList.contains('motion-paused')) return;
    for (const h of vis) {
      const r = h.el.getBoundingClientRect(); const px = h.fs ? h.fs * .4 : 30;
      if (e.clientX < r.left - px || e.clientX > r.right + px || e.clientY < r.top - px || e.clientY > r.bottom + px) continue;
      if (!h.ready()) continue;
      if (!h.fs) h.layout(); else { h.ox = r.left - h.fs * .6; h.oy = r.top - h.fs * .55; }
      h.move(e.clientX, e.clientY, performance.now());
    }
  }, { passive: true });
  d.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return;
    for (const h of vis) { const r = h.el.getBoundingClientRect(); if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom && h.ready()) { h.tgt = null; h.sweep(800); } }
  }, { passive: true });
  addEventListener('resize', () => hosts.forEach(h => { h.key = ''; h.cache.clear(); h.pending = new Set(); h.fs = 0; }));
  // the hero hints once at what it does
  const hero = hosts.find(h => h.hero);
  if (hero && FINE) ready.then(() => setTimeout(() => { if (S.y < 40 && hero.layout()) hero.sweep(1500); }, 2900));
}

/* ==========================================================================
   WILD PILL HERO
   ========================================================================== */
const LOOP_D = 'M17590 16724 c-80 -7 -183 -19 -230 -25 -47 -7 -112 -15 -145 -19 -158 -19 -621 -124 -715 -163 -14 -5 -41 -13 -60 -17 -44 -10 -96 -28 -133 -46 -16 -8 -35 -14 -42 -14 -8 0 -29 -6 -47 -14 -18 -8 -53 -22 -78 -31 -55 -21 -106 -43 -143 -61 -16 -8 -32 -14 -37 -14 -17 0 -305 -138 -380 -182 -19 -11 -55 -31 -80 -45 -25 -13 -58 -33 -75 -44 -16 -10 -39 -23 -50 -29 -11 -6 -33 -19 -50 -30 -16 -11 -36 -23 -44 -26 -7 -4 -63 -40 -123 -80 -594 -401 -1136 -960 -1534 -1584 -42 -67 -52 -83 -60 -100 -4 -8 -13 -22 -19 -30 -7 -8 -30 -46 -51 -85 -20 -38 -45 -83 -55 -100 -18 -31 -170 -336 -194 -390 -53 -118 -65 -146 -85 -195 -12 -30 -28 -72 -36 -92 -37 -98 -47 -125 -60 -156 -8 -18 -14 -39 -14 -47 0 -8 -6 -29 -14 -47 -13 -30 -55 -166 -92 -298 -9 -30 -22 -76 -30 -101 -8 -26 -14 -55 -14 -64 0 -10 -6 -41 -14 -69 -23 -82 -53 -241 -90 -486 -68 -440 -68 -1077 0 -1500 51 -316 77 -441 150 -695 24 -85 105 -328 120 -362 8 -17 14 -36 14 -41 0 -6 6 -23 14 -39 8 -15 25 -53 37 -83 59 -150 196 -426 277 -560 12 -19 26 -44 31 -55 5 -11 21 -37 35 -58 14 -21 26 -40 26 -42 0 -9 132 -201 214 -310 167 -223 266 -336 496 -565 176 -177 236 -232 396 -366 58 -48 305 -233 387 -289 61 -42 63 -43 177 -115 39 -25 83 -53 98 -62 15 -10 36 -22 47 -28 11 -6 47 -26 80 -45 33 -19 69 -40 80 -45 11 -6 52 -28 90 -48 177 -96 272 -142 459 -222 54 -23 106 -45 115 -50 9 -4 34 -15 56 -23 80 -30 131 -49 163 -63 18 -8 40 -14 48 -14 9 0 28 -6 42 -14 15 -7 54 -21 87 -31 33 -10 78 -23 100 -30 627 -195 1341 -260 1965 -180 184 24 335 48 397 63 21 6 72 18 113 27 115 25 245 60 325 87 17 5 46 14 65 18 19 4 51 14 70 20 125 45 257 94 305 115 17 7 50 21 75 30 42 17 97 41 200 87 65 29 344 170 420 212 36 19 74 40 85 46 11 6 34 19 50 30 17 11 39 24 50 30 11 6 34 19 50 30 17 11 39 24 50 30 97 52 454 300 682 475 344 264 798 681 1133 1040 147 157 268 291 326 360 33 38 65 76 72 84 47 50 152 180 152 189 0 6 -6 15 -13 19 -7 4 -136 138 -287 297 -151 160 -304 319 -340 355 -36 37 -192 199 -345 361 -154 162 -312 326 -350 365 -39 38 -138 141 -219 228 -82 86 -155 157 -162 157 -14 0 -321 -305 -477 -475 -99 -107 -197 -213 -437 -470 -162 -173 -312 -323 -455 -453 -82 -75 -152 -139 -155 -142 -7 -8 -141 -116 -209 -168 -77 -60 -226 -161 -266 -182 -11 -6 -33 -19 -50 -30 -138 -89 -424 -216 -570 -253 -33 -9 -80 -21 -105 -28 -25 -7 -67 -16 -95 -20 -27 -4 -79 -12 -115 -17 -395 -63 -916 -37 -1260 63 -25 7 -72 20 -105 30 -33 9 -73 23 -88 31 -16 8 -34 14 -42 14 -41 0 -379 165 -493 241 -24 16 -45 29 -47 29 -6 0 -144 101 -225 164 -324 255 -696 764 -836 1146 -36 99 -113 339 -128 395 -28 112 -46 203 -46 228 0 14 -5 38 -10 53 -6 14 -17 125 -26 245 -16 225 -4 553 25 679 6 25 17 83 26 130 9 47 24 110 32 140 33 115 46 156 59 188 8 18 14 40 14 48 0 9 6 28 14 42 8 15 24 52 36 82 44 109 133 281 191 368 16 24 29 45 29 47 0 2 24 37 53 77 192 268 415 483 691 666 59 40 110 72 112 72 2 0 22 11 44 25 39 25 218 116 275 140 17 7 46 20 65 28 19 8 55 23 80 32 25 9 60 23 78 31 18 8 39 14 47 14 8 0 29 6 47 14 95 40 405 117 543 136 39 5 99 14 135 20 116 21 555 15 690 -9 177 -31 372 -83 455 -120 11 -5 61 -26 110 -46 125 -52 297 -143 393 -206 24 -16 45 -29 47 -29 3 0 35 -21 72 -47 38 -25 93 -63 124 -84 100 -67 411 -316 524 -420 22 -20 85 -76 140 -124 103 -91 151 -137 480 -456 238 -230 825 -831 1064 -1089 74 -80 182 -194 241 -255 58 -60 164 -173 235 -250 71 -77 192 -207 270 -290 78 -82 207 -220 286 -305 79 -85 160 -170 179 -190 20 -19 107 -111 195 -205 555 -594 1541 -1581 1925 -1926 63 -56 138 -124 165 -150 28 -26 88 -79 135 -119 47 -40 87 -76 90 -79 3 -4 41 -37 85 -75 44 -37 94 -79 110 -93 192 -164 618 -496 780 -608 96 -67 276 -188 297 -200 10 -5 77 -46 150 -91 73 -44 140 -84 148 -87 8 -4 31 -17 50 -28 37 -23 333 -171 388 -195 18 -7 47 -20 65 -27 17 -8 52 -22 77 -32 25 -9 56 -21 68 -26 62 -24 204 -67 312 -94 141 -36 178 -44 260 -60 47 -9 114 -23 150 -30 66 -13 188 -31 430 -62 110 -14 215 -17 570 -17 458 0 511 4 925 68 140 22 400 81 580 133 119 34 162 46 195 58 19 7 51 18 70 24 19 7 49 17 65 21 53 15 120 41 130 51 5 5 16 9 25 9 13 0 143 52 280 113 81 36 404 197 465 232 33 19 67 38 75 42 8 4 27 16 43 27 18 13 30 17 37 10 17 -17 8 -2868 -8 -2919 -7 -22 -20 -65 -29 -95 -71 -252 -281 -606 -454 -765 -107 -99 -414 -274 -534 -306 -16 -4 -64 -19 -105 -32 -88 -29 -188 -51 -321 -72 -134 -21 -563 -21 -719 0 -209 29 -374 58 -500 90 -147 37 -188 47 -230 59 -25 8 -72 21 -105 31 -33 10 -76 23 -95 30 -19 7 -51 18 -70 24 -19 7 -48 16 -65 21 -16 5 -55 18 -85 30 -30 12 -66 25 -80 30 -14 5 -50 18 -80 30 -30 12 -67 25 -81 30 -14 4 -34 12 -45 18 -10 6 -59 27 -109 47 -49 21 -115 48 -145 62 -30 13 -68 30 -85 37 -16 8 -101 48 -187 91 -155 75 -178 81 -178 46 0 -9 -7 -26 -15 -37 -8 -10 -15 -27 -15 -36 0 -9 -5 -29 -12 -45 -18 -46 -68 -186 -78 -218 -4 -16 -18 -55 -30 -85 -41 -105 -51 -135 -60 -165 -5 -16 -25 -75 -45 -130 -20 -55 -40 -115 -45 -133 -4 -18 -12 -38 -18 -45 -5 -7 -12 -23 -15 -37 -3 -14 -15 -50 -27 -80 -12 -30 -26 -68 -30 -85 -11 -38 -62 -182 -90 -255 -12 -30 -25 -68 -30 -85 -5 -16 -18 -55 -30 -85 -12 -30 -26 -68 -30 -85 -11 -38 -62 -182 -90 -255 -12 -30 -25 -68 -30 -85 -5 -16 -18 -55 -30 -85 -12 -30 -25 -68 -30 -85 -5 -16 -18 -55 -30 -85 -12 -30 -25 -68 -30 -85 -5 -16 -18 -55 -30 -85 -47 -115 -49 -111 86 -175 127 -60 167 -79 309 -139 20 -9 50 -22 68 -29 17 -8 52 -22 77 -32 25 -9 59 -23 75 -30 46 -19 194 -76 313 -119 55 -20 99 -35 172 -57 36 -12 81 -27 100 -34 19 -7 62 -21 95 -30 33 -10 78 -24 100 -30 88 -27 235 -68 325 -90 36 -9 88 -22 115 -30 48 -13 101 -24 270 -60 44 -9 100 -21 125 -27 48 -10 201 -37 260 -44 19 -3 76 -11 125 -19 87 -14 272 -34 500 -56 144 -13 740 -13 880 1 289 28 628 81 735 116 25 8 54 14 65 14 10 0 37 6 60 14 22 7 67 21 100 31 139 40 161 48 188 61 16 8 35 14 42 14 15 0 69 22 117 46 14 8 31 14 37 14 18 0 319 144 376 181 17 10 37 22 45 26 8 3 33 18 55 32 59 38 78 49 95 57 23 12 280 206 329 250 182 161 241 221 387 389 98 114 282 367 308 425 3 8 15 29 26 45 42 66 169 314 213 415 15 36 34 79 41 95 35 78 114 296 141 385 7 25 20 70 29 100 10 30 21 71 25 90 27 111 34 139 47 181 8 26 14 57 14 69 0 12 7 49 15 83 52 222 116 749 150 1232 38 558 45 852 45 1870 0 974 -3 1152 -45 2535 -8 272 -17 601 -20 730 -3 129 -10 423 -15 653 -11 453 -9 490 50 757 44 203 50 555 14 860 -26 220 -45 364 -54 400 -5 19 -11 55 -15 80 -7 50 -29 157 -50 240 -44 175 -65 254 -90 335 -7 22 -20 67 -30 100 -18 60 -29 93 -58 170 -8 22 -21 58 -30 80 -29 78 -50 130 -65 165 -8 19 -21 49 -28 65 -51 120 -172 369 -228 470 -56 102 -81 145 -120 208 -22 37 -45 76 -51 85 -78 133 -409 582 -470 637 -6 6 -57 62 -112 125 -116 131 -301 315 -418 416 -44 37 -91 79 -105 92 -26 25 -138 114 -243 194 -80 61 -156 114 -287 201 -58 38 -116 77 -130 86 -14 10 -32 20 -40 24 -8 4 -28 16 -45 27 -16 10 -52 31 -80 45 -27 14 -70 37 -95 51 -109 63 -333 170 -475 229 -92 37 -120 49 -188 79 -21 9 -46 16 -55 16 -10 0 -23 5 -29 11 -6 6 -26 14 -44 19 -19 4 -50 14 -69 21 -19 6 -51 17 -70 24 -36 13 -119 37 -205 60 -27 8 -75 21 -106 29 -31 9 -63 16 -71 16 -9 0 -38 6 -64 14 -72 21 -330 67 -504 90 -655 86 -1395 32 -2040 -149 -25 -7 -74 -20 -110 -30 -36 -9 -81 -23 -100 -30 -19 -7 -60 -20 -90 -30 -30 -9 -69 -23 -87 -31 -17 -8 -36 -14 -42 -14 -6 0 -25 -6 -43 -14 -18 -8 -53 -22 -78 -31 -25 -9 -57 -23 -72 -31 -14 -8 -31 -14 -37 -14 -19 0 -290 -131 -406 -196 -33 -18 -69 -38 -80 -44 -11 -6 -33 -19 -50 -30 -16 -11 -39 -24 -50 -30 -11 -6 -33 -19 -50 -30 -16 -11 -36 -23 -44 -26 -74 -36 -508 -355 -686 -504 -270 -226 -438 -382 -845 -790 -567 -569 -900 -915 -899 -937 1 -22 1692 -1697 1717 -1701 73 -12 408 296 1021 939 432 452 610 624 731 705 25 17 74 51 110 75 36 25 72 48 80 52 8 4 29 16 45 27 43 27 327 169 361 180 16 4 54 18 84 30 30 12 69 26 85 30 17 5 64 20 105 33 126 41 186 57 209 57 13 0 50 7 84 15 280 66 820 63 1142 -6 79 -17 167 -39 200 -51 17 -5 46 -14 65 -18 39 -9 89 -26 135 -45 17 -7 53 -21 80 -30 47 -16 347 -161 389 -188 11 -6 49 -31 84 -54 35 -24 65 -43 68 -43 11 0 173 -127 269 -211 290 -252 524 -579 713 -999 28 -63 36 -85 84 -215 41 -109 57 -165 88 -300 37 -159 49 -219 55 -285 3 -36 10 -99 15 -140 12 -101 12 -315 0 -420 -6 -47 -15 -119 -20 -160 -13 -113 -46 -271 -72 -345 -5 -16 -14 -46 -18 -65 -4 -19 -18 -60 -30 -90 -33 -87 -51 -133 -57 -154 -6 -19 -153 -312 -176 -351 -235 -394 -599 -759 -993 -995 -33 -19 -68 -40 -79 -47 -37 -22 -280 -139 -325 -158 -25 -9 -54 -21 -65 -26 -28 -12 -104 -39 -140 -49 -138 -41 -179 -52 -240 -66 -38 -9 -92 -20 -120 -24 -27 -4 -79 -14 -115 -21 -44 -8 -166 -13 -375 -13 -319 -1 -361 3 -590 50 -144 30 -360 97 -485 151 -19 8 -48 21 -65 28 -94 39 -305 149 -385 199 -163 104 -396 271 -449 323 -14 13 -63 56 -110 96 -47 39 -95 81 -106 92 -11 11 -90 83 -175 160 -197 177 -934 914 -1235 1235 -127 134 -253 267 -281 295 -27 27 -135 142 -240 255 -104 112 -205 220 -225 240 -19 19 -95 100 -169 180 -74 80 -211 226 -304 324 -94 99 -209 221 -256 270 -531 569 -1604 1639 -1990 1986 -63 57 -137 125 -165 151 -27 26 -88 79 -135 119 -47 40 -87 76 -90 79 -3 4 -41 37 -85 75 -44 37 -93 79 -110 93 -42 36 -213 176 -299 245 -98 79 -560 427 -621 468 -176 119 -262 176 -277 185 -9 5 -93 56 -185 112 -230 138 -236 142 -253 149 -8 3 -22 9 -30 14 -62 38 -465 230 -481 230 -6 0 -23 6 -37 14 -51 26 -103 46 -120 46 -9 0 -26 7 -36 15 -11 8 -28 15 -38 15 -9 0 -32 6 -50 14 -18 7 -60 21 -93 30 -33 10 -76 22 -95 28 -19 7 -53 15 -75 18 -22 4 -60 12 -85 18 -119 28 -284 58 -400 72 -36 4 -103 13 -150 19 -318 42 -819 53 -1120 25z';
function initPill() {
  const sec = $('[data-pill]'); if (!sec) return;
  const st = $('.pill__sticky', sec), word = $('.pill__word', sec), slot = $('[data-pill-slot]', sec), media = $('[data-pill-media]', sec);
  const video = $('[data-pill-video]', sec), pause = $('[data-pill-pause]', sec), replay = $('[data-pill-replay]', sec);
  const halfL = $('.pill__half--l', sec), halfR = $('.pill__half--r', sec), cv = $('[data-pill-inf]', sec), poster = $('.pill__poster', sec);
  const nav = $('[data-nav]'), cx = cv.getContext('2d');
  const o = sceneRange(sec);
  const E1 = bez(.5, 0, .3, 1), E3 = bez(.4, 0, .2, 1), EN = bez(.2, .8, .2, 1), ED = bez(.65, 0, .35, 1);
  const phone = () => S.vw <= 720;
  let fs = 0, r = RM ? 1 : 0, playing = null, e = 0, userPaused = false, W = 0, H = 0, lastVT = -1, dirty = true;
  // the middle of the word is the HOGS logo's own loop (the infinity that becomes the g), filled with the reel
  const LOOP = new Path2D(LOOP_D), BX = 1274.5, BY = 651, BW = 2230.2, BH = 1673;
  const Hem = () => (phone() ? 1.62 : 1.78), Wem = () => Hem() * BW / BH;
  // where the infinity crosses, as a fraction of the loop's box: the camera dives through here
  const CROSS = [.43, .33];
  const fit = (cw, ch, pad) => { const s = Math.min((cw - 2 * pad) / BW, (ch - 2 * pad) / BH); return [s, (cw - BW * s) / 2 - BX * s, (ch - BH * s) / 2 - BY * s]; };
  function draw() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5), cw = Math.max(2, Math.round(W * dpr)), ch = Math.max(2, Math.round(H * dpr));
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    cx.globalCompositeOperation = 'source-over'; cx.clearRect(0, 0, cw, ch);
    const prog = RM ? 1 : ED(sat((r - .06) / .74)); if (prog <= .001) return;
    const src = video.readyState >= 2 ? video : poster;
    const sw = src.videoWidth || src.naturalWidth || 1280, sh = src.videoHeight || src.naturalHeight || 720, sc = Math.max(cw / sw, ch / sh);
    try { cx.drawImage(src, (cw - sw * sc) / 2, (ch - sh * sc) / 2, sw * sc, sh * sc); } catch (er) { cx.fillStyle = '#5a1a10'; cx.fillRect(0, 0, cw, ch); }
    const pad = 3 * dpr, [s0, ox, oy] = fit(cw, ch, pad);
    const toLoop = () => { cx.setTransform(s0, 0, 0, s0, ox, oy); cx.translate(0, 2325); cx.scale(.1, -.1); };
    // keep the reel only inside the logo loop, with a thin red rim
    toLoop(); cx.globalCompositeOperation = 'destination-in'; cx.fill(LOOP);
    cx.globalCompositeOperation = 'destination-over'; cx.lineWidth = (2.6 * dpr) / (s0 * .1); cx.lineJoin = 'round'; cx.strokeStyle = 'rgba(208,39,23,.95)'; cx.stroke(LOOP);
    // the loop draws itself: a sweep around the crossing, as if a pen were tracing it
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.globalCompositeOperation = 'destination-in';
    const ccx = cw * CROSS[0], ccy = ch * CROSS[1], R = Math.hypot(cw, ch);
    if (prog < .999) { cx.beginPath(); cx.moveTo(ccx, ccy); cx.arc(ccx, ccy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog); cx.closePath(); cx.fill(); }
    cx.globalCompositeOperation = 'source-over';
  }
  function apply(rr) {
    r = rr;
    const grow = E3(sat((r - .04) / .66)), w = Math.max(4, lerp(.18, Wem(), grow) * fs), h = Hem() * fs;
    slot.style.width = w + 'px'; slot.style.height = h + 'px'; W = w; H = h;
    word.style.setProperty('--gap', lerp(.02, .07, grow).toFixed(3) + 'em');
    st.style.setProperty('--paper-o', sat((r - .4) / .35).toFixed(3));
    const ft = EN(sat((r - .52) / .38)); st.style.setProperty('--foot-y', ((1 - ft) * 160).toFixed(2) + '%');
    st.style.setProperty('--rule', EN(sat((r - .40) / .55)).toFixed(3));
    st.style.setProperty('--cue', EN(sat((r - .8) / .2)).toFixed(3));
    if (nav) nav.style.translate = '0 ' + ((1 - EN(sat((r - .5) / .36))) * -140).toFixed(2) + '%';
    dirty = true; draw();
  }
  measurers.add(() => { fs = parseFloat(getComputedStyle(word).fontSize); apply(r); });
  const play = (to, dur = 2700) => new Promise(res => {
    if (playing) playing.cancel = true;
    const from = r, t0 = performance.now(), D = Math.abs(to - from) * dur, me = { cancel: false }; playing = me;
    const step = now => { if (me.cancel) return res(); const k = D ? Math.min(1, (now - t0) / D) : 1; apply(lerp(from, to, k)); if (k < 1) requestAnimationFrame(step); else { playing = null; res(); } };
    requestAnimationFrame(step);
  });
  let vis = true;
  // the reel keeps playing inside the infinity; redraw only when a new frame arrives
  addTask(() => {
    if (!vis || e > .85) return false;
    if (video.readyState >= 2 && video.currentTime !== lastVT) { lastVT = video.currentTime; dirty = true; }
    if (dirty) { dirty = false; draw(); }
    return !video.paused;
  });
  // scroll: the camera dives through the crossing of the infinity into the full reel
  let lastP = -1;
  addTask(() => {
    if (RM) return false;
    const p = pinP(o); if (Math.abs(p - lastP) < .0003) return false; lastP = p;
    e = sat(p / .78); const k = eInOut(e);
    const spread = k * S.vw * (phone() ? .7 : .6);
    halfL.style.transform = `translate3d(${-spread.toFixed(1)}px,0,0)`; halfR.style.transform = `translate3d(${spread.toFixed(1)}px,0,0)`;
    cv.style.transformOrigin = `${(CROSS[0] * 100).toFixed(1)}% ${(CROSS[1] * 100).toFixed(1)}%`; cv.style.transform = `scale(${(1 + 40 * k * k * k).toFixed(4)})`;
    cv.style.opacity = (1 - smooth01(sat((e - .5) / .25))).toFixed(3);
    st.style.setProperty('--media', smooth01(sat((e - .3) / .35)).toFixed(3));
    st.style.setProperty('--foot-o', (1 - sat(k * 3)).toFixed(3));
    st.style.setProperty('--cue-o', (1 - sat(k * 5)).toFixed(3));
    st.style.setProperty('--after', sat((e - .55) / .35).toFixed(3));
    st.style.setProperty('--shade', (k * .9).toFixed(3));
    if (e < .85) wake();
    return false;
  });
  const setPaused = v => { userPaused = v; pause.setAttribute('aria-pressed', String(v)); if (v) video.pause(); else if (vis) video.play().then(wake).catch(() => {}); };
  new IntersectionObserver(([en]) => { vis = en.isIntersecting; if (vis && !userPaused && !RM && !root.classList.contains('motion-paused')) video.play().then(wake).catch(() => {}); else video.pause(); }).observe(sec);
  video.addEventListener('playing', wake);
  pause.addEventListener('click', () => setPaused(!userPaused));
  replay.addEventListener('click', async () => { if (RM) return; await play(0, 1300); await play(1); });
  if (poster.complete) dirty = true; else poster.addEventListener('load', () => { dirty = true; draw(); });
  if (RM) { video.pause(); apply(1); if (nav) nav.style.translate = ''; return; }
  apply(0);
  ready.then(() => setTimeout(() => play(1), 120));
  if (root.classList.contains('motion-paused')) setPaused(true);
}

/* ==========================================================================
   THE RING (after "Sea Ring"): geometry and timings from the reference
   ========================================================================== */
function initRing() {
  const sec = $('[data-ring]'); if (!sec) return;
  const frame = $('[data-ring-frame]', sec), wall = $('[data-ring-wall]', sec), lens = $('[data-ring-lens]', sec), center = $('[data-ring-center]', sec);
  const cards = $$('.rc', sec), N = cards.length, sent = $('[data-ring-sent]', sec), vid = $('[data-ring-video]', sec);
  const pv = $('[data-ring-pv]', sec), pvMedia = $('[data-pv-media]', pv), pvK = $('[data-pv-k]', pv), pvB = $('[data-pv-b]', pv);
  const data = JSON.parse($('#ring-data').textContent);
  body.append(pv);
  // word stagger for the sentence
  $$('.mw', sent).forEach((m, i) => { m.firstElementChild.style.setProperty('--wd', (.05 + .035 * i).toFixed(3) + 's'); const c = m.closest('.ch'); if (c && !c.style.getPropertyValue('--ld')) c.style.setProperty('--ld', (.35 + .035 * i).toFixed(3) + 's'); });
  const o = sceneRange(sec);
  const rot = new Spring(0, 1.1, .513); let m = 0, f = RM ? 1 : 0, ex = RM ? 1 : 0, live = RM, started = RM, E = 1, hoverCard = false, dragging = false, frameN = 0;
  const tilts = cards.map(c => ({ rx: new Spring(0, .9, .47), ry: new Spring(0, .9, .47), tz: new Spring(0, .9, .47), tilt: $('.rc__tilt', c), face: $('.rc__face', c), on: false }));
  const wallScale = () => (S.vw <= 820 ? .8 : S.vh <= 760 ? .9 : 1.1);
  if (RM) sec.classList.add('is-revealed', 'is-entered', 'is-live');
  const E5 = bez(.5, 0, .15, 1);
  const start = () => {
    if (started) return; started = true;
    const t0 = performance.now();
    if (!FINE) setTimeout(() => sec.classList.add('is-entered'), 300);
    const form = now => { f = Math.min(1, (now - t0) / (FINE ? 1700 : 1300)); wake(); if (f < 1) requestAnimationFrame(form); else reveal(); };
    requestAnimationFrame(form);
  };
  const reveal = () => {
    sec.classList.add('is-revealed');
    const t0 = performance.now();
    const grow = now => { const k = Math.min(1, (now - t0) / (FINE ? 1500 : 1200)); ex = E5(k); wake(); if (k < 1) requestAnimationFrame(grow); else { live = true; sec.classList.add('is-live'); } };
    requestAnimationFrame(grow);
    setTimeout(() => sec.classList.add('is-entered'), 500);
    if (vid && !RM) { vid.preload = 'auto'; vid.addEventListener('playing', () => vid.classList.add('is-playing'), { once: true }); vid.play().catch(() => {}); }
  };
  let inView = false, lastY = S.y;
  new IntersectionObserver(([en]) => { inView = en.isIntersecting; if (vid && vid.preload === 'auto') { if (inView && !RM) vid.play().catch(() => {}); else vid.pause(); } wake(); }, { threshold: 0 }).observe(sec);
  // pointer parallax on the scene layers
  const layers = $$('[data-depth]', frame).map(el => ({ el, k: +el.dataset.depth }));
  const px = new Spring(0, 1, .6), py = new Spring(0, 1, .6);
  if (FINE && !RM) d.addEventListener('pointermove', e => { if (!inView) return; px.to(e.clientX / S.vw * 2 - 1); py.to(e.clientY / S.vh * 2 - 1); wake(); }, { passive: true });
  addTask(dt => {
    if (!inView) { lastY = S.y; return false; }
    if (!started && S.y > o.top - S.vh * .85) start();
    const kf = Math.min(3, dt * 1000 / 16.67);
    // scroll turns it while the section is pinned
    const dy = S.y - lastY; lastY = S.y;
    if (live && !RM && S.y > o.top - S.vh * .3 && S.y < o.top + o.h - S.vh * .7) m += dy * .09;
    if (++frameN % 3 === 0 && FINE) hoverCard = !!(wall.matches(':hover') && d.querySelector('.rc:hover'));
    E += ((hoverCard ? .2 : 1) - E) * Math.min(1, .08 * kf);
    const paused = root.classList.contains('motion-paused');
    if (!dragging && !RM && !paused && !wall.contains(d.activeElement)) {
      if (live) m += .3 * E * kf * .6; else m += .3 * (.5 + .5 * ex) * clamp((78 - m) / 20, 0, 1) * E * kf;
    }
    rot.to(m); const g = RM ? m : rot.step(dt); if (RM) rot.snap(m);
    // camera
    const e = ex, ws = wallScale();
    const tilt = -22 * (1 - e), radius = 460 + 1340 * e, anchor = -radius * Math.sin(tilt * DEG) + 460 * Math.sin(-22 * DEG) * (1 - e);
    const persp = 1000 + (760 - 1000) * e, roll = -20 * (1 - e), cs = .52 + (2.65 - .52) * e * e;
    const fit = Math.min(1.05, (S.vw - 32) / 1240, .66 * S.vh / 800) / ws; const A = ws * (fit + (1 - fit) * e);
    lens.style.perspective = (persp * A).toFixed(1) + 'px';
    center.style.transform = `translate3d(${(160 * Math.sin(roll * DEG) * A).toFixed(1)}px,${(anchor * A).toFixed(1)}px,0) rotateZ(${roll.toFixed(2)}deg) rotateX(${tilt.toFixed(2)}deg) scale3d(${A.toFixed(4)},${A.toFixed(4)},${A.toFixed(4)})`;
    for (let s = 0; s < N; s++) {
      const ang = ((((360 * s / N + g + 180) % 360) + 360) % 360) - 180;
      const n = (ang + 180) % 360, a = n / 360, i = sat((f - .7 * a) / .3), sm = 1 - Math.pow(1 - i, 3);
      const l = -180 + n * sm, c = radius - (1 - sm) * a * 24;
      const x = -Math.sin(l * DEG) * c, z = -Math.cos(l * DEG) * c, appear = Math.min(1, 2.5 * i);
      const hide = z * Math.cos(tilt * DEG) >= persp - 70 || (live && Math.abs(ang) > 96);
      const flip = z > radius * radius / persp;
      const el = cards[s];
      el.style.opacity = hide ? 0 : appear.toFixed(3);
      el.style.pointerEvents = hide || appear < .01 ? 'none' : '';
      el.style.transform = `translate3d(${x.toFixed(1)}px,0,${z.toFixed(1)}px) rotateY(${l.toFixed(2)}deg) scale(${cs.toFixed(4)})${flip ? ' rotateY(180deg)' : ''}`;
      const tt = tilts[s];
      if (tt.on || !tt.rx.rest || !tt.ry.rest || !tt.tz.rest) { tt.rx.step(dt); tt.ry.step(dt); tt.tz.step(dt); tt.tilt.style.transform = `translateZ(${tt.tz.x.toFixed(1)}px) rotateX(${tt.rx.x.toFixed(2)}deg) rotateY(${tt.ry.x.toFixed(2)}deg)`; }
    }
    px.step(dt); py.step(dt);
    layers.forEach(L => (L.el.style.transform = `translate3d(${(-px.x * L.k).toFixed(1)}px,${(-py.x * L.k * .5).toFixed(1)}px,0)`));
    return true;
  });
  // keyboard: tabbing to a card turns the ring until that card faces you
  cards.forEach((c, s) => c.addEventListener('focus', () => {
    if (!started) { started = true; f = 1; ex = 1; live = true; sec.classList.add('is-revealed', 'is-entered', 'is-live'); }
    let want = -360 * s / N; want += Math.round((m - want) / 360) * 360; m = want; if (RM) rot.snap(m); wake();
  }));
  // drag and touch
  let x0 = 0, y0 = 0, m0 = 0, moved = false, lastDrag = 0, touchAxis = '';
  wall.addEventListener('pointerdown', e => {
    if (!live || (e.pointerType === 'mouse' && e.button !== 0)) return;
    x0 = e.clientX; y0 = e.clientY; m0 = m; moved = false; touchAxis = e.pointerType === 'mouse' ? 'x' : '';
    dragging = e.pointerType === 'mouse'; if (dragging) { wall.setPointerCapture(e.pointerId); wall.classList.add('is-drag'); }
  });
  wall.addEventListener('pointermove', e => {
    if (!live) return;
    if (e.pointerType !== 'mouse' && !touchAxis && (e.buttons || e.pressure)) { const dx = e.clientX - x0, dy = e.clientY - y0; if (Math.hypot(dx, dy) > 8) { touchAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'; if (touchAxis === 'x') dragging = true; } }
    if (!dragging) return;
    const dx = e.clientX - x0, dy = e.clientY - y0; if (Math.hypot(dx, dy) > 4) moved = true;
    m = m0 + .2 * (e.pointerType === 'mouse' && Math.abs(dy) > Math.abs(dx) ? dy : dx); wake();
  });
  const up = () => { if (dragging && moved) lastDrag = performance.now(); dragging = false; touchAxis = ''; wall.classList.remove('is-drag'); };
  wall.addEventListener('pointerup', up); wall.addEventListener('pointercancel', up);
  wall.addEventListener('click', e => { if (performance.now() - lastDrag < 60) { e.preventDefault(); e.stopPropagation(); } }, true);
  // card hover tilt
  if (FINE && !RM) cards.forEach((c, i) => {
    const tt = tilts[i];
    c.addEventListener('pointermove', e => { const b = c.getBoundingClientRect(); const nx = (e.clientX - b.left) / b.width - .5, ny = (e.clientY - b.top) / b.height - .5; tt.rx.to(-20 * ny); tt.ry.to(24 * nx); tt.tz.to(45); tt.on = true; wake(); });
    c.addEventListener('pointerleave', () => { tt.rx.to(0); tt.ry.to(0); tt.tz.to(0); tt.on = false; wake(); });
  });
  // sentence hover: marker, dim other worlds, preview card that stays on screen
  if (!FINE) return;
  const sx = new Spring(0, 1.12, .3), sy = new Spring(0, 1.12, .3); let pvOn = false, seen = false, flipX = false, flipY = false, mx = 0, my = 0;
  const chs = $$('.ch', sent);
  chs.forEach(ch => {
    ch.addEventListener('pointerenter', e => {
      if (!sec.classList.contains('is-entered')) return;
      const w = ch.dataset.world, dd = data[w];
      chs.forEach(x => x.classList.toggle('is-active', x === ch)); sent.classList.add('is-hovering');
      if (w !== 'hello') sec.dataset.focus = w; else delete sec.dataset.focus;
      pv.classList.toggle('is-hello', w === 'hello'); pv.dataset.world = w;
      if (dd.img) pvMedia.style.backgroundImage = `url(${dd.img})`;
      pvK.textContent = w === 'hello' ? dd.label : `${dd.label} · ${dd.title}`; pvB.textContent = dd.blurb;
      if (!seen) { sx.snap(e.clientX); sy.snap(e.clientY); seen = true; }
      pv.classList.add('is-on'); pvOn = true; wake();
    });
  });
  sent.addEventListener('pointerleave', () => { sent.classList.remove('is-hovering'); chs.forEach(x => x.classList.remove('is-active')); delete sec.dataset.focus; pv.classList.remove('is-on'); pvOn = false; });
  sent.addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; sx.to(mx); sy.to(my); wake(); }, { passive: true });
  const card = $('.ring__pvcard', pv);
  addTask(dt => {
    if (!pvOn && sx.rest && sy.rest) return false;
    sx.step(dt); sy.step(dt);
    const cw = 260, chh = card.offsetHeight || 220;
    if (flipY) { if (sy.x - 22 - chh > 12 + 24) flipY = false; } else if (sy.x - 22 - chh < 12) flipY = true;
    if (flipX) { if (sx.x + 18 + cw < S.vw - 12 - 24) flipX = false; } else if (sx.x + 18 + cw > S.vw - 12) flipX = true;
    let x = flipX ? sx.x - 18 - cw : sx.x + 18, y = flipY ? sy.x + 22 : sy.x - 22 - chh;
    x = clamp(x, 12, S.vw - cw - 12); y = clamp(y, 12, S.vh - chh - 12);
    card.style.transformOrigin = `${flipX ? '100%' : '0'} ${flipY ? '0' : '100%'}`;
    pv.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
    return true;
  });
}

/* ==========================================================================
   LATEST DROPS: the 3D stack peels away card by card (after Kolibrie)
   ========================================================================== */
function initDrops() {
  const sec = $('[data-drops]'); if (!sec) return;
  const slides = $$('.drop', sec), C = slides.length, stack = $('[data-drops-stack]', sec), badge = $('[data-drops-badge]', sec), pin = $('[data-drops-pin]', sec);
  const o = sceneRange(sec); let flat = false;
  measurers.add(() => { flat = S.vw <= 991; sec.classList.toggle('is-flat', flat); });
  let P = 0;
  addTask(dt => {
    if (flat) return false;
    const target = pinP(o); const dP = target - P; if (dP === 0) return false;
    P = Math.abs(dP) > .02 ? P + dP * (1 - Math.exp(-dt * 14)) : target;
    const T = P * (C - 1);
    slides.forEach((s, b) => {
      const idx = Math.max(0, b - T), drop = b < C - 1 ? eIn2(sat(T - b)) * S.vh * .9 : 0, alpha = b < C - 1 ? 1 - sat((T - b - .7) / .25) : 1;
      s.style.transform = `translate3d(0,${(-idx * 40 + drop).toFixed(1)}px,${(-idx * 120).toFixed(1)}px)`;
      s.style.opacity = alpha.toFixed(3); s.style.zIndex = C - b; s.style.visibility = alpha < .01 ? 'hidden' : '';
    });
    badge.style.setProperty('--badge', (P * 180).toFixed(2) + 'deg');
    return P !== target;
  });
  if (!FINE || RM) return;
  const rx = new Spring(0, 1, .55), ry = new Spring(0, 1, .55); let on = false;
  pin.addEventListener('pointermove', e => { if (flat) return; const r = pin.getBoundingClientRect(); rx.to(-((e.clientY - r.top) / r.height - .5) * 6); ry.to(((e.clientX - r.left) / r.width - .5) * 10); on = true; wake(); });
  pin.addEventListener('pointerleave', () => { rx.to(0); ry.to(0); wake(); });
  addTask(dt => { if (!on) return false; rx.step(dt); ry.step(dt); stack.style.setProperty('--trx', rx.x.toFixed(2) + 'deg'); stack.style.setProperty('--try', ry.x.toFixed(2) + 'deg'); if (rx.rest && ry.rest && !rx.t && !ry.t) on = false; return on; });
}

/* ==========================================================================
   TIDE STORY (after "Tides in Motion"): fan, scatter, pile, wheel, red room, dive
   ========================================================================== */
function initTide() {
  const sec = $('[data-tide]'); if (!sec || RM) return;
  const stage = $('[data-tide-stage]', sec), cards = $$('.tc', sec), N = cards.length, proc = $('[data-tide-process]', sec);
  const sky = $('[data-tide-sky]', sec), video = $('[data-tide-video]', sec), loop = $('[data-tide-loop]', sec), black = $('[data-tide-black]', sec);
  $$('.tw', proc).forEach((w, i) => w.style.setProperty('--i', i));
  $$('.tide__w', sky).forEach(p => $$('.tw', p).forEach((w, i) => w.style.setProperty('--wd', (p.matches('.tide__w--br') ? .45 : 0) + i * .12 + 's')));
  new IntersectionObserver(([en], ob) => { if (en.isIntersecting) { proc.classList.add('is-in'); ob.disconnect(); } }, { threshold: .2 }).observe(stage);
  const o = sceneRange(sec);
  let W = 0, H = 0, mob = false, cw = 200;
  const poses = cards.map(() => ({ x: 0, y: 0, r: 0, s: 1, o: 0 }));
  const plate = $('.tide__plate', sky); let src = -1, tEnter = 0;
  // the hand arrives: fan cards rise from below, one after another, as the story comes on screen
  const ORDER = [5, 2, 0, 1, 3, 4], DEL = [.0, .07, .1, .17, .27, .33], backOut = t => { const c = 1.15; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  new IntersectionObserver(([en], ob) => { if (en.isIntersecting) { tEnter = performance.now(); wake(); ob.disconnect(); } }, { threshold: .05 }).observe(stage);
  measurers.add(() => {
    W = stage.clientWidth || S.vw; H = stage.clientHeight || S.vh; mob = W < 820 && W < H * 1.1;
    cw = mob ? Math.min(W * .30, H * .2) : Math.min(W / 1440, H / 780) * 218;
    sec.style.setProperty('--cw', cw.toFixed(1));
    stage.style.setProperty('--pfs', (mob ? Math.min(W * .085, 40) : Math.min(W * .0335, H * .062)) + 'px');
    stage.style.setProperty('--sfs', (mob ? Math.min(W * .09, 44) : Math.min(W * .042, H * .078)) + 'px');
    stage.style.setProperty('--camw', (mob ? Math.min(W * .62, H * .34) : Math.min(W * .19, H * .36)) + 'px');
  });
  const step = R => 2 * Math.asin(Math.min(1, 1.05 * cw / (2 * R)));
  const fan = i => {
    if (i > 5) return [W * .5, H * 1.4, 0, 0];
    if (mob) { const R = W * 1.35, th = (i - 2.5) * step(R); return [W * .5 + R * Math.sin(th), H * .86 + R - R * Math.cos(th) + cw * .2, th / DEG, 1]; }
    const R = 1250 * W / 1440, th = (i - 2.5) * step(R); return [W * .55 + R * Math.sin(th) - W * .02, H * .86 + R - R * Math.cos(th), th / DEG, 1];
  };
  const SC = [[.08, .46, -20], [.20, .86, -12], [.80, .84, 14], [.38, 1.04, -8], [.92, .42, 16], [.62, 1.04, 9]];
  const SCM = [[.06, .60, -20], [.45, .66, 12], [.94, .60, 16], [.22, .93, -14], [.72, .96, 9], [.5, 1.3, 0]];
  const scatter = i => { if (i > 5) return [W * .5, H * 1.4, 0, 0]; const s = (mob ? SCM : SC)[i]; let y = s[1]; if (H < 500 && y < .1) y += .08; return [W * s[0], H * y, s[2], 1]; };
  const pile = i => [W * .5 + ((i % 3) - 1) * cw * .08, H * .68 + (((i * 7) % 5) - 2) * cw * .04, (i % 2 ? -1 : 1) * (4 + i * 1.3), 1];
  const wheel = (i, rotv) => {
    const R = mob ? W * 1.2 : 900 * W / 1440, cx = W * .5, cy = (mob ? H * .76 : H * .82) + R;
    const slot = (((i + rotv) % 12) + 12) % 12 - 5.5, ang = slot * step(R);
    return [cx + R * Math.sin(ang), cy - R * Math.cos(ang), ang / DEG, Math.abs(ang / DEG) < 62 ? 1 : 0];
  };
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];
  let skyP = 0, vidOn = false, t0 = performance.now(), settled = false;
  addTask(dt => {
    if (S.y < o.top - S.vh || S.y > o.top + o.h) { if (vidOn) { video.pause(); vidOn = false; } return false; }
    // the manifesto overlaps the last screen of this section, so every phase finishes before it arrives
    const pEnd = Math.max(.45, (o.h - 2 * S.vh) / Math.max(1, o.h - S.vh) - .004);   // the manifesto pins here
    const p = pinP(o) * .97 / pEnd; const kf = dt * 1000 / 16.67;
    const now0 = performance.now(); let entering = false;
    const s1 = eInOut(sat((p - .004) / .081)), s2 = eInOut(sat((p - .21) / .10)), s3 = easeGlide(sat((p - .31) / .10)), s4 = eInOut(sat((p - .41) / .16));
    settled = true;
    cards.forEach((c, i) => {
      let t = mix(fan(i), scatter(i), s1);
      if (i < 6) {
        const k = ORDER.indexOf(i), u = tEnter ? sat((now0 - tEnter) / 1000 - .15 - DEL[k]) / .7 : 0, ev = u >= 1 ? 1 : backOut(Math.min(1, u));
        if (u < 1) entering = true;
        t = [t[0], t[1] + (1 - ev) * (H * .7 + cw * 1.2), t[2] + (1 - ev) * 8, t[3]];
      }
      if (s2 > 0) { const pl = pile(i); if (i > 5) { const pv = [...pl]; pv[3] = s2; t = mix([pl[0], pl[1] + H * .2, pl[2], 0], pv, s2); } else t = mix(t, pl, s2); }
      if (s3 > 0) t = mix(t, wheel(i, -3 * s4), s3);
      const P = poses[i];
      if (p < .002 || entering && p < .01) { P.x = t[0]; P.y = t[1]; P.r = t[2]; P.o = t[3]; }
      else { const w = .055 + (i % 4) * .008, k = 1 - Math.pow(1 - w, kf); P.x += (t[0] - P.x) * k; P.y += (t[1] - P.y) * k; P.r += (t[2] - P.r) * k; P.o += (t[3] - P.o) * k; }
      if (Math.abs(P.x - t[0]) > 3 || Math.abs(P.y - t[1]) > 3 || Math.abs(P.r - t[2]) > 1) settled = false;
      c.style.transform = `translate3d(${P.x.toFixed(1)}px,${P.y.toFixed(1)}px,0) rotate(${P.r.toFixed(2)}deg)`;
      c.style.opacity = (i === src && skyP > .001 ? 0 : sat(P.o)).toFixed(3);
    });
    // red room grows only once the wheel has finished and every card has landed
    const target = eInOut(sat((p - .6) / .14));
    skyP += (target - skyP) * (1 - Math.pow(1 - .12, kf)); if (Math.abs(target - skyP) < .001) skyP = target;
    const on = skyP > .001; sky.style.setProperty('--sky-vis', on ? 'visible' : 'hidden'); stage.style.setProperty('--sky-vis', on ? 'visible' : 'hidden');
    sky.style.visibility = on ? 'visible' : 'hidden';
    if (on && src < 0) {
      let best = 0, bd = 1e9; poses.forEach((P, i) => { const dd = Math.abs(P.x - W / 2) + (P.o < .5 ? 1e6 : 0); if (dd < bd) { bd = dd; best = i; } });
      src = best; const im = $('img', cards[src]); if (im && plate) plate.src = im.currentSrc || im.src;
    } else if (!on) src = -1;
    const SP = poses[Math.max(0, src)], wx = cw, wy = cw * 1.32, cx = SP.x, cy = SP.y;
    const T = (cy - wy / 2) * (1 - skyP), B = (H - (cy + wy / 2)) * (1 - skyP), Lf = (cx - wx / 2) * (1 - skyP), Rt = (W - (cx + wx / 2)) * (1 - skyP);
    sky.style.clipPath = skyP > .998 ? 'none' : `inset(${T.toFixed(1)}px ${Rt.toFixed(1)}px ${B.toFixed(1)}px ${Lf.toFixed(1)}px round ${(cw * .075 * (1 - skyP)).toFixed(1)}px)`;
    const k0 = Math.max(wx / W, wy / H) * 1.02, ks = lerp(k0, 1, skyP);
    sky.style.setProperty('--px', ((cx - W / 2) * (1 - skyP)).toFixed(1) + 'px'); sky.style.setProperty('--py', ((cy - H / 2) * (1 - skyP)).toFixed(1) + 'px');
    sky.style.setProperty('--ps', ks.toFixed(4)); sky.style.setProperty('--veil', sat((skyP - .2) / .5).toFixed(3));
    video.style.opacity = sat((skyP - .55) / .35).toFixed(3);
    sky.classList.toggle('is-full', skyP > .995);
    if (on && !vidOn) { vidOn = true; video.preload = 'auto'; video.playbackRate = .8; video.play().catch(() => {}); }
    else if (!on && vidOn) { vidOn = false; video.pause(); }
    // the chrome loop yaws, bobs, then the camera dives through it
    const yawT = sat((p - .74) / .14), now = (performance.now() - t0) / 1000;
    const gate = sat((skyP - .9) / .1), q = Math.pow(sat((p - .86) / .09), 1.5) * gate;
    sky.style.setProperty('--yaw', (-10 + 20 * yawT).toFixed(2) + 'deg');
    sky.style.setProperty('--bob', (Math.sin(now * 1.6) * 6 * (on ? 1 : 0)).toFixed(2) + 'px');
    sky.style.setProperty('--cam-s', (lerp(.2, 1, eOut3(sat((skyP - .35) / .65))) * (1 + q * q * 24)).toFixed(4));
    sky.style.setProperty('--cam-o', sat((skyP - .35) / .3).toFixed(3));
    black.style.setProperty('--black', sat((q - .35) / .6).toFixed(3));
    return on || !settled || entering;
  });
}

/* ---------- sideways manifesto with stickers that pop ---------- */
function initTrack() {
  const sec = $('[data-mt]'); if (!sec || RM) return;
  const track = $('[data-mt-track]', sec);
  $$('[data-chars]', sec).forEach(w => { const t = w.textContent; w.textContent = ''; [...t].forEach((ch, k) => { const s = d.createElement('span'); s.className = 'mc'; s.style.setProperty('--k', k); s.textContent = ch; w.append(s); }); });
  const items = [...$$('[data-chars], [data-pop]', track)].map(el => ({ el, x: 0, done: false }));
  const o = sceneRange(sec); let tw = 0, x0 = 0, x1 = 0, edge = 0, last = -1;
  measurers.add(() => {
    const mob = S.vw < 820; track.style.transform = 'none';
    const tr = track.getBoundingClientRect(); tw = track.scrollWidth;
    items.forEach(it => { it.x = it.el.getBoundingClientRect().left - tr.left; });
    track.style.transform = '';
    x0 = S.vw * (mob ? .08 : .06); x1 = -(tw - S.vw * .9); edge = S.vw * (mob ? .92 : .86); last = -1;
  });
  let tx = 0, nextAt = 0; const queue = [];
  addTask(() => {
    const p = pinP(o);
    if (Math.abs(p - last) >= .0002) { last = p; tx = lerp(x0, x1, sat((p - .06) / .94)); track.style.transform = `translate3d(${tx.toFixed(1)}px,-50%,0)`; }
    const pinned = S.y >= o.top - 1 && S.y < o.top + o.h; if (pinned !== sec._pinned) { sec._pinned = pinned; sec.classList.toggle('is-pinned', pinned); }
    if (pinned) items.forEach(it => { if (!it.done && (last < 0 ? x0 : tx) + it.x < edge) { it.done = true; queue.push(it.el); } });
    // one at a time: each newly visible word or sticker waits for the one before it
    const now = performance.now(); if (queue.length && now >= nextAt) { queue.shift().classList.add('is-in'); nextAt = now + 110; }
    return queue.length > 0;
  });
}

/* ---------- meet the crew: photos rise at their own speeds; flick them ---------- */
function initFlock() {
  const sec = $('[data-flock]'); if (!sec || RM) return;
  const ph = $$('[data-flick]', sec).filter(p => p.matches('.fl__ph'));
  const items = ph.map(el => ({ el, sp: parseFloat(getComputedStyle(el).getPropertyValue('--sp')) || 1, fx: new Spring(0, .62, .6), fy: new Spring(0, .62, .6), fr: new Spring(0, .62, .6), on: false }));
  const o = sceneRange(sec); let dist = 320, last = -1;
  measurers.add(() => { dist = 320 * (S.vw >= 992 ? 1 : S.vw >= 480 ? .5 : .3); last = -1; });
  addTask(() => {
    const t = sat((S.y + S.vh - o.top) / (o.h + S.vh)); if (Math.abs(t - last) < .0002) return false; last = t;
    items.forEach(it => it.el.style.setProperty('--y', lerp(dist * it.sp, -dist * it.sp, t).toFixed(1) + 'px'));
    return false;
  });
  if (!FINE) return;
  let vx = 0, vy = 0, lx = null, ly = null;
  d.addEventListener('pointermove', e => { if (lx !== null) { vx = e.clientX - lx; vy = e.clientY - ly; } lx = e.clientX; ly = e.clientY; }, { passive: true });
  const stamp = $('.fl__stamp', sec); if (stamp) items.push({ el: stamp, sp: 0, fx: new Spring(0, .62, .6), fy: new Spring(0, .62, .6), fr: new Spring(0, .62, .6), on: false, stamp: true });
  items.forEach(it => it.el.addEventListener('pointerenter', e => {
    const r = it.el.getBoundingClientRect(); const F = e.clientX - (r.left + r.width / 2), R = e.clientY - (r.top + r.height / 2);
    const torque = (F * vy - R * vx) / (Math.hypot(F, R) || 1);
    it.fx.to(0, clamp(vx * 30, -1080, 1080)); it.fy.to(0, clamp(vy * 30, -1080, 1080)); it.fr.to(0, clamp(torque * 20, -60, 60) * 3);
    if (!it.on) { it.on = true; const fn = dt => { it.fx.step(dt); it.fy.step(dt); it.fr.step(dt); const s = it.el.style; if (it.stamp) s.translate = `${it.fx.x.toFixed(1)}px ${it.fy.x.toFixed(1)}px`, s.rotate = `${(-10 + it.fr.x).toFixed(2)}deg`; else { s.setProperty('--fx', it.fx.x.toFixed(1) + 'px'); s.setProperty('--fy', it.fy.x.toFixed(1) + 'px'); s.setProperty('--fr', it.fr.x.toFixed(2) + 'deg'); } const live = !(it.fx.rest && it.fy.rest && it.fr.rest); if (!live) { it.on = false; tasks.delete(fn); } return live; }; addTask(fn); }
  }));
}

/* ---------- light headers: a photo card that rests beside the title, then trails the pointer (after Kolibrie) ---------- */
function initCursorCard() {
  $$('[data-cursor-cards]').forEach(host => {
    const card = $('[data-cc]', host), media = $('[data-cc-media]', host), imgs = $$('.cc__img', host);
    if (!card || RM) return;
    let cur = 0, following = false;
    const nextImg = () => { imgs[cur].classList.remove('on'); cur = (cur + 1) % imgs.length; imgs[cur].classList.add('on'); };
    // the card changes photo on its own while it rests, so the header never sits still
    setInterval(() => { if (!d.hidden && !root.classList.contains('motion-paused') && !following && S.y < host.offsetTop + host.offsetHeight) nextImg(); }, 2600);
    if (!FINE) return;
    const X = new Spring(0, 1, .42), Y = new Spring(0, 1, .42), Rr = new Spring(-5, 1, .5), MX = new Spring(0, 1, .4), MY = new Spring(0, 1, .42);
    let lastX = 0, lastY = 0, travel = 0, idleT = 0, live = false;
    const rest = () => { const w = host.clientWidth, h = host.clientHeight; return [w / 2 - card.offsetWidth * .62 - Math.max(24, w * .03), -h * .17]; };
    const tick = dt => {
      X.step(dt); Y.step(dt); Rr.step(dt); MX.step(dt); MY.step(dt);
      card.style.transform = `translate3d(${X.x.toFixed(1)}px,${Y.x.toFixed(1)}px,0) rotate(${Rr.x.toFixed(2)}deg)`;
      media.style.transform = `translate3d(${MX.x.toFixed(2)}%,${MY.x.toFixed(2)}%,0)`;
      const busy = following || !(X.rest && Y.rest && Rr.rest && MX.rest && MY.rest); if (!busy) live = false; return busy;
    };
    const kick = () => { if (!live) { live = true; addTask(tick); } wake(); };
    const goRest = () => { const [rx, ry] = rest(); X.to(rx); Y.to(ry); Rr.to(-5); MX.to(0); MY.to(0); following = false; card.style.opacity = S.vw >= 992 ? 1 : ''; kick(); };
    measurers.add(() => {
      if (S.vw < 992) { card.style.transform = ''; card.style.opacity = ''; return; }
      if (!following) { const [rx, ry] = rest(); X.snap(rx); Y.snap(ry); Rr.snap(-5); card.style.opacity = 1; kick(); }
    });
    card.style.transition = 'opacity .35s';
    host.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || S.vw < 992) return;
      // Chrome fires synthetic moves (no movement) when layout shifts under a resting cursor
      if (!following && !e.movementX && !e.movementY) return;
      if (e.target.closest('a, button')) { card.style.opacity = 0; return; }
      const r = host.getBoundingClientRect(); const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
      if (!following) { following = true; lastX = x; lastY = y; }
      card.style.opacity = 1;
      const dx = (x - lastX) / 2, dy = (y - lastY) / 2;
      Rr.to(clamp((x - lastX) / 4, -18, 18)); X.to(x); Y.to(y); MX.to(-clamp(dx, -8, 8)); MY.to(-clamp(dy, -8, 8));
      travel += Math.abs(dx) + Math.abs(dy); if (travel > 300) { travel = 0; nextImg(); }
      lastX = x; lastY = y;
      clearTimeout(idleT); idleT = setTimeout(() => { Rr.to(0); MX.to(0); MY.to(0); wake(); }, 66);
      kick();
    });
    host.addEventListener('pointerleave', goRest);
  });
}

/* ==========================================================================
   CONVERSATIONAL BRIEF (from the lead-funnel video): one big answer at a time
   ========================================================================== */
function initConvo() {
  const EMAIL = 'work@houseofgross.com';
  $$('[data-convo]').forEach(sec => {
    const form = $('[data-convo-form]', sec), steps = $$('.convo__step', sec), dots = $$('.convo__dots li', sec);
    const err = $('[data-convo-err]', sec), live = $('[data-convo-live]', sec), note = $('[data-convo-note]', sec);
    const inputs = $$('.convo__input', sec); let cur = 0, busy = false;
    const size = inp => { const n = Math.max(inp.value.length, inp.placeholder.length); inp.style.setProperty('--cw', (n * .56 + .8).toFixed(2) + 'em'); };
    const val = name => ($(`[name="${name}"]`, form).value || '').trim();
    inputs.forEach(inp => {
      size(inp);
      inp.addEventListener('input', () => {
        if (inp.name === 'budget') { const dg = inp.value.replace(/\D/g, '').slice(0, 11); inp.value = dg ? Number(dg).toLocaleString('en-IN') : ''; }
        size(inp); const st = inp.closest('.convo__step'); st.classList.toggle('is-filled', !!inp.value.trim());
        sec.classList.toggle('is-typing', !!inp.value); err.textContent = ''; inp.removeAttribute('aria-invalid');
      });
      inp.addEventListener('blur', () => sec.classList.remove('is-typing'));
      inp.addEventListener('focus', () => { if (inp.value) sec.classList.add('is-typing'); });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); next(); } });
    });
    const swap = n => {
      if (busy || n === cur) return; busy = true; err.textContent = '';
      const from = steps[cur], to = steps[n];
      const fin = () => {
        from.hidden = true; from.classList.remove('is-on'); to.hidden = false; to.classList.add('is-on'); cur = n;
        dots.forEach((dt, i) => dt.classList.toggle('is-on', i === Math.min(n, 2)));
        sec.classList.remove('is-typing'); sec.classList.toggle('is-done', n === 3);
        const inp = $('.convo__input', to); (inp || to).focus({ preventScroll: true });
        if (!RM) to.animate([{ opacity: 0, filter: 'blur(14px)', transform: 'translateY(16px)' }, { opacity: 1, filter: 'blur(0)', transform: 'none' }], { duration: 560, easing: 'cubic-bezier(.16,1,.3,1)' });
        live.textContent = n === 3 ? 'Brief ready.' : `Step ${n + 1} of 3`;
        busy = false;
      };
      if (RM) fin(); else from.animate([{ opacity: 1, filter: 'blur(0)', transform: 'none' }, { opacity: 0, filter: 'blur(14px)', transform: 'translateY(-16px)' }], { duration: 360, easing: 'cubic-bezier(.4,0,1,1)' }).onfinish = fin;
    };
    const flag = msg => { const inp = $('.convo__input', steps[cur]); if (!inp) return; inp.setAttribute('aria-invalid', 'true'); if (!err.id) err.id = 'cv-err-' + Math.random().toString(36).slice(2, 7); const db = inp.getAttribute('aria-describedby') || ''; if (!db.includes(err.id)) inp.setAttribute('aria-describedby', (db + ' ' + err.id).trim()); };
    const shake = () => {
      flag(); const f = $('.convo__field', steps[cur]); if (f && !RM) f.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-10px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(-4px)' }, { transform: 'none' }], { duration: 420, easing: 'ease-out' }); };
    const brief = () => {
      const b = val('budget');
      return { subject: `New brief: ${val('idea').slice(0, 60)}`, body: `Hi HOGS,\n\nWhat we're making: ${val('idea')}\nRough budget: ${b ? '₹ ' + b : 'Not sure yet'}\nReply to: ${val('email')}\n` };
    };
    function next() {
      if (cur === 0) { if (val('idea').length < 2) { err.textContent = 'Give us a word or two about the project.'; shake(); return; } swap(1); }
      else if (cur === 1) swap(2);
      else if (cur === 2) submit();
    }
    function submit() {
      const em = val('email');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) { err.textContent = em ? 'That email doesn’t look quite right.' : 'We need an email to reply to.'; shake(); return; }
      const b = brief();
      try { location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(b.subject)}&body=${encodeURIComponent(b.body)}`; } catch (e) {}
      swap(3);
    }
    $$('[data-convo-next]', sec).forEach(b => b.addEventListener('click', next));
    $('[data-convo-skip]', sec).addEventListener('click', () => { const i = $('[name="budget"]', form); i.value = ''; size(i); swap(2); });
    form.addEventListener('submit', e => { e.preventDefault(); next(); });
    $('[data-convo-copy]', sec).addEventListener('click', async () => {
      const b = brief(); const ok = await copy(`To: ${EMAIL}\nSubject: ${b.subject}\n\n${b.body}`);
      note.textContent = ok ? `Copied. Paste it into an email to ${EMAIL}.` : `Write to ${EMAIL} with your idea, budget and email.`; if (ok) toast('Brief copied.');
    });
    $('[data-convo-again]', sec).addEventListener('click', () => { inputs.forEach(i => { i.value = ''; size(i); i.closest('.convo__step').classList.remove('is-filled'); }); note.textContent = 'Your email app should open with it filled in. Hit send and it reaches us.'; swap(0); });
    // the placeholder types example answers so it is obvious you can write here
    const EX = { idea: ['a launch film', 'a festival shoot', 'a lookbook', 'a brand refresh', 'your idea'], budget: ['5,00,000', '12,00,000', 'your budget'], email: ['you@yourbrand.com', 'your email'] };
    let secVis = false; new IntersectionObserver(([en]) => { secVis = en.isIntersecting; }).observe(sec);
    inputs.forEach(inp => {
      if (RM) return;
      const words = EX[inp.name] || [inp.placeholder]; let wi = 0, ci = words[0].length, dir = -1, hold = 22;
      inp.placeholder = words[0];
      const step = () => {
        const st = inp.closest('.convo__step');
        if (!secVis || st.hidden || inp.value || d.activeElement === inp || root.classList.contains('motion-paused')) { setTimeout(step, 400); return; }
        const w = words[wi];
        if (hold > 0) { hold--; }
        else if (dir < 0) { ci--; if (ci <= 0) { ci = 0; dir = 1; wi = (wi + 1) % words.length; hold = 3; } }
        else { ci++; if (ci >= words[wi].length) { ci = words[wi].length; dir = -1; hold = 22; } }
        inp.placeholder = words[wi].slice(0, ci) || '\u200b'; size(inp);
        setTimeout(step, dir < 0 && !hold ? 38 : 85);
      };
      setTimeout(step, 1600);
      inp.addEventListener('focus', () => { inp.placeholder = words[words.length - 1]; size(inp); });
    });
    // ?topic=strategy prefills the idea on the contact page
    const q = new URLSearchParams(location.search).get('topic');
    if (q && sec.matches('.convo--page')) { const i = $('[name="idea"]', form); i.value = ({ strategy: 'Brand strategy', creative: 'Creative and production', storytelling: 'Storytelling' })[q] || ''; size(i); i.closest('.convo__step').classList.toggle('is-filled', !!i.value); }
  });
}

/* ---------- the curved strip of chrome icons and frames under the brief ---------- */
function initStrip() {
  $$('[data-strip]').forEach(st => {
    const items = $$('.strip__item', st); let base = [], L = 1, off = 0, vis = false;
    measurers.add(() => { let acc = 0; const gap = Math.max(26, S.vw * .028); base = items.map(it => { const w = it.offsetWidth; const c = acc + w / 2; acc += w + gap; return c; }); L = acc; });
    new IntersectionObserver(([e]) => { vis = e.isIntersecting; if (vis) wake(); }).observe(st);
    const blurs = items.map(() => -1);
    addTask(dt => {
      if (!vis) return false;
      if (!RM && !root.classList.contains('motion-paused')) off += (46 + Math.min(900, Math.abs(S.vel)) * .25) * dt;
      const R = Math.max(S.vw * .62, 520);
      items.forEach((it, i) => {
        const u = ((((base[i] - off) % L) + L) % L) - L / 2, th = u / R;
        if (Math.abs(th) > 1.3) { it.style.visibility = 'hidden'; return; }
        it.style.visibility = '';
        const x = R * Math.sin(th), z = R * (1 - Math.cos(th)) * .9;
        it.style.transform = `translate3d(${x.toFixed(1)}px,0,${z.toFixed(1)}px) rotateY(${(-th / DEG * .92).toFixed(2)}deg)`;
        const b = Math.round(clamp(1 - (Math.abs(th) - .7) * 1.6, 0, 1) * 20) / 20; if (b !== blurs[i]) { blurs[i] = b; it.style.opacity = b; }
      });
      return true;
    });
  });
}


/* ---------- phones and tablets: cards stack as you scroll (Latest drops, three disciplines) ---------- */
function initPhoneStacks() {
  if (RM) return;
  const groups = [['[data-drops-stack]', '.drop'], ['[data-xp]', '.xp__panel']].map(([g, c]) => { const el = $(g); return el && { el, cards: $$(c, el), tops: [], h: [] }; }).filter(Boolean);
  if (!groups.length) return;
  let on = false;
  measurers.add(() => {
    on = S.vw <= 900;
    groups.forEach(G => {
      G.el.classList.toggle('is-stack', on);
      G.cards.forEach(c => { c.style.removeProperty('--ks'); c.style.removeProperty('--kd'); });
      if (!on) return;
      G.tops = G.cards.map(docTop); G.h = G.cards.map(c => c.offsetHeight);
      G.stick = G.cards.map(c => parseFloat(getComputedStyle(c).top) || 0);
    });
  });
  let lastY = -1;
  addTask(() => {
    if (!on || S.y === lastY) return false; lastY = S.y;
    groups.forEach(G => {
      const arrive = G.cards.map((c, i) => clamp(1 - (G.tops[i] - S.y - G.stick[i]) / (S.vh * .8), 0, 1));
      G.cards.forEach((c, i) => {
        let depth = 0; for (let j = i + 1; j < G.cards.length; j++) depth += arrive[j];
        c.style.setProperty('--ks', (1 - Math.min(depth, 3) * .06).toFixed(4));
        c.style.setProperty('--kd', Math.min(.6, depth * .32).toFixed(3));
        c.style.setProperty('--ka', arrive[i].toFixed(3));
      });
    });
    return false;
  });
}

/* ---------- back to top ---------- */
function initTop() {
  $$('[data-top]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); goTo(0); $('#main').focus({ preventScroll: true }); }));
}

/* ---------- boot ---------- */
function boot() {
  initWipe();
  initReveals();
  initTheme();
  initNav(); initMenu(); initGlass();
  initSmooth(); initAnchors();
  initPill(); initRing(); initDrops(); initTide(); initTrack(); initFlock(); initCursorCard();
  initLine(); initStack(); initDx(); initParallax(); initMarquee();
  initSimpleProgress('[data-scene="phimg"]', o => clamp(S.y / Math.max(1, o.h), 0, 1));
  initSimpleProgress('[data-scene="band"]', o => clamp((S.y + S.vh - o.top) / (o.h + S.vh), 0, 1));
  initMagnetic(); initCursor(); initHoverLists(); initTilt(); initTicker(); initMotionToggle(); initPanels(); initCounters(); initDraw();
  initConvo(); initStrip(); initPhoneStacks();
  initWork(); initAccordion(); initLoopsVisibility(); initCopyEmail(); initTop();
  measure();
  initProximity();
  (d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve()).then(() => { measure(); initInk(); });
  addEventListener('load', measure);
  new ResizeObserver(() => { clearTimeout(rT); rT = setTimeout(measure, 80); }).observe(body);
  mqReduce.addEventListener('change', () => location.reload());
}
boot();
})();
