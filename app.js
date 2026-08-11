/* ═══════════════════════════════════════════════════════════════════
   RAILWORK — page behaviour
   Four independent pieces: the elevation rail, the photo pile, the
   pricing → form handoff, and the signup form itself. Each one guards
   its own DOM so a missing section never breaks the others.
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  var SUMMIT = 1244; // metres at the top of the page
  var BASE = 900; // metres at the bottom
  var NARROW_RAIL = 760; // below this the rail is too thin for labels

  /* ── Elevation rail ───────────────────────────────────────────── */

  function initRail() {
    var rail = document.querySelector(".rail");
    var host = document.querySelector("[data-markers]");
    var fill = document.querySelector("[data-progress-fill]");
    var readout = document.querySelector("[data-alt-readout]");
    var sections = Array.prototype.slice.call(
      document.querySelectorAll("main section[data-alt]")
    );

    if (!rail || !host || !fill || !readout || !sections.length) return;

    var markers = sections.map(function (section, i) {
      var a = document.createElement("a");
      a.className = "marker";
      a.href = "#" + section.id;
      a.style.top =
        (sections.length > 1 ? (i / (sections.length - 1)) * 100 : 0).toFixed(2) + "%";

      var tick = document.createElement("span");
      tick.className = "marker__tick";

      var label = document.createElement("span");
      label.className = "marker__label";
      label.textContent = section.dataset.label || section.id;

      // The visible label is the section name at full width and the
      // altitude when the rail narrows, so give the link a stable name.
      a.title = section.dataset.label || section.id;
      a.setAttribute("aria-label", (section.dataset.label || section.id) + " — " + section.dataset.alt + " m");

      a.appendChild(tick);
      a.appendChild(label);
      host.appendChild(a);

      return { el: a, label: label, section: section, alt: section.dataset.alt };
    });

    var active = -1;
    var lastAlt = null;
    var narrow = null;
    var ticking = false;

    function applyWidth() {
      var isNarrow = window.innerWidth < NARROW_RAIL;
      if (isNarrow === narrow) return;
      narrow = isNarrow;
      rail.classList.toggle("is-narrow", isNarrow);
      markers.forEach(function (m) {
        m.label.textContent = isNarrow ? m.alt : m.section.dataset.label || m.section.id;
      });
    }

    function measure() {
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var pct = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;

      fill.style.height = (pct * 100).toFixed(2) + "%";

      var alt = Math.round(SUMMIT - (SUMMIT - BASE) * pct);
      if (alt !== lastAlt) {
        readout.textContent = String(alt);
        lastAlt = alt;
      }

      var next = 0;
      sections.forEach(function (section, i) {
        if (section.getBoundingClientRect().top <= window.innerHeight * 0.42) next = i;
      });

      if (next !== active) {
        if (markers[active]) markers[active].el.classList.remove("is-active");
        markers[next].el.classList.add("is-active");
        active = next;
      }
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        ticking = false;
        measure();
      });
    }

    applyWidth();
    measure();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener(
      "resize",
      function () {
        applyWidth();
        onScroll();
      },
      { passive: true }
    );
  }

  /* ── Photo pile ───────────────────────────────────────────────── */

  function initPile() {
    var pile = document.querySelector("[data-pile]");
    if (!pile) return;

    var cards = Array.prototype.slice.call(pile.querySelectorAll("[data-pile-card]"));
    var counter = pile.querySelector("[data-pile-count]");
    if (!cards.length) return;

    var n = cards.length;
    var top = 0;
    var wheelLock = 0;

    // A card with a real frame drops its stand-in caption.
    cards.forEach(function (card) {
      var img = card.querySelector("[data-pile-img]");
      if (img && img.getAttribute("src")) card.classList.add("has-image");
    });

    function pad(value) {
      return (value < 10 ? "0" : "") + value;
    }

    function render() {
      cards.forEach(function (card, i) {
        card.dataset.pos = String((i - top + n) % n);
      });
      if (counter) counter.textContent = pad(top + 1) + " / " + pad(n);
    }

    function step(dir) {
      top = (top + dir + n) % n;
      render();
    }

    pile.addEventListener("click", function () {
      step(1);
    });

    // Deliberately not preventDefault: the page keeps scrolling past the
    // pile, the frames just advance on the way through.
    pile.addEventListener(
      "wheel",
      function (e) {
        if (Math.abs(e.deltaY) < 8) return;
        var now = Date.now();
        if (now - wheelLock < 420) return;
        wheelLock = now;
        step(e.deltaY > 0 ? 1 : -1);
      },
      { passive: true }
    );

    pile.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        step(1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        step(-1);
      }
    });

    render();
  }

  /* ── Hero footage slate ───────────────────────────────────────── */

  function initHeroSlate() {
    var video = document.querySelector("[data-hero-video]");
    var slate = document.querySelector("[data-media-slate]");
    if (!video || !slate) return;

    // Once a <source> is added the placeholder card has nothing to say.
    if (video.querySelector("source") || video.getAttribute("src")) {
      slate.hidden = true;
    }
  }

  /* ── Pricing → form handoff ───────────────────────────────────── */

  function initTierHandoff() {
    var select = document.querySelector("[data-tier-select]");
    if (!select) return;

    document.querySelectorAll("[data-tier]").forEach(function (link) {
      link.addEventListener("click", function () {
        var wanted = link.dataset.tier;
        Array.prototype.forEach.call(select.options, function (option) {
          if (option.text === wanted) select.value = option.value || option.text;
        });
      });
    });
  }

  /* ── Signup form ──────────────────────────────────────────────── */

  function initSignup() {
    var form = document.querySelector("[data-signup]");
    var confirm = document.querySelector("[data-confirm]");
    if (!form || !confirm) return;

    var submit = form.querySelector('button[type="submit"]');
    var endpoint = form.dataset.endpoint || "";

    function fieldOf(input) {
      return input.closest(".field");
    }

    function setError(input, message) {
      var field = fieldOf(input);
      if (!field) return;
      var slot = field.querySelector("[data-error]");
      field.classList.toggle("is-invalid", Boolean(message));
      input.setAttribute("aria-invalid", message ? "true" : "false");
      if (slot) {
        slot.textContent = message || "";
        slot.hidden = !message;
      }
    }

    function validate() {
      var firstBad = null;

      form.querySelectorAll("input[required]").forEach(function (input) {
        var value = input.value.trim();
        var message = "";

        if (!value) {
          message = "Required";
        } else if (input.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
          message = "Check this email address";
        }

        setError(input, message);
        if (message && !firstBad) firstBad = input;
      });

      return firstBad;
    }

    form.querySelectorAll("input[required]").forEach(function (input) {
      input.addEventListener("input", function () {
        if (fieldOf(input) && fieldOf(input).classList.contains("is-invalid")) validate();
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var firstBad = validate();
      if (firstBad) {
        firstBad.focus();
        return;
      }

      var payload = Object.fromEntries(new FormData(form).entries());

      function done() {
        form.hidden = true;
        confirm.hidden = false;
        confirm.focus({ preventScroll: true });
      }

      function failed(err) {
        if (submit) {
          submit.disabled = false;
          submit.textContent = "Reserve your spot";
        }
        // eslint-disable-next-line no-console
        console.error("[railwork] signup failed", err);
        window.alert(
          "That didn't go through. Email ride@railwork.camp and I'll book you in by hand."
        );
      }

      if (!endpoint) {
        // No handler wired yet — behave exactly as the design does.
        // eslint-disable-next-line no-console
        console.info("[railwork] no data-endpoint set; signup not sent:", payload);
        done();
        return;
      }

      if (submit) {
        submit.disabled = true;
        submit.textContent = "Sending…";
      }

      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          done();
        })
        .catch(failed);
    });

    confirm.setAttribute("tabindex", "-1");
  }

  /* ── Boot ─────────────────────────────────────────────────────── */

  function boot() {
    initRail();
    initPile();
    initHeroSlate();
    initTierHandoff();
    initSignup();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
