/* ==========================================================================
   The hospital's forms: feedback, contact, the quality surveys, the
   incident reports. On the hospital's own host the answers go straight to
   the management panel (/api/form) and the visitor gets a reference number;
   where there is no server (the preview) — or the sending fails — they
   become an e-mail to the hospital, already written, in the visitor's own
   mail app, and can be copied instead. Nothing leaves the page before the
   visitor sends it. The panel gets the questions in Turkish whatever the
   page's language (data-l), so one survey's answers stay one table.
   ========================================================================== */
(function () {
  "use strict";
  var S = (window.EMEK || {}).site || {};
  var BASE = document.documentElement.getAttribute("data-base") || "/";
  var API = S.api ? BASE + S.api : null, T0 = Date.now();
  /* the words this script says, in the page's language (js/data.<lang>.js; the Turkish is the key) */
  var I18N = (window.EMEK && window.EMEK.i18n) || {};
  var T = function (s, v) { var t = I18N[s] || s; if (v) Object.keys(v).forEach(function (k) { t = t.split("{" + k + "}").join(v[k]); }); return t; };
  var newKey = function () { var a = new Uint8Array(16); (window.crypto || window.msCrypto).getRandomValues(a); return [].map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); };
  [].forEach.call(document.querySelectorAll("[data-mailform]"), function (form) {
    var done = form.querySelector(".formdone"), sentBox = form.querySelector("[data-formsent]"), btn = form.querySelector("button[type=submit]");
    var idem = newKey(), sending = false;
    /* a question: a field, a set of choices, the consent box */
    var groups = function () { return [].slice.call(form.querySelectorAll(".field, fieldset, .check")).filter(function (g) { return !g.closest(".hp"); }); };
    function value(g) {
      if (g.tagName === "FIELDSET") { var c = g.querySelector("input:checked"); return c ? c.value : ""; }
      var el = g.querySelector("input, select, textarea");
      if (!el) return "";
      return el.type === "checkbox" ? (el.checked ? "Evet" : "") : el.value.trim();
    }
    function label(g) { var l = g.querySelector("legend, span"); return l ? l.textContent.replace(/\*\s*$/, "").trim() : ""; }
    function required(g) { return g.hasAttribute("data-required") || !!g.querySelector("[required]"); }
    function check(g) {
      var v = value(g), el = g.querySelector("input, select, textarea"), msg = "";
      if (required(g) && !v) msg = g.classList.contains("check") ? T("Devam etmek için onaylayın") : g.tagName === "FIELDSET" ? T("Lütfen bir seçenek işaretleyin") : T("Lütfen bu alanı doldurun");
      else if (el && el.type === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) msg = T("Geçerli bir e-posta adresi yazın");
      else if (el && el.type === "tel" && v && v.replace(/\D/g, "").length < 10) msg = T("Geçerli bir telefon numarası yazın");
      g.classList.toggle("is-bad", !!msg);
      var em = g.querySelector("em"); if (em) em.textContent = msg;
      return !msg;
    }
    function text() {
      var out = [form.dataset.subject, ""];
      groups().forEach(function (g) { if (!g.classList.contains("check")) out.push(label(g) + ": " + (value(g) || "—")); });
      return out.join("\n");
    }
    function fields() {
      return groups().filter(function (g) { return !g.classList.contains("check"); }).map(function (g) {
        var el = g.querySelector("input, select, textarea");
        return { label: g.getAttribute("data-l") || label(g), value: value(g), type: el && el.type === "email" ? "email" : el && el.type === "tel" ? "tel" : "" };
      });
    }
    function mail() {
      location.href = "mailto:" + (S.email || "") + "?subject=" + encodeURIComponent(form.dataset.subject) + "&body=" + encodeURIComponent(text());
      if (done) { done.hidden = false; setTimeout(function () { done.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, 60); }
    }
    function busy(on) {
      sending = on;
      if (!btn) return;
      btn.disabled = on;
      btn.classList.toggle("is-busy", on);
    }
    function send() {
      busy(true);
      var hp = form.querySelector('[name="website"]');
      var body = { form: form.dataset.form || form.dataset.subject, fields: fields(), consent: true, lang: document.documentElement.lang || "tr",
        idem: idem, t: Date.now() - T0, website: hp ? hp.value : "" };
      fetch(API + "form", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) })
        .then(function (res) { return res.json(); })
        .then(function (j) {
          busy(false);
          if (!j.ok) throw new Error();
          var ref = sentBox && sentBox.querySelector("[data-ref]"); if (ref) ref.textContent = j.ref;
          [].forEach.call(form.children, function (c) { if (c !== sentBox) c.hidden = true; });
          if (sentBox) { sentBox.hidden = false; sentBox.scrollIntoView({ block: "center", behavior: "smooth" }); sentBox.focus({ preventScroll: true }); }
        })
        .catch(function () {
          busy(false);
          var er = form.querySelector("[data-formerr]");
          if (er) er.hidden = false;
          mail();
        });
    }
    form.addEventListener("input", function (e) { var g = e.target.closest(".field, fieldset, .check"); if (g && g.classList.contains("is-bad")) check(g); });
    form.addEventListener("change", function (e) { var g = e.target.closest("fieldset, .check"); if (g && g.classList.contains("is-bad")) check(g); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (sending) return;
      var bad = groups().filter(function (g) { return !check(g); });
      if (bad.length) {
        var f = bad[0].querySelector("input, select, textarea");
        bad[0].scrollIntoView({ block: "center", behavior: "smooth" });
        if (f) f.focus({ preventScroll: true });
        return;
      }
      if (API && form.dataset.form) send(); else mail();
    });
    var copy = form.querySelector("[data-formcopy]");
    if (copy) copy.addEventListener("click", function () {
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(text()).then(function () { var o = copy.innerHTML; copy.textContent = T("Kopyalandı"); setTimeout(function () { copy.innerHTML = o; }, 1600); });
    });
  });
})();
