/* ==========================================================================
   Damped scrolling
   --------------------------------------------------------------------------
   A mouse wheel moves the page in STEPS: one notch is a fixed jump. Here the
   real scroll position follows a target on a critically damped spring
   instead, so a notch becomes a short glide that gathers speed softly and
   settles without overshoot, and a run of notches one continuous movement.
   The position itself is eased (no fake transform): the sticky header, the
   side columns and everything that reads window.scrollY follow it as is.

   Deliberately limited:
   · Fine pointers only — touch scrolling is already inertial.
   · Off under prefers-reduced-motion and under the site's own "reduce
     motion" setting (html[data-motion="reduced"], read at every event).
   · Never a zoom gesture (ctrl + wheel), never while a sheet or the finder
     holds the page still, never a box that can still scroll itself (the
     finder's list, a menu): the wheel is theirs.
   · Anything that moves the page without us — a scrollbar drag, find-in-
     page, a screen reader — is adopted rather than fought.
   In-page links (the contents of a long page, "skip to content") and the
   back-to-top button glide the same way, stopping under the sticky header.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var fine = window.matchMedia("(pointer: fine)").matches;
  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  function reduced() { return prefersReduced.matches || root.getAttribute("data-motion") === "reduced"; }
  function held() { return root.style.overflow === "hidden" || document.body.style.overflow === "hidden" || root.classList.contains("is-held"); }

  var OMEGA = 6.8;       /* the spring's stiffness: ~0.75 s for a notch to settle */
  var SETTLE = 0.35;     /* px: below this (and slow) the glide snaps and stops */
  var target = window.scrollY, current = target, written = Math.round(current), vel = 0;
  var max = 0, running = false, last = 0, dpr = window.devicePixelRatio || 1;

  function measure() {
    max = Math.max(0, root.scrollHeight - window.innerHeight);
    if (target > max) target = max;
  }
  function clamp(v) { return v < 0 ? 0 : v > max ? max : v; }

  function frame(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    /* the spring solved exactly over dt: the same glide at 60, 144 and 240 Hz */
    var x0 = current - target, e = Math.exp(-OMEGA * dt), c = vel + OMEGA * x0;
    current = target + (x0 + c * dt) * e;
    vel = (vel - OMEGA * c * dt) * e;
    if (Math.abs(target - current) < SETTLE && Math.abs(vel) < 6) { current = target; vel = 0; running = false; }
    /* whole device pixels: a position between two pixels is drawn snapped one frame and not the next */
    var px = Math.round(current * dpr) / dpr;
    written = Math.round(px);
    window.scrollTo(0, px);
    if (running) requestAnimationFrame(frame);
  }
  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
  function stop() { running = false; vel = 0; current = target = written = window.scrollY; }

  /* glide to a page position (the back-to-top button, the contents of a long page) */
  function glideTo(y) {
    measure();
    if (reduced() || !fine) { window.scrollTo({ top: clamp(y), behavior: reduced() ? "auto" : "smooth" }); return; }
    if (!running) { current = written = window.scrollY; vel = 0; }
    target = clamp(y);
    start();
  }
  window.EMEKscroll = glideTo;

  /* a box between the pointer and the page that can still scroll that way keeps the wheel */
  function ownsWheel(el, dy) {
    for (; el && el.nodeType === 1 && el !== document.body && el !== root; el = el.parentElement) {
      var oy = getComputedStyle(el).overflowY;
      if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 1) {
        if (dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
      }
    }
    return false;
  }

  if (fine) {
    root.style.scrollBehavior = "auto";          /* the CSS smooth scroll would smooth every frame of the glide a second time */

    window.addEventListener("wheel", function (e) {
      if (e.ctrlKey || reduced() || held()) return;
      if (ownsWheel(e.target, e.deltaY)) return;
      e.preventDefault();
      /* deltaMode 1 is lines, 2 is pages — both into pixels */
      var d = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1);
      measure();
      if (!running) { current = written = window.scrollY; vel = 0; target = current; }
      target = clamp(target + d);
      start();
    }, { passive: false });

    /* the keys too, or the page would glide under the wheel and jump under the space bar */
    var KEYS = {
      PageDown: function () { return window.innerHeight * 0.85; },
      PageUp: function () { return -window.innerHeight * 0.85; },
      ArrowDown: function () { return 120; },
      ArrowUp: function () { return -120; },
      Home: function () { return -Infinity; },
      End: function () { return Infinity; },
      " ": function (e) { return window.innerHeight * (e.shiftKey ? -0.85 : 0.85); }
    };
    window.addEventListener("keydown", function (e) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || reduced() || held()) return;
      var t = e.target, tag = (t && t.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
      if (t && t.closest && t.closest("[role='listbox'], [role='menu'], [role='dialog'], dialog, .mega, .lang__menu")) return;
      var step = KEYS[e.key];
      if (!step) return;
      /* space on a focused button or link presses it — it must not also scroll */
      if (e.key === " " && t && t.closest && t.closest("button, [role='button'], a, summary, select, label")) return;
      e.preventDefault();
      measure();
      if (!running) { current = written = window.scrollY; vel = 0; target = current; }
      var d = step(e);
      target = d === Infinity ? max : d === -Infinity ? 0 : clamp(target + d);
      start();
    });

    /* someone else moved the page: adopt it (compared with the last position WE wrote —
       scroll events arrive late, and comparing with `current` would cut fast glides short) */
    window.addEventListener("scroll", function () {
      if (Math.abs(window.scrollY - written) > 2) { current = target = written = window.scrollY; vel = 0; }
    }, { passive: true });
    /* a mouse press on the scrollbar, or a touch on a touch-screen laptop, takes over at once */
    window.addEventListener("pointerdown", function () { if (running) stop(); }, { passive: true });

    window.addEventListener("resize", function () { dpr = window.devicePixelRatio || 1; measure(); });
    if ("ResizeObserver" in window) new ResizeObserver(measure).observe(document.body);
    measure();
  }

  /* pictures are unpacked a screen before they arrive: a large portrait decoded in the frame it comes
     on screen held that frame back (measured where the doctors' photos enter during a glide) */
  if ("IntersectionObserver" in window && "decode" in Image.prototype) {
    var pre = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var img = e.target;
        pre.unobserve(img);
        var go = function () { img.decode().catch(function () { /* drawn the usual way */ }); };
        if (img.complete && img.naturalWidth) go(); else img.addEventListener("load", go, { once: true });
      });
    }, { rootMargin: "120% 0px 120% 0px" });
    [].forEach.call(document.querySelectorAll('img[loading="lazy"]'), function (img) { pre.observe(img); });
  }

  /* in-page links glide and stop under the sticky header (the CSS scroll-padding) */
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = decodeURIComponent(a.getAttribute("href").slice(1));
    var el = id && document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    var pad = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
    glideTo(el.getBoundingClientRect().top + window.scrollY - pad);
    if (a.classList.contains("skip") || el.matches("main, [tabindex]")) {
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
      el.focus({ preventScroll: true });
    }
    if (history.replaceState) history.replaceState(null, "", "#" + id);
  });
})();
