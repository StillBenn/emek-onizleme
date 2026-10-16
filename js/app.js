/* ==========================================================================
   Özel Gaziantep Emek Hastanesi — what every page does
   --------------------------------------------------------------------------
   The header (a line under it once the page moves), the departments menu,
   the menu sheet on a phone and the action bar under the thumb; the finder
   (one box for departments, doctors, complaints and pages: ⌘K, "/", or the
   hero's question); the reader's own text size and contrast (remembered);
   "is my insurer contracted?"; a map that loads only when asked (nothing
   goes to Google before that); blocks that rise once as they come on screen.
   The data (departments, doctors, pages, complaints, insurers) is js/data.js,
   written by tools/build.py from the hospital's own content.
   ========================================================================== */
(function () {
  "use strict";
  var html = document.documentElement;
  var D = window.EMEK || { depts: [], docs: [], pages: [], signs: [], insurers: [] };
  var BASE = html.getAttribute("data-base") || "/";
  /* the words this script says, in the page's language (js/data.<lang>.js; the Turkish is the key) */
  var I18N = (window.EMEK && window.EMEK.i18n) || {};
  var T = function (s, v) { var t = I18N[s] || s; if (v) Object.keys(v).forEach(function (k) { t = t.split("{" + k + "}").join(v[k]); }); return t; };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return localStorage.getItem("emek-" + k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem("emek-" + k, v); } catch (e) { /* private window */ } }
  };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  /* Turkish-aware folding: İ/ı, ş, ğ, ç, ö, ü all compare as their plain letters */
  var fold = function (s) {
    return String(s || "").replace(/İ/g, "i").replace(/I/g, "ı").toLocaleLowerCase("tr")
      .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ç/g, "c").replace(/ö/g, "o").replace(/ü/g, "u")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[\u064B-\u0652\u0670\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")   /* Arabic: no vowel marks, one alef */
      .replace(/(^|\s)ال(?=[\u0621-\u064A]{3})/g, "$1");   /* the article ال: "الركبة" finds "ركبة" */
  };
  /* the data's addresses are relative to the site's root: the page says where that is (data-base) */
  var abs = function (h) { return !h || /^(https?:|tel:|mailto:|#)/.test(h) ? h : BASE + h; };
  var icon = function (id, cls) { return '<svg class="icon ' + (cls || "") + '" aria-hidden="true"><use href="' + BASE + 'img/icons.svg#' + id + '"/></svg>'; };

  /* ---- header ---- */
  var hdr = $(".hdr");
  var stuck = function () { if (hdr) hdr.classList.toggle("is-stuck", scrollY > 4); };
  addEventListener("scroll", stuck, { passive: true }); stuck();

  /* the departments menu opens under its button; a click anywhere else closes it */
  var panels = [];
  function panel(btn, el) {
    if (!btn || !el) return;
    var set = function (on) {
      el.classList.toggle("is-open", on);
      btn.setAttribute("aria-expanded", String(on));
      if (on) panels.forEach(function (p) { if (p.el !== el) p.set(false); });
    };
    panels.push({ el: el, set: set });
    btn.addEventListener("click", function (e) { e.stopPropagation(); set(btn.getAttribute("aria-expanded") !== "true"); });
    el.addEventListener("click", function (e) { e.stopPropagation(); });
  }
  panel($("[data-mega]"), $(".mega"));
  document.addEventListener("click", function () { panels.forEach(function (p) { p.set(false); }); });

  /* ---- the menu sheet (narrow screens) ---- */
  var sheet = $(".sheet"), lastFocus = null;
  function sheetSet(on) {
    if (!sheet) return;
    sheet.classList.toggle("is-open", on);
    sheet.setAttribute("aria-hidden", String(!on));
    html.style.overflow = on ? "hidden" : "";
    $$("body > :not(.sheet):not(script)").forEach(function (n) { n.inert = on; });
    if (on) { lastFocus = document.activeElement; setTimeout(function () { var c = $(".sheet [data-close]"); if (c) c.focus(); }, 60); }
    else if (lastFocus) lastFocus.focus();
  }
  $$("[data-menu]").forEach(function (b) { b.addEventListener("click", function () { sheetSet(true); }); });
  if (sheet) $$("[data-close], .sheet__nav a", sheet).forEach(function (b) { b.addEventListener("click", function () { sheetSet(false); }); });

  /* ---- the phone's action bar: after the first screen, out of the way of the footer's own links ---- */
  var dock = $(".dock"), foot = $(".site-foot");
  if (dock) {
    var dockOn = function () {
      var past = scrollY > innerHeight * 0.4;
      var nearFoot = foot && foot.getBoundingClientRect().top < innerHeight - 40;
      dock.classList.toggle("is-on", past && !nearFoot);
    };
    addEventListener("scroll", dockOn, { passive: true }); dockOn();
  }

  /* ---- the finder ---- */
  var finder = $(".finder"), fin = finder && $("input", finder), fout = finder && $(".finder__out", finder), sel = -1, hits = [];
  /* what a word matches: every token must start a word of the target (Turkish-folded) */
  function score(q, text) {
    var t = " " + fold(text) + " ", s = 0;
    for (var i = 0; i < q.length; i++) {
      var k = t.indexOf(" " + q[i]);
      if (k < 0) { k = t.indexOf(q[i]); if (k < 0) return 0; s += 1; } else s += 3;
    }
    return s;
  }
  function mark(text, q) {
    var f = fold(text), out = "", i = 0;
    var spans = [];
    q.forEach(function (w) { var k = f.indexOf(w); if (k >= 0) spans.push([k, k + w.length]); });
    spans.sort(function (a, b) { return a[0] - b[0]; });
    spans.forEach(function (sp) { if (sp[0] < i) return; out += esc(text.slice(i, sp[0])) + "<mark>" + esc(text.slice(sp[0], sp[1])) + "</mark>"; i = sp[1]; });
    return out + esc(text.slice(i));
  }
  var STOP = {};
  ["ve", "ile", "bir", "cok", "var", "benim", "bende", "icin", "i", "im", "my", "a", "an", "the", "in", "on", "of", "and", "with", "at", "is", "am", "have", "has", "got", "for", "me",
   "في", "من", "على", "و", "عند", "عندي", "لدي", "مع", "أشعر", "انا", "لي"].forEach(function (w) { STOP[fold(w)] = 1; });
  var RED = /(gogus agri|nefes al|nefes darl|bilinc|bayil|felc|inme|kalp kriz|siddetli kanama|zehirlen|intihar|kaza)/;
  function search(raw) {
    /* the little words of a sentence ("my", "in", "ve", "في") say nothing about where to go */
    var q = fold(raw).split(/\s+/).filter(function (w) { return w && !STOP[w]; });
    var groups = [];
    if (!q.length) {
      groups.push({ t: T("Sık arananlar"), items: (D.popularDepts || []).map(function (d) { return { href: d.href, html: true, pic: icon(d.icon), title: esc(d.title), sub: esc(d.sub) }; }) });
      return groups;
    }
    var signs = [];
    (D.signs || []).forEach(function (s) {
      var best = 0, word = "";
      s.words.forEach(function (w) { var sc = score(q, w); if (sc > best) { best = sc; word = w; } });
      if (best) signs.push({ s: best + 1, html: true, href: s.href, pic: icon(s.icon), title: mark(word.charAt(0).toLocaleUpperCase("tr") + word.slice(1), q), sub: T("İlgili bölüm: {d}", { d: esc(s.dept) }) });
    });
    var depts = [], docs = [], pages = [];
    /* a complaint names a department: its doctors come with it ("diz ağrısı" → the orthopaedists) */
    var near = {};
    signs.forEach(function (s) { (D.signs || []).forEach(function (g) { if (g.href === s.href) near[g.slug] = true; }); });
    D.depts.forEach(function (d) { var s = score(q, d.name + " " + (d.alias || "")); if (s) depts.push({ s: s + 2, href: d.href, pic: icon(d.icon), title: mark(d.name, q), sub: d.count ? T("{n} hekim", { n: d.count }) : T("Tıbbi birim"), html: true }); });
    D.docs.forEach(function (d) { var s = score(q, d.name + " " + d.title + " " + d.dept) || (near[d.deptSlug] ? 1 : 0); if (s) docs.push({ s: s, href: d.href, pic: d.thumb ? '<img src="' + esc(abs(d.thumb)) + '" alt="" loading="lazy">' : icon("i-doctor"), title: mark(d.title + " " + d.name, q), sub: esc(d.dept), html: true }); });
    D.pages.forEach(function (p) { var s = score(q, p.title + " " + (p.words || "")); if (s) pages.push({ s: s, href: p.href, pic: icon(p.icon || "i-book"), title: mark(p.title, q), sub: esc(p.sub || ""), html: true }); });
    var by = function (a, b) { return b.s - a.s; };
    if (signs.length) groups.push({ t: T("Şikâyetinize göre"), items: signs.sort(by).slice(0, 4) });
    if (depts.length) groups.push({ t: T("Bölümler"), items: depts.sort(by).slice(0, 5) });
    if (docs.length) groups.push({ t: T("Doktorlar"), items: docs.sort(by).slice(0, 6) });
    if (pages.length) groups.push({ t: T("Sayfalar"), items: pages.sort(by).slice(0, 5) });
    var said = q.join(" ");
    groups.red = RED.test(said) || (D.red || []).some(function (w) { return said.indexOf(fold(w)) >= 0; });
    return groups;
  }
  function draw(raw) {
    var groups = search(raw);
    hits = [];
    var h = groups.red ? '<p class="finder__note" role="alert">' + T("<b>Acil bir durum mu?</b> Göğüs ağrısı, nefes darlığı, bilinç kaybı gibi belirtilerde hemen <a href=\"tel:112\"><b>112</b></a>'yi arayın ya da 7/24 açık Acil Servisimize gelin.") + "</p>" : "";
    groups.forEach(function (g) {
      h += '<p class="finder__group">' + esc(g.t) + "</p>";
      g.items.forEach(function (it) {
        var n = hits.length; hits.push(it);
        h += '<a class="hit" role="option" id="hit-' + n + '" href="' + esc(abs(it.href)) + '"><span class="hit__pic">' + it.pic + '</span><span class="hit__t"><b>' + it.title + "</b><small>" + it.sub + "</small></span>" + icon("i-arrow", "hit__go") + "</a>";
      });
    });
    if (!hits.length) h += '<div class="finder__empty">' + T("Sonuç bulunamadı. Bölüm adı, doktor adı ya da bir şikâyet yazmayı deneyin — örneğin <b>diz ağrısı</b>.") + "</div>";
    fout.innerHTML = h;
    sel = hits.length ? 0 : -1; select();
  }
  function select() {
    $$(".hit", fout).forEach(function (a, i) { a.setAttribute("aria-selected", String(i === sel)); });
    if (sel >= 0) { var a = $("#hit-" + sel); fin.setAttribute("aria-activedescendant", "hit-" + sel); if (a) a.scrollIntoView({ block: "nearest" }); }
    else fin.removeAttribute("aria-activedescendant");
  }
  var finderLast = null;
  function finderSet(on, value) {
    if (!finder) return;
    finder.classList.toggle("is-open", on);
    finder.setAttribute("aria-hidden", String(!on));
    html.style.overflow = on ? "hidden" : "";
    if (on) {
      finderLast = document.activeElement;
      fin.value = value || ""; draw(fin.value);
      setTimeout(function () { fin.focus(); fin.setSelectionRange(fin.value.length, fin.value.length); }, 40);
    } else if (finderLast && finderLast.focus) finderLast.focus();
  }
  if (finder) {
    fin.addEventListener("input", function () { draw(fin.value); });
    fin.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); if (hits.length) { sel = (sel + 1) % hits.length; select(); } }
      else if (e.key === "ArrowUp") { e.preventDefault(); if (hits.length) { sel = (sel - 1 + hits.length) % hits.length; select(); } }
      else if (e.key === "Enter") { e.preventDefault(); if (sel >= 0) location.href = abs(hits[sel].href); }
    });
    finder.addEventListener("click", function (e) { if (e.target === finder) finderSet(false); });
    $$("[data-finder-close]", finder).forEach(function (b) { b.addEventListener("click", function () { finderSet(false); }); });
    $$("[data-finder]").forEach(function (b) { b.addEventListener("click", function (e) { e.preventDefault(); finderSet(true, b.dataset.q || ""); }); });
    /* the hero's question opens the finder with what has been typed so far */
    $$("[data-ask]").forEach(function (inp) {
      var open = function () { finderSet(true, inp.value); inp.value = ""; };
      inp.addEventListener("input", function () { if (inp.value.trim()) open(); });
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); open(); } });
      var form = inp.closest("form"); if (form) form.addEventListener("submit", function (e) { e.preventDefault(); open(); });
    });
    addEventListener("keydown", function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || "") || (e.target && e.target.isContentEditable);
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); finderSet(!finder.classList.contains("is-open")); }
      else if (e.key === "/" && !typing) { e.preventDefault(); finderSet(true); }
      else if (e.key === "Escape") {
        if (finder.classList.contains("is-open")) finderSet(false);
        else if (sheet && sheet.classList.contains("is-open")) sheetSet(false);
        else panels.forEach(function (p) { p.set(false); });
      }
    });
  }

  /* ---- say it instead of typing it ---- */
  var Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (Rec && finder) {
    var listening = null;
    var listen = function (btn) {
      if (listening) { listening.stop(); return; }
      if (!finder.classList.contains("is-open")) finderSet(true, "");
      var r = new Rec(); r.lang = { en: "en-GB", ar: "ar-SA" }[html.lang] || "tr-TR"; r.interimResults = true; r.maxAlternatives = 1;
      listening = r; $$("[data-voice]").forEach(function (x) { x.classList.add("is-on"); });
      var was = fin.placeholder; fin.placeholder = T("Dinliyorum… şikâyetinizi söyleyin");
      r.onresult = function (e) { var t = ""; for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; fin.value = t; draw(t); };
      r.onend = r.onerror = function () { listening = null; fin.placeholder = was; $$("[data-voice]").forEach(function (x) { x.classList.remove("is-on"); }); fin.focus(); };
      try { r.start(); } catch (err) { r.onend(); }
    };
    $$("[data-voice]").forEach(function (b) { b.hidden = false; b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); listen(b); }); });
  }

  /* ---- "is my insurer contracted?" ---- */
  $$("[data-insurer]").forEach(function (box) {
    var inp = $("input", box), out = $(".ins__out", box), list = D.insurers || [];
    var run = function () {
      var q = fold(inp.value).trim();
      if (!q) { out.innerHTML = ""; return; }
      var found = list.filter(function (n) { return fold(n).indexOf(q) >= 0; }).slice(0, 4);
      out.innerHTML = found.length
        ? found.map(function (n) { return '<div class="ins__res">' + icon("i-check") + "<span>" + esc(n) + "<small>" + T("Anlaşmalı kurumlarımız arasında") + "</small></span></div>"; }).join("")
        : '<div class="ins__res ins__res--no">' + icon("i-close") + "<span>" + T("Listede bulunamadı") + "<small>" + T("Kurumunuz için çağrı merkezimize danışın: 0342 320 02 02") + "</small></span></div>";
    };
    inp.addEventListener("input", run);
  });

  /* ---- a map that asks first ---- */
  $$("[data-map]").forEach(function (m) {
    var b = $("button", m);
    if (b) b.addEventListener("click", function () {
      var f = document.createElement("iframe");
      f.src = m.dataset.map; f.title = m.dataset.title || "Harita"; f.loading = "lazy"; f.referrerPolicy = "no-referrer-when-downgrade";
      m.innerHTML = ""; m.appendChild(f);
    });
  });

  /* ---- copy (an address, a phone) ---- */
  $$("[data-copy]").forEach(function (b) {
    b.addEventListener("click", function () {
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(b.dataset.copy).then(function () {
        if (window.EMEKtoast) return window.EMEKtoast(b.getAttribute("data-done") || T("Kopyalandı"));
        var old = b.innerHTML; b.textContent = T("Kopyalandı"); setTimeout(function () { b.innerHTML = old; }, 1600);
      });
    });
  });

  /* ---- share a page: the device's own share sheet, or the link copied ---- */
  $$("[data-share]").forEach(function (b) {
    b.addEventListener("click", function () {
      var data = { title: b.dataset.title || document.title, url: location.href.split("#")[0] };
      if (navigator.share) { navigator.share(data).catch(function () {}); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(data.url).then(function () { if (window.EMEKtoast) window.EMEKtoast(T("Bağlantı kopyalandı")); });
    });
  });

  /* ---- the lists that narrow as you type (departments, doctors, insurers), and the doctors' department chips ---- */
  var lists = {};
  function narrow(sel) {
    var L = lists[sel]; if (!L) return;
    var q = fold(L.input ? L.input.value : "").trim().split(/\s+/).filter(Boolean), shown = 0;
    L.items.forEach(function (c) {
      var name = " " + (c.dataset.name || fold(c.textContent));
      var hit = q.every(function (w) { return name.indexOf(" " + w) >= 0 || name.indexOf(w) >= 0; }) && (!L.dept || L.dept === "all" || c.dataset.dept === L.dept);
      c.hidden = !hit; if (hit) shown++;
    });
    if (L.count) L.count.textContent = shown + " " + L.unit;
    if (L.empty) L.empty.hidden = shown > 0;
  }
  function list(sel) {
    if (lists[sel]) return lists[sel];
    var box = $(sel); if (!box) return null;
    var count = $('[data-count="' + sel + '"]');
    return (lists[sel] = { items: [].slice.call(box.children), count: count, unit: count ? count.textContent.replace(/^\d+\s*/, "") : "", empty: $('[data-empty="' + sel + '"]') });
  }
  $$("[data-filter]").forEach(function (inp) {
    var L = list(inp.dataset.filter); if (!L) return;
    L.input = inp;
    inp.addEventListener("input", function () { narrow(inp.dataset.filter); });
    var q = new URLSearchParams(location.search).get("q");
    if (q) { inp.value = q; narrow(inp.dataset.filter); }
  });
  $$("[data-docfilter]").forEach(function (bar) {
    var sel = "#" + bar.dataset.docfilter, L = list(sel); if (!L) return;
    $$("button", bar).forEach(function (b) {
      b.addEventListener("click", function () {
        $$("button", bar).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        L.dept = b.dataset.f; narrow(sel);
      });
    });
  });
  $$("[data-docpick]").forEach(function (pick) {
    var sel = "#" + pick.dataset.docpick, L = list(sel); if (!L) return;
    function on() { L.dept = pick.value; pick.closest(".dmenu").classList.toggle("is-on", pick.value !== "all"); narrow(sel); }
    pick.addEventListener("change", on);
    if (pick.value !== "all") on();          // a value the browser kept from before (back button)
  });

  /* ---- a menu of choices in the site's own look (the browser's list opened upward, long and grey):
     the <select> stays the truth (and works without this); a button shows its value, a list opens
     beneath it, short and scrolling, and the page behind it softens out of focus ---- */
  var veil = null;
  $$(".dmenu select").forEach(function (sel, n) {
    var box = sel.closest(".dmenu"), opts = [].slice.call(sel.options);
    var id = sel.id || "pick" + n;
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "dmenu__btn";
    btn.setAttribute("aria-haspopup", "listbox"); btn.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-controls", id + "-list");
    var lab = $('label[for="' + sel.id + '"]');
    if (lab) btn.setAttribute("aria-label", lab.textContent.trim());
    btn.innerHTML = '<span class="dmenu__val"></span>' + icon("i-chev", "chev");
    var ul = document.createElement("ul");
    ul.className = "dmenu__list"; ul.id = id + "-list"; ul.setAttribute("role", "listbox"); ul.tabIndex = -1;
    if (lab) ul.setAttribute("aria-label", lab.textContent.trim());
    ul.innerHTML = opts.map(function (o, i) {
      var c = o.getAttribute("data-n");
      return '<li role="option" id="' + id + "-o" + i + '" data-i="' + i + '"><span>' + esc(o.textContent) + "</span>" +
        (c ? "<small>" + esc(T("{n} hekim", { n: c })) + "</small>" : "") + icon("i-check", "dmenu__tick") + "</li>";
    }).join("");
    var items = $$("li", ul), at = -1;
    sel.tabIndex = -1; sel.setAttribute("aria-hidden", "true");
    box.classList.add("is-pretty");
    box.appendChild(btn); box.appendChild(ul);

    function paint() {
      $(".dmenu__val", btn).textContent = opts[sel.selectedIndex].textContent;
      items.forEach(function (li, i) { li.setAttribute("aria-selected", String(i === sel.selectedIndex)); });
    }
    function active(i, scroll) {
      at = Math.max(0, Math.min(items.length - 1, i));
      items.forEach(function (li, k) { li.classList.toggle("is-active", k === at); });
      ul.setAttribute("aria-activedescendant", items[at].id);
      if (scroll) {
        var li = items[at], top = li.offsetTop, bottom = top + li.offsetHeight;
        if (top < ul.scrollTop + 6) ul.scrollTop = top - 6;
        else if (bottom > ul.scrollTop + ul.clientHeight - 6) ul.scrollTop = bottom - ul.clientHeight + 6;
      }
    }
    function open() {
      if (box.classList.contains("is-open")) return;
      if (!veil) { veil = document.createElement("div"); veil.className = "dmenu__veil"; veil.setAttribute("aria-hidden", "true"); document.body.appendChild(veil);
        veil.addEventListener("wheel", function (e) { e.preventDefault(); }, { passive: false });
        veil.addEventListener("touchmove", function (e) { e.preventDefault(); }, { passive: false }); }
      box.classList.add("is-open"); btn.setAttribute("aria-expanded", "true");
      html.classList.add("is-held"); veil.classList.add("is-on");
      active(sel.selectedIndex, false);
      var li = items[sel.selectedIndex];
      ul.scrollTop = Math.max(0, li.offsetTop - ul.clientHeight / 2 + li.offsetHeight / 2);
      ul.focus({ preventScroll: true });
    }
    function close(back) {
      if (!box.classList.contains("is-open")) return;
      box.classList.remove("is-open"); btn.setAttribute("aria-expanded", "false");
      html.classList.remove("is-held"); if (veil) veil.classList.remove("is-on");
      if (back) btn.focus({ preventScroll: true });
    }
    function choose(i) {
      if (i !== sel.selectedIndex) { sel.selectedIndex = i; sel.dispatchEvent(new Event("change", { bubbles: true })); }
      paint(); close(true);
    }
    btn.addEventListener("click", function (e) { e.stopPropagation(); if (box.classList.contains("is-open")) close(true); else open(); });
    btn.addEventListener("keydown", function (e) { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); open(); } });
    ul.addEventListener("click", function (e) { e.stopPropagation(); var li = e.target.closest("li"); if (li) choose(+li.dataset.i); });
    ul.addEventListener("mousemove", function (e) { var li = e.target.closest("li"); if (li && +li.dataset.i !== at) active(+li.dataset.i, false); });
    var typed = "", typedAt = 0;
    ul.addEventListener("keydown", function (e) {
      var k = e.key;
      if (k === "ArrowDown") { e.preventDefault(); active(at + 1, true); }
      else if (k === "ArrowUp") { e.preventDefault(); active(at - 1, true); }
      else if (k === "Home") { e.preventDefault(); active(0, true); }
      else if (k === "End") { e.preventDefault(); active(items.length - 1, true); }
      else if (k === "PageDown") { e.preventDefault(); active(at + 6, true); }
      else if (k === "PageUp") { e.preventDefault(); active(at - 6, true); }
      else if (k === "Enter" || k === " ") { e.preventDefault(); choose(at); }
      else if (k === "Escape") { e.preventDefault(); close(true); }
      else if (k === "Tab") close(false);
      else if (k.length === 1 && /\S/.test(k)) {            /* type the first letters of a department */
        var now = Date.now(); typed = (now - typedAt > 700 ? "" : typed) + fold(k); typedAt = now;
        for (var j = 0; j < opts.length; j++) { if (fold(opts[j].textContent).indexOf(typed) === 0) { active(j, true); break; } }
      }
    });
    document.addEventListener("click", function () { close(false); });
    addEventListener("resize", function () { close(false); });
    sel.addEventListener("change", paint);
    paint();
  });

  /* ---- a long page's contents: the heading on screen is marked ---- */
  var toc = $$(".toc a");
  if (toc.length && "IntersectionObserver" in window) {
    var heads = toc.map(function (a) { return document.getElementById(decodeURIComponent(a.hash.slice(1))); }).filter(Boolean);
    var tio = new IntersectionObserver(function () {
      var cur = null;
      heads.forEach(function (h) { if (h.getBoundingClientRect().top < innerHeight * 0.35) cur = h; });
      toc.forEach(function (a) { a.classList.toggle("is-here", !!cur && a.hash === "#" + cur.id); });
    }, { rootMargin: "0px 0px -60% 0px", threshold: [0, 1] });
    heads.forEach(function (h) { tio.observe(h); });
  }

  /* ---- blocks rise once ---- */
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var rise = $$("[data-rise]");
  if (!reduced && "IntersectionObserver" in window && rise.length) {
    html.classList.add("rv");
    rise.forEach(function (g) { $$(":scope > *", g).forEach(function (el, i) { el.classList.add("rise"); el.style.setProperty("--i", Math.min(i, 8)); }); });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        $$(".rise", e.target).forEach(function (el, i) {
          el.classList.add("is-in");
          /* the reveal is over: hand the block back (its own hover moves it again) */
          setTimeout(function () { el.classList.remove("rise", "is-in"); el.style.removeProperty("--i"); }, 1450 + Math.min(i, 8) * 80);
        });
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.01 });
    rise.forEach(function (g) { io.observe(g); });
  }
})();
