/* ==========================================================================
   The motion layer, and the home page's two moving parts
   --------------------------------------------------------------------------
   The header's reading line and the back-to-top ring; the pill that follows
   the pointer along the menu; headings that arrive word by word; pictures
   that settle; the light under the pointer on cards; the gentle pull of the
   main buttons; numbers that
   count up; the chairman's words lighting as they are read; the doctors'
   rail (buttons, drag, a progress line); "Nereniz rahatsız?" (a region → its
   departments and doctors); the departments menu's preview; toasts.
   Under "reduce motion" (the system's, or the site's own switch) nothing
   moves that does not have to. The page works without any of this.
   ========================================================================== */
(function () {
  "use strict";
  var html = document.documentElement;
  var D = window.EMEK || { depts: [], docs: [] };
  var BASE = html.getAttribute("data-base") || "/";
  /* the words this script says, in the page's language (js/data.<lang>.js; the Turkish is the key) */
  var I18N = (window.EMEK && window.EMEK.i18n) || {};
  var T = function (s, v) { var t = I18N[s] || s; if (v) Object.keys(v).forEach(function (k) { t = t.split("{" + k + "}").join(v[k]); }); return t; };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var icon = function (id, cls) { return '<svg class="icon ' + (cls || "") + '" aria-hidden="true"><use href="' + BASE + 'img/icons.svg#' + id + '"/></svg>'; };
  var abs = function (h) { return !h || /^(https?:|tel:|mailto:|#)/.test(h) ? h : BASE + h; };
  var reduced = function () { return html.getAttribute("data-motion") === "reduced" || matchMedia("(prefers-reduced-motion: reduce)").matches; };
  var fine = matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* page to page: the browser's own transition, skipped when motion is reduced */
  addEventListener("pageswap", function (e) { if (reduced() && e.viewTransition) e.viewTransition.skipTransition(); });
  addEventListener("pagereveal", function (e) { if (reduced() && e.viewTransition) e.viewTransition.skipTransition(); });

  /* ---- toasts ---- */
  var toasts = null;
  function toast(msg, ic) {
    if (!toasts) { toasts = document.createElement("div"); toasts.className = "toasts"; toasts.setAttribute("role", "status"); toasts.setAttribute("aria-live", "polite"); document.body.appendChild(toasts); }
    var t = document.createElement("div");
    t.className = "toast"; t.innerHTML = icon(ic || "i-check") + "<span>" + esc(msg) + "</span>";
    toasts.appendChild(t);
    setTimeout(function () { t.classList.add("is-out"); setTimeout(function () { t.remove(); }, 420); }, 2600);
  }
  window.EMEKtoast = toast;

  /* ---- how far the page has been read: the header's line, the back-to-top ring ---- */
  var hdr = $(".hdr");
  if (hdr) { var line = document.createElement("span"); line.className = "hdr__line"; line.setAttribute("aria-hidden", "true"); hdr.appendChild(line); }
  var up = document.createElement("button");
  up.type = "button"; up.className = "totop"; up.setAttribute("aria-label", T("Sayfanın başına dön"));
  up.innerHTML = '<svg class="ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="16" pathLength="100"/></svg>' + icon("i-up");
  document.body.appendChild(up);
  up.addEventListener("click", function () { if (window.EMEKscroll) window.EMEKscroll(0); else scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" }); });
  /* the value goes to the two things that draw it, not to <html>: a custom property set on the root
     restyles the whole page, every frame of a scroll (measured as dropped frames once the wheel glides) */
  var ticking = false, max = 0, readers = [up].concat(line ? [line] : []);
  function room() { max = document.documentElement.scrollHeight - innerHeight; }
  function reading() {
    ticking = false;
    var v = (max > 0 ? Math.min(1, scrollY / max) : 0).toFixed(4);
    readers.forEach(function (el) { el.style.setProperty("--read", v); });
    up.classList.toggle("is-on", scrollY > innerHeight * 1.2);
    fills.forEach(fill);
  }
  room();
  addEventListener("resize", function () { room(); reading(); });
  if ("ResizeObserver" in window) new ResizeObserver(function () { room(); }).observe(document.body);
  addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(reading); } }, { passive: true });

  /* ---- the menu: a pill that follows the pointer from item to item ---- */
  var nav = $(".nav");
  if (nav && fine) {
    var pill = document.createElement("span");
    pill.className = "nav__pill"; pill.setAttribute("aria-hidden", "true");
    nav.insertBefore(pill, nav.firstChild); nav.classList.add("has-pill");
    var shown = false;
    $$(".nav__a", nav).forEach(function (a) {
      a.addEventListener("mouseenter", function () {
        if (!shown) { pill.style.transition = "opacity 220ms"; shown = true; requestAnimationFrame(function () { pill.style.transition = ""; }); }
        pill.style.width = a.offsetWidth + "px"; pill.style.transform = "translateX(" + a.offsetLeft + "px)"; pill.style.opacity = "1";
      });
    });
    nav.addEventListener("mouseleave", function () { pill.style.opacity = "0"; shown = false; });
  }

  /* ---- words that arrive ---- */
  function split(el) {
    if (el.getAttribute("data-split")) return;
    el.setAttribute("data-split", "1");
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    var i = 0;
    (function walk(node) {
      [].slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var w = document.createElement("span"), s = document.createElement("span");
            w.className = "w"; w.setAttribute("aria-hidden", "true");
            s.textContent = part; s.style.setProperty("--wi", i++);
            w.appendChild(s); frag.appendChild(w);
          });
          /* right to left, a run of Latin words (a doctor's name) is laid out as one left-to-right island:
             split into inline blocks, it would otherwise be read in reverse */
          if (html.dir === "rtl" && /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(n.textContent) && !/[؀-ۿ]/.test(n.textContent)) {
            var b = document.createElement("bdi"); b.className = "wl"; b.dir = "ltr"; b.appendChild(frag); frag = b;
          }
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1 && !/^(svg|img|br)$/i.test(n.tagName)) walk(n);
      });
    })(el);
    el.classList.add("js-split");
  }

  var io = null;
  if (!reduced() && "IntersectionObserver" in window) {
    html.classList.add("rv");
    io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -7% 0px", threshold: 0.05 });
    $$(".hero__title, .phead h1, .h2, .feature__title").forEach(function (h) { split(h); io.observe(h); });
    var t = $(".hero__title"); if (t) t.style.setProperty("--wd", "120ms");
    /* the pictures that fly between pages (view-transition names) are left alone: they must be visible to fly */
    $$(".word__pic img, .feature__pic img, .chart img, .fig img").forEach(function (im) {
      if (im.style.viewTransitionName) return;
      im.classList.add("settle"); io.observe(im);
    });
  }

  /* ---- the light under the pointer, on cards ---- */
  var SPOT = ".dept, .qa, .hubc, .guide__list a, .way, .lrow, .arow, .pcard, .opt, .feature, .mini";
  if (fine) {
    /* where the pointer is on a card: its light gathers there, and the card leans a degree toward it
       (only cards narrow enough to read as objects; a full-width row only lights) */
    var lean = null;
    document.addEventListener("pointermove", function (e) {
      var c = e.target.closest && e.target.closest(SPOT);
      if (lean && lean !== c) { lean.style.removeProperty("--rx"); lean.style.removeProperty("--ry"); lean = null; }
      if (!c) return;
      var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      c.style.setProperty("--mx", (e.clientX - r.left).toFixed(0) + "px");
      c.style.setProperty("--my", (e.clientY - r.top).toFixed(0) + "px");
      if (!reduced() && r.width < 480) {
        c.style.setProperty("--rx", ((0.5 - y) * 3.2).toFixed(2) + "deg");
        c.style.setProperty("--ry", ((x - 0.5) * 3.2).toFixed(2) + "deg");
        lean = c;
      }
    }, { passive: true });

    /* the main buttons lean toward the pointer */
    $$("[data-magnet]").forEach(function (b) {
      b.addEventListener("pointermove", function (e) {
        if (reduced()) return;
        var r = b.getBoundingClientRect();
        b.style.transform = "translate(" + ((e.clientX - r.left) / r.width - 0.5) * 8 + "px," + ((e.clientY - r.top) / r.height - 0.5) * 6 + "px)";
      });
      b.addEventListener("pointerleave", function () { b.style.transform = ""; });
    });

  }

  /* ---- numbers that count up ---- */
  $$("[data-count-to]").forEach(function (el) {
    var n = +el.getAttribute("data-count-to");
    if (reduced() || !("IntersectionObserver" in window)) return;
    el.textContent = "0";
    var o = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      o.disconnect();
      var t0 = performance.now(), dur = 1500;
      (function tick(now) {
        var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);
        el.textContent = Math.round(n * e);
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
    }, { threshold: 0.6 });
    o.observe(el);
  });

  /* ---- words that light as they are read (the chairman's message) ---- */
  var fills = [];
  if (!reduced()) {
    $$("[data-fill]").forEach(function (q) {
      var words = [];
      (function walk(node) {
        [].slice.call(node.childNodes).forEach(function (n) {
          if (n.nodeType === 3) {
            var frag = document.createDocumentFragment();
            n.textContent.split(/(\s+)/).forEach(function (part) {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
              var s = document.createElement("span"); s.className = "fw"; s.textContent = part; words.push(s); frag.appendChild(s);
            });
            n.parentNode.replaceChild(frag, n);
          } else if (n.nodeType === 1) walk(n);
        });
      })(q);
      q.classList.add("is-fill");
      fills.push({ el: q, words: words, lit: -1 });
    });
  }
  function fill(f) {
    var r = f.el.getBoundingClientRect(), vh = innerHeight;
    var p = Math.max(0, Math.min(1, (vh * 0.88 - r.top) / (r.height + vh * 0.38)));
    var n = Math.round(p * f.words.length);
    if (n === f.lit) return;
    f.words.forEach(function (w, i) { w.classList.toggle("lit", i < n); });
    f.lit = n;
  }
  reading();

  /* ---- the doctors' rail ---- */
  $$("[data-rail]").forEach(function (rail) {
    var track = $(".rail__track", rail), prev = $("[data-prev]", rail), next = $("[data-next]", rail), bar = $(".rail__bar i", rail);
    if (!track) return;
    var gap = function () { return parseFloat(getComputedStyle(track).columnGap) || 16; };
    var stepW = function () { var c = $(".doc:not([hidden])", track); return c ? c.offsetWidth + gap() : 300; };
    var rtl = getComputedStyle(track).direction === "rtl", sgn = rtl ? -1 : 1;
    function upd() {
      var max = track.scrollWidth - track.clientWidth, at = Math.abs(track.scrollLeft), p = max > 0 ? at / max : 0;
      var w = track.scrollWidth ? Math.min(1, track.clientWidth / track.scrollWidth) : 1;
      if (bar) { bar.style.width = (w * 100).toFixed(2) + "%"; bar.style.transform = "translateX(" + (sgn * (p * (1 - w)) / w * 100).toFixed(2) + "%)"; }
      if (prev) prev.disabled = at < 4;
      if (next) next.disabled = at > max - 4;
    }
    var perPage = function () { return Math.max(1, Math.round(track.clientWidth / stepW())); };
    if (prev) prev.addEventListener("click", function () { track.scrollBy({ left: -sgn * stepW() * perPage(), behavior: reduced() ? "auto" : "smooth" }); });
    if (next) next.addEventListener("click", function () { track.scrollBy({ left: sgn * stepW() * perPage(), behavior: reduced() ? "auto" : "smooth" }); });
    track.addEventListener("scroll", function () { requestAnimationFrame(upd); }, { passive: true });
    addEventListener("resize", upd);
    /* drag with the mouse (touch scrolls by itself) */
    var down = null, moved = false;
    track.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      down = { x: e.clientX, s: track.scrollLeft }; moved = false;
    });
    addEventListener("pointermove", function (e) {
      if (!down) return;
      var dx = e.clientX - down.x;
      if (!moved && Math.abs(dx) > 5) { moved = true; track.classList.add("is-drag"); }
      if (moved) track.scrollLeft = down.s - dx;
    });
    addEventListener("pointerup", function () {
      if (!down) return;
      down = null;
      if (moved) {
        track.classList.remove("is-drag");
        var w = stepW(), to = Math.round(track.scrollLeft / w) * w;
        track.scrollTo({ left: to, behavior: reduced() ? "auto" : "smooth" });
        setTimeout(function () { moved = false; }, 0);
      }
    });
    track.addEventListener("click", function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
    track.addEventListener("dragstart", function (e) { e.preventDefault(); });
    rail.addEventListener("click", function (e) { if (e.target.closest("[data-f]")) setTimeout(function () { track.scrollTo({ left: 0 }); upd(); }, 0); });
    upd();
  });

  /* ---- "Nereniz rahatsız?": a region, then its departments and doctors ---- */
  $$("[data-areas]").forEach(function (box) {
    var tabs = $$('[role="tab"]', box), panels = $$('[role="tabpanel"]', box);
    function pick(t, focus) {
      tabs.forEach(function (x) { var is = x === t; x.setAttribute("aria-selected", String(is)); x.tabIndex = is ? 0 : -1; });
      panels.forEach(function (p) {
        var is = p.id === t.getAttribute("aria-controls");
        if (is && p.hidden) {
          p.hidden = false;
          if (!reduced() && p.animate) {
            p.animate([{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], { duration: 560, easing: "cubic-bezier(.22,1,.36,1)" });
            $$(".arow", p).forEach(function (r, i) { r.animate([{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "none" }], { duration: 640, delay: 80 + i * 70, easing: "cubic-bezier(.22,1,.36,1)", fill: "backwards" }); });
          }
        } else if (!is) p.hidden = true;
      });
      if (focus) t.focus();
      var strip = t.parentNode;
      if (strip.scrollWidth > strip.clientWidth + 4) strip.scrollTo({ left: t.offsetLeft - strip.clientWidth / 2 + t.offsetWidth / 2, behavior: reduced() ? "auto" : "smooth" });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { pick(t); });
      t.addEventListener("keydown", function (e) {
        var k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (e.key === "Home") k = -i; if (e.key === "End") k = tabs.length - 1 - i;
        if (k !== undefined) { e.preventDefault(); pick(tabs[(i + k + tabs.length) % tabs.length], true); }
      });
    });
  });

  /* ---- the departments menu: a department under the pointer shows itself in the side panel ---- */
  /* The panel changes only once the pointer has settled on a department (a pointer resting on the
     line between two of them used to swap the panel back and forth on every pixel, each swap starting
     a fade from nothing — the panel flickered empty). Each department's card is built once and kept, so
     its photos never load twice; the panel's size never depends on which card it shows. */
  var mega = $(".mega"), peek = mega && $(".mega__peek", mega), plain = mega && $(".mega__default", mega);
  if (peek && fine) {
    var cards = {}, last = null, wait = 0;
    var card = function (slug) {
      if (cards[slug]) return cards[slug];
      var d = D.depts.filter(function (x) { return x.slug === slug; })[0];
      if (!d) return null;
      var faces = (d.faces || []).map(function (f) { return '<img src="' + esc(abs(f)) + '" alt="" width="240" height="276">'; }).join("");
      var el = document.createElement("div");
      el.className = "mega__card";
      el.innerHTML = '<span class="mega__i">' + icon(d.icon) + "</span>" +
        '<p class="h3">' + esc(d.name) + "</p>" + (d.sum ? '<p class="mega__sum">' + esc(d.sum) + "</p>" : "") +
        '<div class="faces faces--night">' + faces + "<span>" + (d.count ? T("{n} hekim", { n: d.count }) : T("Tıbbi birim")) + "</span></div>" +
        '<div class="mega__acts"><a class="btn btn--light btn--sm" href="' + esc(abs(d.href)) + '">' + T("Bölümü incele") + "</a>" +
        (d.count ? '<a class="btn btn--bright btn--sm" href="' + esc(abs("randevu/?bolum=" + d.slug)) + '">' + icon("i-calendar") + T("Randevu") + "</a>" : "") + "</div>";
      return (cards[slug] = el);
    };
    var show = function (slug) {
      if (slug === last) return;
      var el = card(slug);
      if (!el) return;
      last = slug;
      peek.replaceChildren(el);
      var first = peek.hidden;
      peek.hidden = false; plain.hidden = true;
      if (!reduced() && el.animate) el.animate(first ? [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }]
                                                    : [{ opacity: 0.35 }, { opacity: 1 }], { duration: first ? 320 : 220, easing: "cubic-bezier(.22,1,.36,1)" });
    };
    $$(".mega__list a", mega).forEach(function (a) {
      a.addEventListener("mouseenter", function () { clearTimeout(wait); wait = setTimeout(function () { show(a.dataset.slug); }, 90); });
      a.addEventListener("focus", function () { clearTimeout(wait); show(a.dataset.slug); });
    });
    mega.addEventListener("mouseleave", function () { clearTimeout(wait); wait = setTimeout(function () { last = null; peek.hidden = true; plain.hidden = false; }, 160); });
    mega.addEventListener("mouseenter", function () { clearTimeout(wait); });
  }
})();
