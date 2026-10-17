/* ==========================================================================
   My results: the hospital's results system, its fields alone in our card
   --------------------------------------------------------------------------
   The system (its own address, its own "I am not a robot" check) lays its
   page out three ways by width. Measured on its page (17.10.2026), for each
   layout: the frame width that gives it (iw), where its fields begin — left
   (x0) and top (crop: its logo, step bar, title and its own button above
   them are cut off) — and how wide and tall its fields and button are (w, v;
   its own privacy line is left out: the card says it, linked). The card
   picks the layout its width allows and scales it to fit. Results open
   under the fields in the same page, so once the patient is in the form the
   window grows to make room for them and for the robot check's puzzle (room);
   a long list scrolls inside the window.
   ========================================================================== */
(function () {
  "use strict";
  var box = document.querySelector("[data-lab]");
  if (!box) return;
  var frame = box.querySelector("iframe");
  var LAYOUTS = [
    { min: 680, iw: 800, x0: 67, w: 666, crop: 248, v: 296, room: 456 },     /* two fields to a row, wide */
    { min: 470, iw: 700, x0: 107, w: 486, crop: 279, v: 296, room: 456 },    /* two to a row */
    { min: 0, iw: 420, x0: 38, w: 345, crop: 308, v: 420, room: 440 }        /* one to a row (a phone) */
  ];
  /* room: the results list, and the robot check's picture puzzle when it asks for one (about 580 px tall,
     placed by the check beside its box): it must fit in the window, or the patient cannot finish it */
  var open = false, note = document.querySelector("[data-labroom]");
  function fit() {
    var avail = box.parentElement.clientWidth - 2 * parseFloat(getComputedStyle(box.parentElement).paddingLeft || 0);
    var m = LAYOUTS.filter(function (l) { return avail >= l.min; })[0];
    var k = Math.min(m.min ? 1 : 1.12, avail / m.w);
    var st = box.style;
    st.setProperty("--iw", m.iw); st.setProperty("--x0", m.x0); st.setProperty("--w", m.w); st.setProperty("--crop", m.crop);
    st.setProperty("--v", m.v + (open ? m.room : 0)); st.setProperty("--vmax", m.v + m.room); st.setProperty("--k", k.toFixed(4));
    if (note) note.hidden = !open;
  }
  /* the patient has started on the form (the focus went into the frame): room for the results */
  addEventListener("blur", function () {
    setTimeout(function () { if (!open && document.activeElement === frame) { open = true; fit(); } }, 0);
  });
  var t = 0;
  addEventListener("resize", function () { clearTimeout(t); t = setTimeout(fit, 120); });
  fit();
})();
