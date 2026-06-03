'use strict';

// Functions run in order — injectBottomNav must precede initScrollspy.

/* ── 1. WebGL shader background ───────────────────────────────────────────── */
(function initWebGLShader() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.getElementById('bg-canvas').style.background = '#06080f';
    return;
  }

  const canvas = document.getElementById('bg-canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) { canvas.style.background = '#06080f'; return; }

  /* ── Vertex shader ─────────────────────────────────────────────── */
  const VS = `
    attribute vec2 a_pos;
    void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
  `;

  /* ── Fragment shader ───────────────────────────────────────────── */
  const FS = `
    precision highp float;

    uniform float u_time;
    uniform vec2  u_res;
    uniform vec2  u_cursor;  /* fast follower - tight glow */
    uniform vec2  u_ghost;   /* slow follower - dissipating trail */

    /* ── Noise helpers ───────────────────────────────────── */
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }
    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i),             hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
      );
    }
    float fbm(vec2 p) {
      float v = 0.0, amp = 0.5;
      mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
      for (int i = 0; i < 4; i++) {
        v += amp * vnoise(p);
        p = rot * p * 2.1 + 100.0;
        amp *= 0.5;
      }
      return v;
    }

    /* ── Aspect-corrected squared distance ───────────────── */
    float adist2(vec2 a, vec2 b, float aspect) {
      vec2 d = (a - b) * vec2(aspect, 1.0);
      return dot(d, d);
    }

    void main() {
      vec2  uv     = gl_FragCoord.xy / u_res;
      float aspect = u_res.x / u_res.y;

      /* ── Barely-drifting noise base ──────────────────────── */
      vec2  p = uv * vec2(aspect, 1.0) * 2.5;
      float n = fbm(p + u_time * 0.012);
      vec3 col = mix(
        vec3(0.024, 0.031, 0.059),
        vec3(0.010, 0.072, 0.105),
        n * 0.18
      );

      /* ── How far apart are cursor and ghost?
             → drives trail intensity (0 when still, 1 when moving fast) */
      float sep   = sqrt(adist2(u_cursor, u_ghost, aspect));
      float speed = clamp(sep * 9.0, 0.0, 1.0);

      /* ── Cursor glow (tight, always visible) ─────────────── */
      float dc2 = adist2(uv, u_cursor, aspect);
      col += vec3(0.000, 0.831, 1.000) * exp(-dc2 * 72.0) * 0.18; /* bright core   */
      col += vec3(0.000, 0.620, 0.800) * exp(-dc2 * 22.0) * 0.07; /* soft halo     */

      /* ── Ghost trail (only visible while moving) ─────────── */
      float dg2 = adist2(uv, u_ghost, aspect);
      col += vec3(0.000, 0.450, 0.640) * exp(-dg2 * 14.0) * 0.05 * speed; /* trail body  */
      col += vec3(0.000, 0.200, 0.320) * exp(-dg2 *  2.8) * 0.02 * speed; /* wide wash   */

      /* ── Edge vignette ───────────────────────────────────── */
      vec2  cv  = uv - 0.5;
      float vig = clamp(1.0 - dot(cv, cv) * 1.15, 0.0, 1.0);
      col      *= mix(0.40, 1.0, vig);

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  /* ── Compile / link ────────────────────────────────────────────── */
  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('Shader error:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }
  const vs = compile(gl.VERTEX_SHADER, VS);
  const fs = compile(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) { canvas.style.background = '#06080f'; return; }

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('Shader link error:', gl.getProgramInfoLog(prog));
    canvas.style.background = '#06080f';
    return;
  }
  gl.useProgram(prog);

  /* ── Full-screen quad ──────────────────────────────────────────── */
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1,-1,  1,-1, -1, 1,
     1,-1,  1, 1, -1, 1,
  ]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  /* ── Uniforms ──────────────────────────────────────────────────── */
  const uTime   = gl.getUniformLocation(prog, 'u_time');
  const uRes    = gl.getUniformLocation(prog, 'u_res');
  const uCursor = gl.getUniformLocation(prog, 'u_cursor');
  const uGhost  = gl.getUniformLocation(prog, 'u_ghost');

  /* ── Resize ────────────────────────────────────────────────────── */
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width  = window.innerWidth  * dpr;
    canvas.height = window.innerHeight * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  /* ── Input tracking ────────────────────────────────────────────── */
  let tx = 0.5, ty = 0.5;

  function setTarget(clientX, clientY) {
    tx = clientX / window.innerWidth;
    ty = 1.0 - clientY / window.innerHeight;
  }
  window.addEventListener('mousemove', e => setTarget(e.clientX, e.clientY), { passive: true });
  window.addEventListener('touchmove', e => setTarget(e.touches[0].clientX, e.touches[0].clientY), { passive: true });

  /* ── Two-spring system ─────────────────────────────────────────── */
  let cx = 0.5, cy = 0.5;
  let gx = 0.5, gy = 0.5;

  const CURSOR_K = 0.14;
  const GHOST_K  = 0.022;

  /* ── Render loop ───────────────────────────────────────────────── */
  let start = null;

  function frame(ts) {
    if (!start) start = ts;

    cx += (tx - cx) * CURSOR_K;
    cy += (ty - cy) * CURSOR_K;

    gx += (cx - gx) * GHOST_K;
    gy += (cy - gy) * GHOST_K;

    gl.uniform1f(uTime,   (ts - start) * 0.001);
    gl.uniform2f(uCursor, cx, cy);
    gl.uniform2f(uGhost,  gx, gy);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();

/* ── 2. Hamburger / drawer ────────────────────────────────────────────────── */
(function initDrawer() {
  const burger = document.getElementById('burger');
  const drawer = document.getElementById('drawer');
  if (!burger || !drawer) return;

  burger.addEventListener('click', () => {
    const open = drawer.classList.toggle('is-open');
    burger.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', open);
  });

  document.querySelectorAll('.js-close-drawer').forEach(el => {
    el.addEventListener('click', () => {
      drawer.classList.remove('is-open');
      burger.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
      drawer.classList.remove('is-open');
      burger.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      burger.focus();
    }
  });
})();

/* ── 3. Sticky nav border on scroll ──────────────────────────────────────── */
(function initStickyNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  const onScroll = () => {
    nav.style.borderBottomColor = window.scrollY > 20
      ? 'rgba(255,255,255,0.09)'
      : 'rgba(255,255,255,0.07)';
  };
  window.addEventListener('scroll', onScroll, { passive: true });
})();

/* ── 4. Back to top ───────────────────────────────────────────────────────── */
(function initBackToTop() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;
  function update() { btn.classList.toggle('visible', window.scrollY > 400); }
  window.addEventListener('scroll', update, { passive: true });
  update();
  btn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

/* ── 5. Strip drag-to-scroll (index.html only) ───────────────────────────── */
(function initStripScroll() {
  const strip = document.querySelector('.strip__scroll');
  const hint  = document.querySelector('.strip__hint');
  if (!strip) return;

  strip.addEventListener('scroll', function () {
    if (hint) hint.classList.add('is-gone');
  }, { once: true, passive: true });

  let isDown = false, startX, scrollLeft;
  strip.addEventListener('mousedown', e => {
    isDown = true;
    startX = e.pageX - strip.offsetLeft;
    scrollLeft = strip.scrollLeft;
  });
  document.addEventListener('mouseup',   () => { isDown = false; });
  document.addEventListener('mousemove', e => {
    if (!isDown) return;
    e.preventDefault();
    strip.scrollLeft = scrollLeft - (e.pageX - strip.offsetLeft - startX);
  });
})();

/* ── 6. Contact form (Formspree AJAX) ────────────────────────────────────── */
(function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;
  // Endpoint lives in HTML so each page's form can point to a different Formspree address.
  const endpoint = form.dataset.endpoint;
  if (!endpoint) return;
  const btn = document.getElementById('submitBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const required = form.querySelectorAll('[required]');
    let valid = true;
    required.forEach(field => {
      field.style.borderColor = '';
      if (!field.value.trim()) {
        field.style.borderColor = '#f87171';
        valid = false;
      }
    });
    if (!valid) return;

    btn.disabled      = true;
    btn.textContent   = 'Sending…';
    btn.style.opacity = '0.75';

    try {
      const res = await fetch(endpoint, {
        method:  'POST',
        body:    new FormData(form),
        headers: { 'Accept': 'application/json' },
      });

      if (res.ok) {
        const userName  = (form.querySelector('[name="First Name"]')?.value  || '').trim();
        const userEmail = (form.querySelector('[name="email"]')?.value || '').trim();
        btn.textContent   = '✓  Message sent. I\'ll be in touch shortly!';
        btn.classList.add('sent');
        btn.style.opacity = '1';
        const liveEl = form.querySelector('.form-status-live');
        if (liveEl) liveEl.textContent = 'Message sent. I\'ll be in touch shortly.';
        form.reset();
        setTimeout(() => {
          const p = new URLSearchParams({ name: userName, email: userEmail });
          window.location.href = `/thank-you.html?${p}`;
        }, 1500);
      } else {
        const data = await res.json().catch(() => ({}));
        const msg  = (data.errors || []).map(e => e.message).join(', ')
                     || 'Something went wrong. Please try again.';
        showFormError(msg);
      }
    } catch {
      showFormError('Could not send. Please check your connection and try again.');
    }
  });

  function showFormError(msg) {
    btn.textContent   = msg;
    btn.classList.add('error');
    btn.style.opacity = '1';
    btn.disabled      = false;
    const liveEl = form.querySelector('.form-status-live');
    if (liveEl) liveEl.textContent = msg;
    setTimeout(() => {
      btn.textContent = 'Send Message →';
      btn.classList.remove('error');
    }, 5000);
  }
})();

/* ── 7. Form field persistence (localStorage) ─────────────────────────────── */
(function initFormPersist() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  const fields = form.querySelectorAll('input:not([type="hidden"]), textarea, select');
  const key = id => `cl_form_${id}`;

  fields.forEach(field => {
    if (!field.id) return;
    const saved = localStorage.getItem(key(field.id));
    if (saved !== null) field.value = saved;
  });

  fields.forEach(field => {
    if (!field.id) return;
    field.addEventListener('input', () => localStorage.setItem(key(field.id), field.value));
  });

  form.addEventListener('reset', () => {
    fields.forEach(field => {
      if (field.id) localStorage.removeItem(key(field.id));
    });
  });
})();

/* ── 8. Inject bottom nav ─────────────────────────────────────────────────── */
(function injectBottomNav() {
  // social-value.html has no #contact section — its Contact item links off-page.
  const hasContact = !!document.getElementById('contact');
  const contactHref        = hasContact ? '#contact' : 'index.html#contact';
  const contactDataSection = hasContact ? ' data-section="contact"' : '';

  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.setAttribute('aria-label', 'Mobile navigation');
  nav.innerHTML =
    '<a href="index.html" class="bottom-nav__item">' +
      '<i class="fa-solid fa-house" aria-hidden="true"></i>' +
      '<span>Home</span>' +
    '</a>' +
    '<a href="automation.html" class="bottom-nav__item">' +
      '<i class="fa-solid fa-robot" aria-hidden="true"></i>' +
      '<span>Automation</span>' +
    '</a>' +
    '<a href="social-value.html" class="bottom-nav__item">' +
      '<i class="fa-solid fa-hand-holding-heart" aria-hidden="true"></i>' +
      '<span>Social</span>' +
    '</a>' +
    '<a href="productivity-training.html" class="bottom-nav__item">' +
      '<i class="fa-solid fa-graduation-cap" aria-hidden="true"></i>' +
      '<span>Training</span>' +
    '</a>' +
    '<a href="' + contactHref + '" class="bottom-nav__item"' + contactDataSection + '>' +
      '<i class="fa-solid fa-envelope" aria-hidden="true"></i>' +
      '<span>Contact</span>' +
    '</a>';
  document.body.appendChild(nav);
})();

/* ── 8. Bottom nav scrollspy ─────────────────────────────────────────────── */
(function initScrollspy() {
  if (window.innerWidth > 1023) return;

  // is-active was removed from static HTML during DRY refactor; set it from URL instead.
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.bottom-nav__item').forEach(el => {
    const href    = el.getAttribute('href');
    const active  = href === path || (path === '' && href === 'index.html');
    el.classList.toggle('is-active', active);
    if (active) el.setAttribute('aria-current', 'page');
  });

  /* Scrollspy only for anchor items (pages with a contact section) */
  const sectionItems = document.querySelectorAll('.bottom-nav__item[data-section]');
  const sections = [...sectionItems]
    .map(el => document.getElementById(el.dataset.section))
    .filter(Boolean);

  if (!sections.length) return;

  function setActive(id) {
    document.querySelectorAll('.bottom-nav__item').forEach(el => {
      el.classList.toggle('is-active', el.dataset.section === id);
    });
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id); });
  }, { rootMargin: '-35% 0px -55% 0px', threshold: 0 });

  sections.forEach(s => observer.observe(s));
  sectionItems.forEach(el => {
    el.addEventListener('click', () => setActive(el.dataset.section));
  });
})();

// ── Cookie consent ────────────────────────────────────────────────────────
(function () {
  const STORAGE_KEY = 'cl_cookie_consent';
  function lsGet(k)    { try { return localStorage.getItem(k); }    catch { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); }        catch {} }
  if (lsGet(STORAGE_KEY)) return;

  const banner = document.createElement('div');
  banner.className = 'cookie-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Cookie consent');
  banner.innerHTML = `
    <p class="cookie-banner__title">We use cookies</p>
    <p class="cookie-banner__body">We use a small number of cookies to keep this site working and to reply to your enquiries. We do not sell your data or share it with anyone outside of Click Lancashire.</p>
    <details class="cookie-banner__details">
      <summary>What cookies do we use?</summary>
      <ul>
        <li><strong>Essential cookies</strong> - keep the site working, including remembering your form entries so they are not lost if you navigate away.</li>
        <li><strong>Enquiry data</strong> - if you contact us, we store only what you send and delete it once your enquiry is resolved, in line with UK law.</li>
        <li>We do <strong>not</strong> use advertising, tracking, or analytics cookies.</li>
      </ul>
    </details>
    <div class="cookie-banner__actions">
      <button class="cookie-banner__btn cookie-banner__btn--accept">Accept</button>
      <button class="cookie-banner__btn cookie-banner__btn--decline">Decline</button>
    </div>
  `;
  document.body.appendChild(banner);

  requestAnimationFrame(() => requestAnimationFrame(() => banner.classList.add('is-visible')));

  function dismiss(choice) {
    lsSet(STORAGE_KEY, choice);
    banner.classList.remove('is-visible');
    banner.classList.add('is-hiding');
    banner.addEventListener('transitionend', () => banner.remove(), { once: true });
  }

  banner.querySelector('.cookie-banner__btn--accept').addEventListener('click', () => dismiss('accepted'));
  banner.querySelector('.cookie-banner__btn--decline').addEventListener('click', () => dismiss('declined'));
})();
