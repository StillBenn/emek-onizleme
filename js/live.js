/* ==========================================================================
   What the hospital changes in its panel and wants seen at once — without
   waiting for the site to be rebuilt: announcements, the hours, a doctor
   taken off the site. The page asks /api/canli once (cached for a minute)
   and patches itself; the static page underneath is the baseline (search
   engines, no JavaScript, the preview) and catches up at the next publish.
   ========================================================================== */
(function () {
  "use strict";
  var D = window.EMEK || {}, S = D.site || {};
  if (!S.api || !window.fetch) return;
  var html = document.documentElement, BASE = html.getAttribute("data-base") || "/", LANG = html.lang || "tr";
  var I18N = D.i18n || {};
  var T = function (s) { return I18N[s] || s; };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var icon = function (id) { return '<svg class="icon" aria-hidden="true"><use href="' + BASE + 'img/icons.svg#' + id + '"/></svg>'; };
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* fine */ } } };

  fetch(BASE + S.api + "canli", { credentials: "omit" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (L) {
      if (!L) return;
      try { hours(L.hours || {}); } catch (e) { /* the page stays as built */ }
      try { announcements(L.announcements || []); } catch (e) { /* idem */ }
      try { hidden(L.hidden || []); } catch (e) { /* idem */ }
      D.live = L;
      document.dispatchEvent(new CustomEvent("emek:live", { detail: L }));
    })
    .catch(function () { /* offline or no server: the page as built */ });

  /* ---- hours: the times the page was built with, swapped for today's ---- */
  var range = function (r) { return r && r.from && r.to ? r.from + " – " + r.to : null; };
  function pattern(r) {
    var t = function (x) { return x.replace(/^0/, "0?").replace(":", "[:.]"); };
    return new RegExp("(?<!\\d)" + t(r.from) + "\\s*[–—\\-/]\\s*" + t(r.to), "g");
  }
  function hours(H) {
    var built = D.hours || {}, swaps = [];
    ["visiting", "icu"].forEach(function (k) {
      if (built[k] && H[k] && range(built[k]) !== range(H[k])) swaps.push([pattern(built[k]), range(H[k])]);
    });
    if (swaps.length) {
      var walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
        return /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode.nodeName) || !/\d[:.]\d\d/.test(n.nodeValue) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      } });
      var nodes = [];
      while (walk.nextNode()) nodes.push(walk.currentNode);
      nodes.forEach(function (n) { var v = n.nodeValue; swaps.forEach(function (s) { v = v.replace(s[0], s[1]); }); if (v !== n.nodeValue) n.nodeValue = v; });
    }
    /* the outpatient clinics' hours, when the hospital has given them */
    var op = H.outpatient || {}, days = [["weekdays", T("Hafta içi")], ["saturday", T("Cumartesi")], ["sunday", T("Pazar")]];
    var lines = days.filter(function (d) { return op[d[0]]; }).map(function (d) {
      return "<span class=\"ophours__d\"><span>" + esc(d[1]) + "</span> <b>" + (op[d[0]] === "closed" ? esc(T("Kapalı")) : esc(range(op[d[0]]))) + "</b></span>";
    });
    [].forEach.call(document.querySelectorAll("[data-live-op]"), function (box) {
      var out = box.querySelector("[data-live-op-text]");
      if (!lines.length || !out) return;
      out.innerHTML = lines.join("");
      box.hidden = false;
    });
  }

  /* ---- announcements: the important ones on every page, the rest on the home page ---- */
  function words(a) {
    var own = a.t && a.t[LANG] && a.t[LANG].title ? a.t[LANG] : null, tr = (a.t && a.t.tr) || {};
    return { title: (own || tr).title || "", body: own ? own.body || "" : tr.body || "", dir: own || LANG === "tr" ? "" : ' dir="auto"' };
  }
  function link(a) {
    if (!a.link) return "";
    var href = /^https?:/.test(a.link) ? a.link : BASE + a.link.replace(/^\//, "");
    var ext = /^https?:/.test(a.link) ? ' target="_blank" rel="noopener"' : "";
    return '<a class="link" href="' + esc(href) + '"' + ext + ">" + esc(T("Ayrıntılar")) + " " + icon("i-arrow") + "</a>";
  }
  function announcements(list) {
    var top = list.filter(function (a) { return a.kind === "onemli" && store.get("emek-ann-" + a.id) !== "x"; })[0];
    if (top) {
      var w = words(top), bar = document.createElement("div");
      bar.className = "annbar";
      bar.setAttribute("role", "region");
      bar.setAttribute("aria-label", T("Önemli duyuru"));
      bar.innerHTML = '<div class="annbar__in"><span class="annbar__i">' + icon("i-bolt") + '</span><p' + w.dir + "><b>" + esc(w.title) + "</b>" + (w.body ? " <span>" + esc(w.body) + "</span>" : "") + "</p>" + link(top)
        + '<button class="annbar__x" type="button" aria-label="' + esc(T("Duyuruyu kapat")) + '">' + icon("i-close") + "</button></div>";
      document.body.insertBefore(bar, document.querySelector(".hdr") || document.body.firstChild);
      bar.querySelector(".annbar__x").addEventListener("click", function () { store.set("emek-ann-" + top.id, "x"); bar.classList.add("is-out"); setTimeout(function () { bar.remove(); }, 320); });
    }
    var box = document.querySelector("[data-live-anns]"), into = box && box.querySelector("[data-live-list]");
    var info = list.filter(function (a) { return a.kind !== "onemli"; });
    if (!into || !info.length) return;
    into.innerHTML = info.slice(0, 6).map(function (a) {
      var w = words(a);
      return '<article class="annc"' + w.dir + '><span class="annc__i">' + icon("i-chat") + "</span><div><h3>" + esc(w.title) + "</h3>" + (w.body ? "<p>" + esc(w.body) + "</p>" : "") + link(a) + "</div></article>";
    }).join("");
    box.hidden = false;
  }

  /* ---- a doctor taken off the site: the cards go, the profile says so ---- */
  function hidden(slugs) {
    if (!slugs.length) return;
    slugs.forEach(function (slug) {
      [].forEach.call(document.querySelectorAll('[data-doc="' + slug + '"]'), function (el) { el.hidden = true; });
      [].forEach.call(document.querySelectorAll('a[href$="doktor=' + slug + '"]'), function (a) { a.hidden = true; });
    });
    if (D.docs) for (var i = D.docs.length - 1; i >= 0; i--) if (slugs.indexOf(D.docs[i].slug) >= 0) D.docs.splice(i, 1);
    var me = document.querySelector("[data-doc-page]");
    if (me && slugs.indexOf(me.getAttribute("data-doc-page")) >= 0) {
      var note = document.createElement("p");
      note.className = "note-box note-box--away";
      note.innerHTML = esc(T("Bu hekimimiz şu anda hastanemizde hizmet vermemektedir. Bölümümüzün diğer hekimlerinden randevu alabilirsiniz.")) + ' <a href="' + BASE + (D.docsHref || "doktorlarimiz/") + '">' + esc(T("Doktorlarımız")) + "</a>";
      var acts = me.querySelector(".phead__acts");
      if (acts) acts.parentNode.insertBefore(note, acts); else me.appendChild(note);
    }
  }
})();
