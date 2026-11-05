/* ==========================================================================
   The job application: the hospital's paper form (İş Başvuru Formu), online.
   "Tamamla" sends it to /api/basvuru: the server e-mails it whole to human
   resources and keeps a sealed copy in the panel. The questions and the
   choices always travel in Turkish (data-l, data-v), whatever the page's
   language, so human resources read one form. The portrait is made small
   here, on the patient's own device, which also strips its hidden metadata.
   Nothing is kept in the browser: this form holds sensitive details. Where
   there is no server (the preview) nothing leaves the page.
   ========================================================================== */
(function () {
  "use strict";
  var form = document.querySelector("[data-jobform]");
  if (!form) return;
  var S = (window.EMEK || {}).site || {};
  var BASE = document.documentElement.getAttribute("data-base") || "/";
  var API = S.api ? BASE + S.api : null, T0 = Date.now();
  var I18N = (window.EMEK && window.EMEK.i18n) || {};
  var T = function (s) { return I18N[s] || s; };
  var $$ = function (q, r) { return [].slice.call((r || form).querySelectorAll(q)); };
  var newKey = function () { var a = new Uint8Array(16); (window.crypto || window.msCrypto).getRandomValues(a); return [].map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); };
  var pad = function (n) { return ("0" + n).slice(-2); };
  var idem = newKey(), sending = false, photo = "";
  var btn = form.querySelector("button[type=submit]"), err = form.querySelector("[data-joberr]");
  var sent = document.querySelector("[data-jobsent]");

  /* the application's date is today's */
  var now = new Date(), day = form.querySelector("[data-today]");
  if (day) day.value = pad(now.getDate()) + "." + pad(now.getMonth() + 1) + "." + now.getFullYear();

  /* a question that depends on an answer ("Evli" → the spouse) comes and goes with it */
  var whens = $$("[data-when]");
  function follow() {
    whens.forEach(function (g) {
      var p = g.getAttribute("data-when").split("="), on = !!form.querySelector('input[data-c="' + p[0] + '"][data-v="' + p[1] + '"]:checked');
      g.classList.toggle("is-off", !on);
    });
  }
  form.addEventListener("change", follow);
  follow();

  /* ---- the portrait ---- */
  var box = form.querySelector("[data-photo]");
  if (box) {
    var input = box.querySelector("input"), pic = box.querySelector("img"), drop = form.querySelector("[data-photoclear]"), note = form.querySelector("[data-photoerr]");
    var clear = function () { photo = ""; input.value = ""; pic.removeAttribute("src"); box.classList.remove("has-photo"); if (drop) drop.hidden = true; };
    var bad = function () { clear(); if (note) note.textContent = T("Bu dosya açılamadı; lütfen JPG ya da PNG bir fotoğraf seçin"); };
    input.addEventListener("change", function () {
      var f = input.files && input.files[0];
      if (note) note.textContent = "";
      if (!f) return;
      if (!/^image\//.test(f.type)) { bad(); return; }
      var url = URL.createObjectURL(f), im = new Image();
      im.onload = function () {
        var k = Math.min(1, 900 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement("canvas");
        c.width = Math.round(im.naturalWidth * k);
        c.height = Math.round(im.naturalHeight * k);
        var x = c.getContext("2d");
        x.fillStyle = "#fff";
        x.fillRect(0, 0, c.width, c.height);
        x.drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        photo = c.toDataURL("image/jpeg", 0.86);
        pic.src = photo;
        box.classList.add("has-photo");
        if (drop) drop.hidden = false;
      };
      im.onerror = function () { URL.revokeObjectURL(url); bad(); };
      im.src = url;
    });
    if (drop) drop.addEventListener("click", clear);
  }

  /* ---- what was answered ---- */
  function value(g) {
    if (g.tagName === "FIELDSET") { var c = g.querySelector("input:checked"); return c ? c.getAttribute("data-v") : ""; }
    var el = g.querySelector("input, select, textarea");
    if (!el) return "";
    var v = el.value.trim();
    if (el.type === "date" && v) { var d = v.split("-"); return d[2] + "." + d[1] + "." + d[0]; }
    return v;
  }
  function fields() {
    return $$(".field[data-l], fieldset[data-l]").filter(function (g) { return !g.classList.contains("is-off"); }).map(function (g) {
      var sec = g.closest("[data-sec]"), el = g.querySelector("input, select, textarea");
      return { sec: sec ? sec.getAttribute("data-sec") : "", label: g.getAttribute("data-l"), key: g.getAttribute("data-k") || "", value: value(g),
        type: el && el.type === "email" ? "email" : el && el.type === "tel" ? "tel" : "" };
    }).filter(function (f) { return f.value; });
  }

  /* ---- checks ---- */
  function check(g) {
    if (g.classList.contains("is-off")) return true;
    var el = g.querySelector("input, select, textarea"), msg = "";
    if (g.classList.contains("check")) { if (!el.checked) msg = T("Devam etmek için onaylayın"); }
    else {
      var v = value(g), key = g.getAttribute("data-k");
      if (g.hasAttribute("data-required") && !v) msg = T("Lütfen bu alanı doldurun");
      else if (v && el && el.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) msg = T("Geçerli bir e-posta adresi yazın");
      else if (v && el && el.type === "tel" && v.replace(/\D/g, "").length < 10) msg = T("Geçerli bir telefon numarası yazın");
      else if (v && key === "tc" && v.replace(/\D/g, "").length !== 11) msg = T("T.C. kimlik numarası 11 haneli olmalıdır");
    }
    g.classList.toggle("is-bad", !!msg);
    var em = g.querySelector("em");
    if (em) em.textContent = msg;
    return !msg;
  }
  var checked = function () { return $$(".field[data-required], .field[data-k], .field input[type=tel], .field input[type=email], .check").map(function (n) { return n.closest(".field, .check"); }).filter(function (g, i, a) { return a.indexOf(g) === i; }); };
  form.addEventListener("input", function (e) { var g = e.target.closest(".field, .check"); if (g && g.classList.contains("is-bad")) check(g); });
  form.addEventListener("change", function (e) { var g = e.target.closest(".check"); if (g && g.classList.contains("is-bad")) check(g); });

  /* ---- sending ---- */
  function busy(on) { sending = on; btn.disabled = on; btn.classList.toggle("is-busy", on); }
  function done(ref) {
    form.hidden = true;
    var side = document.querySelector("[data-jobside]");
    if (side) side.hidden = true;
    var r = sent.querySelector("[data-ref]");
    if (r && ref) r.textContent = ref;
    sent.hidden = false;
    sent.focus({ preventScroll: true });
    sent.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (sending) return;
    if (err) err.hidden = true;
    var wrong = checked().filter(function (g) { return !check(g); });
    if (wrong.length) {
      var f = wrong[0].querySelector("input, select, textarea");
      wrong[0].scrollIntoView({ block: "center", behavior: "smooth" });
      if (f) f.focus({ preventScroll: true });
      return;
    }
    if (!API) { done(""); return; }
    busy(true);
    var hp = form.querySelector('[name="website"]');
    fetch(API + "basvuru", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ fields: fields(), photo: photo, consent: true, declare: true, lang: document.documentElement.lang || "tr", idem: idem, t: Date.now() - T0, website: hp ? hp.value : "" }) })
      .then(function (res) { return res.json().then(function (j) { return { status: res.status, j: j }; }); })
      .then(function (a) {
        busy(false);
        if (a.j && a.j.ok) { done(a.j.ref); return; }
        throw new Error("rejected");
      })
      .catch(function () {
        busy(false);
        if (err) { err.hidden = false; err.scrollIntoView({ block: "center", behavior: "smooth" }); }
      });
  });
})();
