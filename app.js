/* ═══════════════════════════════════════════════════════════════════
   TIER S SPECIALISTS — page behaviour
   Seven independent modules. Each one finds its own DOM and returns
   early if that DOM is missing, so removing a section from the page
   never breaks the rest.
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  var LOG = "[tier-s]";

  function reducedMotion() {
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function onFrame(fn) {
    var ticking = false;
    return function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        ticking = false;
        fn();
      });
    };
  }

  /* ── Scroll progress + sticky top bar ─────────────────────────── */

  function initScroll() {
    var bar = document.querySelector("[data-progress]");
    var topbar = document.querySelector("[data-topbar]");
    if (!bar && !topbar) return;

    var update = onFrame(function () {
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var y = window.scrollY || doc.scrollTop || 0;

      if (bar) {
        var pct = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
        bar.style.width = (pct * 100).toFixed(2) + "%";
      }

      if (topbar) topbar.classList.toggle("is-stuck", y > 8);
    });

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
  }

  /* ── Current section in the top nav ───────────────────────────── */

  function initCurrentSection() {
    var links = Array.prototype.slice.call(
      document.querySelectorAll(".topnav a[href^='#']")
    );
    if (!links.length || !("IntersectionObserver" in window)) return;

    var byId = {};
    var targets = [];

    links.forEach(function (link) {
      var el = document.getElementById(link.getAttribute("href").slice(1));
      if (!el) return;
      byId[el.id] = link;
      targets.push(el);
    });

    if (!targets.length) return;

    var visible = {};

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          visible[entry.target.id] = entry.isIntersecting
            ? entry.intersectionRatio
            : 0;
        });

        var best = null;
        Object.keys(visible).forEach(function (id) {
          if (visible[id] > 0 && (!best || visible[id] > visible[best])) best = id;
        });

        links.forEach(function (link) {
          link.classList.remove("is-current");
          link.removeAttribute("aria-current");
        });

        if (best && byId[best]) {
          byId[best].classList.add("is-current");
          byId[best].setAttribute("aria-current", "true");
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.01, 0.5, 1] }
    );

    targets.forEach(function (el) {
      io.observe(el);
    });
  }

  /* ── Mobile drawer ────────────────────────────────────────────── */

  function initDrawer() {
    var burger = document.querySelector("[data-burger]");
    var drawer = document.querySelector("[data-drawer]");
    if (!burger || !drawer) return;

    function close() {
      drawer.hidden = true;
      burger.setAttribute("aria-expanded", "false");
    }

    function open() {
      drawer.hidden = false;
      burger.setAttribute("aria-expanded", "true");
    }

    burger.addEventListener("click", function () {
      if (burger.getAttribute("aria-expanded") === "true") close();
      else open();
    });

    drawer.addEventListener("click", function (e) {
      if (e.target && e.target.closest && e.target.closest("a")) close();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || drawer.hidden) return;
      close();
      burger.focus();
    });

    // The drawer is a small-screen affordance; the desktop nav takes over
    // above 860px, so leaving it open across the breakpoint would strand it.
    window.addEventListener("resize", function () {
      if (window.innerWidth > 860 && !drawer.hidden) close();
    });

    close();
  }

  /* ── Grading ladder (tabs) ────────────────────────────────────── */

  function initLadder() {
    var list = document.querySelector("[data-tablist]");
    if (!list) return;

    var tabs = Array.prototype.slice.call(list.querySelectorAll("[role='tab']"));
    if (!tabs.length) return;

    var panels = tabs.map(function (tab) {
      return document.getElementById(tab.getAttribute("aria-controls"));
    });

    function select(index, focus) {
      tabs.forEach(function (tab, i) {
        var on = i === index;
        tab.setAttribute("aria-selected", on ? "true" : "false");
        tab.tabIndex = on ? 0 : -1;
        if (panels[i]) panels[i].hidden = !on;
      });
      if (focus) tabs[index].focus();
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () {
        select(i, false);
      });

      tab.addEventListener("keydown", function (e) {
        var next = null;
        if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (i + 1) % tabs.length;
        else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = tabs.length - 1;
        if (next === null) return;
        e.preventDefault();
        select(next, true);
      });
    });

    // Start from whatever the markup marked selected, so the page renders
    // the same panel with or without this script.
    var initial = tabs.findIndex(function (tab) {
      return tab.getAttribute("aria-selected") === "true";
    });
    select(initial < 0 ? 0 : initial, false);
  }

  /* ── Role filters ─────────────────────────────────────────────── */

  function initFilters() {
    var group = document.querySelector("[data-filters]");
    var host = document.querySelector("[data-chips]");
    if (!group || !host) return;

    var buttons = Array.prototype.slice.call(group.querySelectorAll("[data-filter]"));
    var chips = Array.prototype.slice.call(host.querySelectorAll(".chip"));
    var empty = document.querySelector("[data-chips-empty]");

    function apply(value) {
      var shown = 0;

      chips.forEach(function (chip) {
        var on = value === "all" || chip.dataset.cat === value;
        chip.hidden = !on;
        if (on) shown++;
      });

      buttons.forEach(function (btn) {
        var on = btn.dataset.filter === value;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      });

      if (empty) empty.hidden = shown > 0;
    }

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        apply(btn.dataset.filter);
      });
    });

    apply("all");
  }

  /* ── Brief form ───────────────────────────────────────────────── */

  function initBrief() {
    var form = document.querySelector("[data-brief]");
    if (!form) return;

    var intentField = form.querySelector("[data-intent-field]");
    var options = Array.prototype.slice.call(form.querySelectorAll("[data-intent]"));
    var conditional = Array.prototype.slice.call(form.querySelectorAll("[data-only]"));
    var submit = form.querySelector("[data-submit]");
    var done = form.querySelector("[data-done]");
    var endpoint = form.dataset.endpoint || "";
    var intent = intentField ? intentField.value || "hiring" : "hiring";

    function setIntent(value) {
      intent = value;
      if (intentField) intentField.value = value;

      options.forEach(function (opt) {
        var on = opt.dataset.intent === value;
        opt.classList.toggle("is-active", on);
        opt.setAttribute("aria-checked", on ? "true" : "false");
      });

      // Hidden fields are also disabled so they never reach the payload.
      conditional.forEach(function (field) {
        var on = field.dataset.only === value;
        field.hidden = !on;
        Array.prototype.forEach.call(field.querySelectorAll("input, textarea"), function (el) {
          el.disabled = !on;
        });
      });
    }

    options.forEach(function (opt) {
      opt.addEventListener("click", function () {
        setIntent(opt.dataset.intent);
      });

      opt.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        var i = options.indexOf(opt);
        var next = options[(i + (e.key === "ArrowRight" ? 1 : options.length - 1)) % options.length];
        setIntent(next.dataset.intent);
        next.focus();
      });
    });

    function showError(name, message) {
      var input = form.querySelector("[name='" + name + "']");
      var slot = form.querySelector("[data-error-for='" + name + "']");
      if (input) input.setAttribute("aria-invalid", message ? "true" : "false");
      if (!slot) return;
      slot.textContent = message || "";
      slot.hidden = !message;
    }

    function validate() {
      var name = form.elements.name;
      var email = form.elements.email;
      var ok = true;

      if (!name || !name.value.trim()) {
        showError("name", "Tell us who you are.");
        ok = false;
      } else {
        showError("name", "");
      }

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) {
        showError("email", "We need an address we can reply to.");
        ok = false;
      } else {
        showError("email", "");
      }

      if (!ok) {
        var bad = form.querySelector("[aria-invalid='true']");
        if (bad) bad.focus();
      }

      return ok;
    }

    function payload() {
      var data = { intent: intent };
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name || el.disabled || el.type === "submit") return;
        data[el.name] = el.value.trim();
      });
      return data;
    }

    function finish() {
      if (done) done.hidden = false;
      Array.prototype.forEach.call(form.querySelectorAll(".field, .toggle, .brief__small"), function (el) {
        el.hidden = true;
      });
      if (submit) submit.hidden = true;
      if (done) done.setAttribute("tabindex", "-1");
      if (done) done.focus();
    }

    function fail() {
      if (!submit) return;
      submit.disabled = false;
      submit.textContent = "Send the brief";
      showError("email", "That did not send. Mail hello@tiersspecialists.com instead.");
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validate()) return;

      var body = payload();

      // Without data-endpoint there is nowhere to post to, so the form
      // confirms locally and logs what it would have sent.
      if (!endpoint || typeof window.fetch !== "function") {
        console.info(LOG, "brief (not sent — no data-endpoint):", body);
        finish();
        return;
      }

      if (submit) {
        submit.disabled = true;
        submit.textContent = "Sending…";
      }

      window
        .fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          finish();
        })
        .catch(function (err) {
          console.warn(LOG, "brief failed:", err);
          fail();
        });
    });

    setIntent(intent);
  }

  /* ── Scroll reveal ────────────────────────────────────────────── */

  function initReveal() {
    var items = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));
    if (!items.length) return;

    // Arming happens here rather than in the stylesheet: if this script
    // never runs, nothing is left stuck at opacity 0.
    if (reducedMotion() || !("IntersectionObserver" in window)) return;

    items.forEach(function (el) {
      el.classList.add("is-armed");
    });

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.remove("is-armed");
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
    );

    items.forEach(function (el) {
      io.observe(el);
    });
  }

  /* ── Footer year ──────────────────────────────────────────────── */

  function initYear() {
    var slot = document.querySelector("[data-year]");
    if (slot) slot.textContent = String(new Date().getFullYear());
  }

  /* ── Boot ─────────────────────────────────────────────────────── */

  function boot() {
    initScroll();
    initCurrentSection();
    initDrawer();
    initLadder();
    initFilters();
    initBrief();
    initReveal();
    initYear();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
