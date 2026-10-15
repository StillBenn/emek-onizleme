/* ==========================================================================
   The appointment: department → doctor → day and time → you → the request
   --------------------------------------------------------------------------
   One step on screen at a time; the stage glides to each step's height,
   forward slides in from the right, back from the left. The stepper and the
   ticket beside it ("Değiştir") jump to any step already reached. A
   department or a doctor page links here already chosen (?bolum=…,
   ?doktor=…); the choices (never the name or the phone) survive a reload in
   the tab. The first step understands complaints as well as department
   names ("diz ağrısı" → Ortopedi). The site has no booking server of its
   own: the last step hands the request to the hospital's real channels —
   the call centre (the ticket to read out), an e-mail already written, the
   e-Randevu system. Nothing typed here leaves the page unless the patient
   sends it.
   ========================================================================== */
(function () {
  "use strict";
  var D = window.EMEK || {}, S = D.site || {};
  var root = document.querySelector("[data-appt]");
  if (!root) return;
  var html = document.documentElement;
  var $ = function (s, r) { return (r || root).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || root).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var BASE = html.getAttribute("data-base") || "/";
  /* the words this script says, in the page's language (js/data.<lang>.js; the Turkish is the key) */
  var I18N = (window.EMEK && window.EMEK.i18n) || {};
  var T = function (s, v) { var t = I18N[s] || s; if (v) Object.keys(v).forEach(function (k) { t = t.split("{" + k + "}").join(v[k]); }); return t; };
  var icon = function (id, cls) { return '<svg class="icon ' + (cls || "") + '" aria-hidden="true"><use href="' + BASE + 'img/icons.svg#' + id + '"/></svg>'; };
  var fold = function (s) {
    return String(s || "").replace(/İ/g, "i").replace(/I/g, "ı").toLocaleLowerCase("tr")
      .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ç/g, "c").replace(/ö/g, "o").replace(/ü/g, "u")
      .replace(/[\u064B-\u0652\u0670\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
      .replace(/(^|\s)ال(?=[\u0621-\u064A]{3})/g, "$1");   /* the article ال: "الركبة" finds "ركبة" */
  };
  var reduced = function () { return html.getAttribute("data-motion") === "reduced" || matchMedia("(prefers-reduced-motion: reduce)").matches; };
  var toast = function (m, i) { if (window.EMEKtoast) window.EMEKtoast(m, i); };
  var EASE = "cubic-bezier(.22,1,.36,1)";
  /* dates in the page's own language, from the browser (Arabic with the digits on the phone's keypad) */
  var LOC = { en: "en-GB", ar: "ar-u-nu-latn" }[html.lang] || "tr-TR";
  var fmt = function (o) { try { return new Intl.DateTimeFormat(LOC, o); } catch (e) { return new Intl.DateTimeFormat("tr-TR", o); } };
  var fLong = fmt({ weekday: "long", day: "numeric", month: "long" }), fMonth = fmt({ month: "long" }), fMon = fmt({ month: "short" }), fWeek = fmt({ weekday: "short" });
  var monthName = function (d) { return fMonth.format(d); }, monShort = function (d) { return fMon.format(d).replace(".", ""); };
  var WEEK = [0, 1, 2, 3, 4, 5, 6].map(function (i) { return fWeek.format(new Date(2024, 0, 1 + i)).replace(".", ""); });   /* 1 Jan 2024 was a Monday */

  /* the departments one books (the emergency needs no appointment; a unit with no doctor listed cannot be chosen) */
  var depts = (D.depts || []).filter(function (d) { return d.count > 0 && d.slug !== "acil-tip"; });
  var bySlug = function (list, slug) { return list.filter(function (x) { return x.slug === slug; })[0] || null; };

  /* ---- days: keyed as the wall calendar has them (toISOString would give yesterday east of Greenwich) ---- */
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var addDays = function (d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; };
  var keyOf = function (d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); };
  var fromKey = function (k) { var p = k.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); };
  var FIRST = addDays(today, 1), LAST = addDays(today, 21);
  var dayName = function (d) { return fLong.format(d); };

  /* ---- the state ---- */
  var st = { dept: null, doc: null, any: false, day: null, slot: null };
  var KEY = "emek-appt";
  function save() {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ dept: st.dept && st.dept.slug, doc: st.doc && st.doc.slug, any: st.any,
        day: st.day === "earliest" ? "earliest" : st.day ? keyOf(st.day) : null, slot: st.slot }));
    } catch (e) { /* private window */ }
  }
  var q = new URLSearchParams(location.search), restored = false;
  if (q.get("bolum") || q.get("doktor")) {
    st.doc = bySlug(D.docs || [], q.get("doktor"));
    st.dept = bySlug(depts, q.get("bolum")) || (st.doc && bySlug(depts, st.doc.deptSlug));
    if (st.doc && (!st.dept || st.doc.deptSlug !== st.dept.slug)) st.doc = null;
  } else {
    try {
      var s = JSON.parse(sessionStorage.getItem(KEY) || "null");
      if (s && s.dept) {
        st.dept = bySlug(depts, s.dept); st.doc = st.dept ? bySlug(D.docs || [], s.doc) : null; st.any = !!s.any && !st.doc;
        if (s.day === "earliest") st.day = "earliest";
        else if (s.day) { var d = fromKey(s.day); if (d >= FIRST && d <= LAST) st.day = d; }
        st.slot = s.slot || null; restored = !!st.dept;
      }
    } catch (e) { /* nothing kept */ }
  }

  var steps = $$(".step"), view = $(".steps-view"), bar = $("[data-bar]");
  var next = $("[data-next]", bar), back = $("[data-back]", bar), mini = $("[data-mini]", bar);
  var form = $("[data-who]");
  var at = 0, reach = 0;

  /* ---- the form: rules, the phone written as it is read, the insurer checked ---- */
  var RULES = {
    name: function (v) { return v.trim().length >= 3 || T("Lütfen adınızı ve soyadınızı yazın"); },
    phone: function (v) { var n = v.replace(/\D/g, ""); return (n.length >= 10 && n.length <= 12) || T("Lütfen size ulaşabileceğimiz bir telefon numarası yazın"); },
    consent: function (v, el) { return el.checked || T("Devam etmek için aydınlatma metnini onaylayın"); }
  };
  function check(n, quiet) {
    var el = form.elements[n], r = RULES[n](el.value, el), f = el.closest(".field, .check");
    if (!quiet && f) {
      f.classList.toggle("is-bad", r !== true);
      f.classList.toggle("is-ok", r === true && n !== "consent");
      var em = f.querySelector("em"); if (em) em.textContent = r === true ? "" : r;
    }
    return r === true;
  }
  var formOk = function (quiet) { return ["name", "phone", "consent"].map(function (n) { return check(n, quiet); }).every(Boolean); };
  var phoneFmt = function (v) {
    var d = v.replace(/\D/g, "");
    if (d.indexOf("90") === 0 && d.length > 10) d = d.slice(2);
    if (d && d[0] !== "0") d = "0" + d;
    d = d.slice(0, 11);
    return [d.slice(0, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)].filter(Boolean).join(" ");
  };
  form.elements.phone.addEventListener("input", function () {
    var el = form.elements.phone;
    if (el.selectionStart === el.value.length) el.value = phoneFmt(el.value);
  });
  form.elements.phone.addEventListener("blur", function () { var el = form.elements.phone; if (el.value) el.value = phoneFmt(el.value); });
  Object.keys(RULES).forEach(function (n) {
    var el = form.elements[n];
    el.addEventListener(n === "consent" ? "change" : "input", function () { var f = el.closest(".field, .check"); if (f && (f.classList.contains("is-bad") || f.classList.contains("is-ok"))) check(n); render(); });
    if (n !== "consent") el.addEventListener("blur", function () { if (el.value.trim()) check(n); });
  });
  var PRIVATE = T("Özel sağlık sigortası");
  var insField = $("[data-insfield]"), insState = $("[data-insstate]"), insurers = D.insurers || [], insHit = null;
  function insCheck() {
    var v = fold(form.elements.insurer.value).trim();
    insHit = null;
    if (!v) { insState.textContent = ""; insState.className = "ins-state"; return; }
    var hit = insurers.filter(function (n) { return fold(n).indexOf(v) >= 0 || v.indexOf(fold(n)) >= 0; })[0];
    insHit = hit || null;
    insState.className = "ins-state " + (hit ? "is-yes" : "is-no");
    insState.textContent = hit ? "✓ " + T("{x} anlaşmalı kurumlarımız arasında", { x: hit }) : T("Listemizde görünmüyor — kapsam için çağrı merkezimize danışın");
  }
  form.elements.insurer.addEventListener("input", function () { insCheck(); render(); });
  form.elements.insurer.addEventListener("blur", function () { if (insHit) { form.elements.insurer.value = insHit; render(); } });
  $$('input[name="pay"]', form).forEach(function (r) {
    r.addEventListener("change", function () {
      var on = form.elements.pay.value === PRIVATE;
      if (on && insField.hidden) { insField.hidden = false; if (!reduced() && insField.animate) insField.animate([{ opacity: 0, transform: "translateY(-6px)" }, { opacity: 1, transform: "none" }], { duration: 380, easing: EASE }); }
      if (!on) insField.hidden = true;
      render();
    });
  });
  var note = form.elements.note, counter = $("[data-counter]");
  note.addEventListener("input", function () { counter.textContent = note.value.length + " / 300"; render(); });
  form.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "checkbox" && e.target.type !== "radio") { e.preventDefault(); next.click(); } });
  form.addEventListener("submit", function (e) { e.preventDefault(); });

  /* ---- 1 · the department (by its name, or by a complaint) ---- */
  var find = $("[data-deptfind]"), deptBox = $("[data-depts]");
  function deptMatches() {
    var v = fold(find.value).trim();
    if (!v) return depts.map(function (d) { return { d: d }; });
    var out = [], has = function (d) { return out.some(function (o) { return o.d === d; }); };
    depts.forEach(function (d) { var t = " " + fold(d.name + " " + (d.alias || "")); if (t.indexOf(" " + v) >= 0 || t.indexOf(v) >= 0) out.push({ d: d }); });
    (D.signs || []).forEach(function (s) {
      s.words.forEach(function (w) {
        var fw = fold(w);
        if (fw.indexOf(v) === 0 || (v.length > 2 && fw.indexOf(v) >= 0) || (fw.length > 3 && v.indexOf(fw) >= 0)) {
          var d = bySlug(depts, s.slug);
          if (d && !has(d)) out.push({ d: d, why: w });
        }
      });
    });
    return out;
  }
  function drawDepts() {
    var list = deptMatches();
    deptBox.innerHTML = list.map(function (o) {
      var d = o.d, faces = (d.faces || []).slice(0, 3).map(function (f) { return '<img src="' + esc(BASE + f) + '" alt="" width="240" height="276">'; }).join("");
      return '<button class="opt opt--dept" type="button" data-dept="' + d.slug + '" aria-pressed="' + (st.dept === d) + '"><span class="di">' + icon(d.icon) + '</span><span class="opt__t"><b>' + esc(d.name) +
        '</b><small><span class="opt__faces">' + faces + "</span>" + (o.why ? T("“{w}” için önerilen", { w: esc(o.why) }) : T("{n} hekim", { n: d.count })) + "</small></span></button>";
    }).join("") || '<p class="pick__empty">' + T("“{q}” ile eşleşen bir bölüm bulamadık. Başka bir kelime deneyin ya da <a href=\"tel:+903423200202\">çağrı merkezimizi arayın</a>.", { q: esc(find.value) }) + "</p>";
  }
  find.addEventListener("input", drawDepts);
  find.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); var b = $("[data-dept]", deptBox); if (b) b.click(); } });
  deptBox.addEventListener("click", function (e) {
    var b = e.target.closest("[data-dept]"); if (!b) return;
    var d = bySlug(depts, b.dataset.dept);
    if (st.dept !== d) { st.doc = null; st.any = false; }
    st.dept = d; drawDepts(); drawDocs(); picked($('[data-dept="' + d.slug + '"]', deptBox));
    render(); save();
    setTimeout(function () { go(1); }, reduced() ? 0 : 320);
  });

  /* ---- 2 · the doctor (or whoever is free first) ---- */
  var docBox = $("[data-docs]");
  function drawDocs() {
    var list = st.dept ? (D.docs || []).filter(function (d) { return d.deptSlug === st.dept.slug; }) : [];
    docBox.innerHTML = list.map(function (d) {
      return '<button class="pcard" type="button" data-doc="' + d.slug + '" aria-pressed="' + (st.doc === d) + '"><span class="pcard__pic">' +
        (d.pic ? '<img src="' + esc(BASE + d.pic) + '" alt="" width="800" height="920" loading="lazy">' : icon("i-doctor")) +
        '</span><span class="pcard__t"><small>' + esc(d.title) + "</small><b>" + esc(d.name) + "</b></span></button>";
    }).join("") + '<button class="pcard pcard--any" type="button" data-doc="" aria-pressed="' + (!!st.any) + '"><span class="pcard__pic">' + icon("i-users") +
      '</span><span class="pcard__t"><small>' + T("İlk uygun hekim") + "</small><b>" + T("Fark etmez") + "</b></span></button>";
    $("[data-docnote]").hidden = list.length > 0;
  }
  docBox.addEventListener("click", function (e) {
    var b = e.target.closest("[data-doc]"); if (!b) return;
    st.doc = bySlug(D.docs || [], b.dataset.doc); st.any = !st.doc;
    drawDocs(); picked($('[data-doc="' + b.dataset.doc + '"]', docBox));
    render(); save();
    setTimeout(function () { go(2); }, reduced() ? 0 : 320);
  });

  /* ---- 3 · a day in the next three weeks, and a part of it ---- */
  var cal = $("[data-cal]"), soon = $("[data-earliest]");
  function drawCal() {
    var start = addDays(today, -((today.getDay() + 6) % 7)), end = addDays(LAST, (7 - LAST.getDay()) % 7);
    var m1 = monthName(FIRST), m2 = monthName(LAST);
    var title = (m1 === m2 ? m1 : m1 + " – " + m2) + " " + LAST.getFullYear();
    var cells = "";
    for (var d = new Date(start); d <= end; d = addDays(d, 1)) {
      var off = d < FIRST || d > LAST, sel = st.day instanceof Date && keyOf(st.day) === keyOf(d), isToday = keyOf(d) === keyOf(today);
      var cls = "cal__d" + (off ? " is-off" : "") + (isToday ? " is-today" : "") + (d.getDay() === 0 || d.getDay() === 6 ? " is-we" : "");
      cells += '<button class="' + cls + '" type="button" data-day="' + keyOf(d) + '"' + (off ? " disabled" : "") + ' aria-pressed="' + sel + '" aria-label="' + dayName(d) + (isToday ? " (" + T("bugün") + ")" : "") + '">' +
        (d.getDate() === 1 ? '<small class="cal__m">' + monShort(d) + "</small>" : "") + "<b>" + d.getDate() + "</b>" + (isToday ? "<small>" + T("Bugün") + "</small>" : "") + "</button>";
    }
    cal.innerHTML = '<div class="cal__head"><b>' + title + '</b><span>' + T("Yarından itibaren üç hafta") + '</span></div><div class="cal__week" aria-hidden="true">' +
      WEEK.map(function (w) { return "<span>" + w + "</span>"; }).join("") + '</div><div class="cal__grid" role="group" aria-label="Gün">' + cells + "</div>";
    soon.setAttribute("aria-pressed", String(st.day === "earliest"));
  }
  cal.addEventListener("click", function (e) {
    var b = e.target.closest("[data-day]"); if (!b || b.disabled) return;
    st.day = fromKey(b.dataset.day); drawCal(); picked($('[data-day="' + b.dataset.day + '"]', cal)); render(); save();
  });
  soon.addEventListener("click", function () { st.day = st.day === "earliest" ? null : "earliest"; drawCal(); if (st.day) picked(soon); render(); save(); });
  $$("[data-slot]").forEach(function (b) {
    b.addEventListener("click", function () {
      st.slot = b.dataset.slot;
      $$("[data-slot]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      picked(b); render(); save();
    });
  });

  /* a choice answers: a ring that opens out of what was picked */
  function picked(el) {
    if (!el || reduced()) return;
    el.classList.remove("is-picked"); void el.offsetWidth; el.classList.add("is-picked");
  }

  /* ---- moving between steps ---- */
  function can(n) {
    if (n >= 1 && !st.dept) return false;
    if (n >= 2 && !st.doc && !st.any) return false;
    if (n >= 3 && (!st.day || !st.slot)) return false;
    if (n >= 4 && !formOk(true)) return false;
    return true;
  }
  function go(n, opts) {
    opts = opts || {};
    n = Math.max(0, Math.min(steps.length - 1, n));
    if (!can(n)) return;
    if (n === at && !opts.force) return;
    var dir = (n >= at ? 1 : -1) * (html.dir === "rtl" ? -1 : 1), to = steps[n], h0 = view.offsetHeight;
    steps.forEach(function (s, i) { s.hidden = i !== n; });
    at = n; reach = Math.max(reach, n);
    if (n === 4) finish();
    render(); save();
    if (!opts.instant && !reduced() && view.animate) {
      var h1 = view.offsetHeight;
      view.style.overflow = "hidden";
      view.animate([{ height: h0 + "px" }, { height: h1 + "px" }], { duration: 520, easing: EASE });
      to.animate([{ opacity: 0, transform: "translateX(" + 34 * dir + "px)" }, { opacity: 1, transform: "none" }], { duration: 600, easing: EASE });
      setTimeout(function () { view.style.overflow = ""; }, 560);
    }
    if (opts.instant) return;
    var h = to.querySelector("h2");
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
    var hdr = document.querySelector(".hdr"), top = root.getBoundingClientRect().top - (hdr ? hdr.offsetHeight : 80) - 16;
    if (top < 0) scrollBy({ top: top, behavior: reduced() ? "auto" : "smooth" });
  }
  next.addEventListener("click", function () {
    if (at === 3 && !formOk(false)) { var bad = $(".is-bad input", form); if (bad) bad.focus(); return; }
    go(at + 1);
  });
  back.addEventListener("click", function () { go(at - 1); });
  $$("[data-go]", document).forEach(function (b) { b.addEventListener("click", function () { go(+b.dataset.go); }); });

  /* ---- the request, as the call centre will read it ---- */
  function who() {
    return { name: form.elements.name.value.trim(), phone: form.elements.phone.value.trim(), pay: form.elements.pay.value,
      insurer: form.elements.insurer.value.trim(), first: form.elements.first.value, note: form.elements.note.value.trim() };
  }
  var docText = function () { return st.doc ? st.doc.title + " " + st.doc.name : st.any ? T("Fark etmez (ilk uygun hekim)") : ""; };
  var dayText = function () { return st.day === "earliest" ? T("En erken uygun gün") : st.day ? dayName(st.day) : ""; };
  function text() {
    var w = who();
    return [T("Randevu talebi") + " — " + (S.name || "Emek Hastanesi"), "",
      T("Bölüm") + ": " + (st.dept ? st.dept.name : "—"),
      T("Doktor") + ": " + (docText() || "—"),
      T("Tercih edilen gün") + ": " + (dayText() || "—"),
      T("Zaman") + ": " + (st.slot || "—"), "",
      T("Ad soyad") + ": " + w.name,
      T("Telefon") + ": " + w.phone,
      w.pay ? T("Ödeme") + ": " + w.pay + (w.pay === PRIVATE && w.insurer ? " (" + (insHit || w.insurer) + ")" : "") : "",
      w.first ? T("Hastaneye gelme") + ": " + w.first : "",
      w.note ? T("Not") + ": " + w.note : ""].filter(function (x, i) { return x !== "" || i === 1 || i === 6; }).join("\n");
  }
  function finish() {
    var t = document.querySelector("[data-state]"); if (t) t.textContent = T("Hazır");
    root.classList.add("is-done");
  }

  /* ---- everything on screen follows the state ---- */
  var set = function (k, v, empty) { $$('[data-sum="' + k + '"]').forEach(function (el) { el.textContent = v || empty || "—"; el.classList.toggle("is-empty", !v); }); };
  function render() {
    var w = who();
    set("dept", st.dept && st.dept.name, T("Bölüm seçilmedi")); set("dept2", st.dept && st.dept.name);
    set("doc", docText(), T("Doktor seçilmedi")); set("doc2", st.doc ? st.doc.title + " " + st.doc.name : st.any ? T("Fark etmez") : "");
    set("day", dayText(), T("Gün seçilmedi")); set("day2", dayText() + (dayText() && st.slot ? " · " + st.slot : ""));
    set("slot", st.slot, T("Zaman seçilmedi")); set("name", w.name);
    var pic = $("[data-sumpic]");
    if (pic) {
      var want = st.doc && st.doc.pic ? "doc:" + st.doc.slug : st.dept ? "dept:" + st.dept.slug : "none";
      if (pic.getAttribute("data-v") !== want) {
        pic.setAttribute("data-v", want);
        pic.innerHTML = st.doc && st.doc.pic ? '<img src="' + esc(BASE + (st.doc.thumb || st.doc.pic)) + '" alt="">' : icon(st.dept ? st.dept.icon : "i-calendar");
        pic.classList.toggle("has-img", !!(st.doc && st.doc.pic));
        if (!reduced() && pic.animate) pic.animate([{ transform: "scale(.7)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 460, easing: EASE });
      }
    }
    var num = $("[data-sumnum]");
    if (num) num.innerHTML = st.day instanceof Date ? "<b>" + st.day.getDate() + "</b><small>" + monShort(st.day) + "</small>" : st.day === "earliest" ? icon("i-bolt") : "—";
    var done = [!!st.dept, !!(st.doc || st.any), !!(st.day && st.slot), formOk(true)], n = done.filter(Boolean).length;
    var prog = $("[data-prog]"); if (prog) prog.style.transform = "scaleX(" + (n / 4) + ")";
    var progt = $("[data-progt]"); if (progt) progt.textContent = T("{n} / 4 adım", { n: n });
    $$(".stepper li").forEach(function (li, i) {
      li.classList.toggle("is-now", i === at);
      li.classList.toggle("is-done", i < 4 ? done[i] && i !== at : at === 4);
      var b = li.querySelector("button"); b.disabled = !(i <= reach && can(i)) && i !== at;
      if (i === at) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    });
    $$(".ticket__rows button").forEach(function (b) { b.hidden = +b.dataset.go > reach || +b.dataset.go === at; });
    /* the bar under the step */
    bar.hidden = at === 4;
    back.style.visibility = at === 0 ? "hidden" : "";
    next.querySelector("span").textContent = at === 3 ? T("Talebimi hazırla") : T("Devam");
    next.disabled = at < 3 ? !can(at + 1) : false;
    next.classList.toggle("is-ready", at < 3 && can(at + 1));
    mini.textContent = [st.dept && st.dept.name, st.doc ? st.doc.name : st.any ? T("Fark etmez") : "", st.day instanceof Date ? st.day.getDate() + " " + monShort(st.day) : st.day ? T("En erken") : "", st.slot]
      .filter(Boolean).join(" · ") || T("Bir bölüm seçin");
    var out = $("[data-request]"); if (out) out.textContent = text();
    var mail = $("[data-mail]"); if (mail) mail.href = "mailto:" + (S.email || "") + "?subject=" + encodeURIComponent(T("Randevu talebi") + " — " + (st.dept ? st.dept.name : "")) + "&body=" + encodeURIComponent(text());
  }

  /* ---- the last step's tools ---- */
  var copy = $("[data-copyreq]");
  if (copy) copy.addEventListener("click", function () { if (navigator.clipboard) navigator.clipboard.writeText(text()).then(function () { toast(T("Randevu özeti kopyalandı")); }); });
  var pr = $("[data-print]"); if (pr) pr.addEventListener("click", function () { var d = $(".reqbox"); if (d) d.open = true; print(); });
  var again = $("[data-restart]");
  if (again) again.addEventListener("click", function () {
    st = { dept: null, doc: null, any: false, day: null, slot: null };
    try { sessionStorage.removeItem(KEY); } catch (e) { /* fine */ }
    form.reset(); insField.hidden = true; insCheck(); counter.textContent = "0 / 300"; find.value = "";
    $$(".field, .check", form).forEach(function (f) { f.classList.remove("is-bad", "is-ok"); var em = f.querySelector("em"); if (em) em.textContent = ""; });
    $$("[data-slot]").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
    root.classList.remove("is-done"); var t = document.querySelector("[data-state]"); if (t) t.textContent = T("Hazırlanıyor");
    reach = 0; drawDepts(); drawDocs(); drawCal();
    go(0, { force: true });
  });

  /* ---- start where the choice ends ---- */
  drawDepts(); drawDocs(); drawCal();
  if (st.slot) $$("[data-slot]").forEach(function (x) { x.setAttribute("aria-pressed", String(x.dataset.slot === st.slot)); });
  var start = !st.dept ? 0 : !(st.doc || st.any) ? 1 : !(st.day && st.slot) ? 2 : 3;
  reach = start;
  steps.forEach(function (s, i) { s.hidden = i !== start; }); at = start;
  render();
  if (restored) setTimeout(function () { toast(T("Kaldığınız yerden devam ediyorsunuz"), "i-restart"); }, 500);
})();
