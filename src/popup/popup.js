"use strict";

/*
 * src/popup/popup.js — the popup.
 *
 * Shows one random quote (or reason) at a time, lets you filter by category,
 * favourite the ones you love and copy one to send. Favourites + the chosen
 * category are kept in extension storage; nothing ever leaves the browser.
 *
 * The pure helpers live on window.MenaQuotes so test/harness.js can check them
 * without a real browser.
 */

(function () {
  var DATA = (typeof window !== "undefined" && window.MENA_QUOTES) ||
    { categories: [], items: [] };
  var ext = (typeof api !== "undefined") ? api : null;

  var STORE = "mena-quotes";
  var ALL = "all";
  var MAX_FAVS = 200;

  /* ---------------- pure helpers ---------------- */

  function categories() {
    return (DATA.categories || []).slice();
  }

  function labelFor(catId) {
    if (catId === ALL) return "Everything";
    var cats = DATA.categories || [];
    for (var i = 0; i < cats.length; i += 1) {
      if (cats[i].id === catId) return cats[i].label;
    }
    return String(catId || "");
  }

  function itemsFor(catId) {
    var items = DATA.items || [];
    if (!catId || catId === ALL) return items.slice();
    return items.filter(function (it) { return it && it.cat === catId; });
  }

  function pick(items, rand) {
    if (!items || !items.length) return null;
    var r = typeof rand === "function" ? rand() : Math.random();
    if (!(r >= 0 && r < 1)) r = 0;
    return items[Math.floor(r * items.length)];
  }

  function pickDifferent(items, currentText, rand) {
    if (!items || !items.length) return null;
    if (items.length === 1) return items[0];
    var next = pick(items, rand);
    var guard = 0;
    while (next && next.text === currentText && guard < 12) {
      next = pick(items, rand);
      guard += 1;
    }
    return next;
  }

  function isFavourite(favs, text) {
    return (favs || []).indexOf(text) >= 0;
  }

  function toggleFavourite(favs, text) {
    var list = (favs || []).slice();
    var at = list.indexOf(text);
    if (at >= 0) list.splice(at, 1);
    else if (list.length < MAX_FAVS) list.push(text);
    else list.shift(), list.push(text);
    return list;
  }

  function normalizePrefs(raw) {
    var out = { category: ALL, favourites: [] };
    if (!raw || typeof raw !== "object") return out;
    var known = { all: true };
    (DATA.categories || []).forEach(function (c) { known[c.id] = true; });
    if (typeof raw.category === "string" && known[raw.category]) {
      out.category = raw.category;
    }
    if (Array.isArray(raw.favourites)) {
      raw.favourites.slice(0, MAX_FAVS).forEach(function (t) {
        var text = String(t == null ? "" : t).slice(0, 300);
        if (text && out.favourites.indexOf(text) < 0) out.favourites.push(text);
      });
    }
    return out;
  }

  /* ---------------- storage ---------------- */

  function loadPrefs(cb) {
    if (!ext || !ext.storage || !ext.storage.local) { cb(normalizePrefs(null)); return; }
    try {
      ext.storage.local.get(STORE, function (res) {
        cb(normalizePrefs(res ? res[STORE] : null));
      });
    } catch (e) {
      cb(normalizePrefs(null));
    }
  }

  function savePrefs(prefs, cb) {
    if (!ext || !ext.storage || !ext.storage.local) { if (cb) cb(); return; }
    var payload = {};
    payload[STORE] = prefs;
    try {
      ext.storage.local.set(payload, function () { if (cb) cb(); });
    } catch (e) {
      if (cb) cb();
    }
  }

  /* ---------------- the testable surface ---------------- */

  window.MenaQuotes = {
    STORE: STORE,
    ALL: ALL,
    MAX_FAVS: MAX_FAVS,
    categories: categories,
    labelFor: labelFor,
    itemsFor: itemsFor,
    pick: pick,
    pickDifferent: pickDifferent,
    isFavourite: isFavourite,
    toggleFavourite: toggleFavourite,
    normalizePrefs: normalizePrefs,
    loadPrefs: loadPrefs,
    savePrefs: savePrefs
  };

  /* ---------------- DOM ---------------- */

  var prefs = normalizePrefs(null);
  var current = null;

  function $(id) {
    return (typeof document !== "undefined") ? document.getElementById(id) : null;
  }

  function setNote(message) {
    var node = $( "note" );
    if (node) node.textContent = message;
  }

  function renderCard(item, animate) {
    var text = $("card-text");
    var tag = $("card-tag");
    var card = $("card");
    if (text) text.textContent = item ? item.text : "No words here yet.";
    if (tag) tag.textContent = item ? labelFor(item.cat) : "";
    if (card && animate) {
      card.classList.remove("pop");
      void card.offsetWidth;
      card.classList.add("pop");
    }
    var favBtn = $("fav-btn");
    if (favBtn && item) {
      var on = isFavourite(prefs.favourites, item.text);
      favBtn.classList.toggle("is-on", on);
      favBtn.textContent = on ? "\u2605" : "\u2606";
      favBtn.setAttribute("aria-label", on ? "Remove from favourites" : "Favourite this one");
    }
    current = item || null;
  }

  function renderFavourites() {
    var list = $("fav-list");
    var count = $("fav-count");
    if (count) count.textContent = String(prefs.favourites.length);
    if (!list) return;
    list.textContent = "";
    if (!prefs.favourites.length) {
      var empty = document.createElement("li");
      empty.className = "fav-empty";
      empty.textContent = "Nothing saved yet — tap the star.";
      list.appendChild(empty);
      return;
    }
    prefs.favourites.forEach(function (text) {
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "fav-item";
      btn.setAttribute("title", "Copy this one");

      var span = document.createElement("span");
      span.className = "fav-text";
      span.textContent = text;
      btn.appendChild(span);

      var remove = document.createElement("span");
      remove.className = "fav-remove";
      remove.setAttribute("role", "button");
      remove.setAttribute("aria-label", "Remove from favourites");
      remove.textContent = "\u00d7";
      btn.appendChild(remove);

      btn.addEventListener("click", function (ev) {
        if (ev.target === remove) {
          prefs.favourites = toggleFavourite(prefs.favourites, text);
          persist();
          renderFavourites();
          setNote("Removed from favourites.");
          return;
        }
        copyText(text);
      });

      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  function renderCategoryOptions() {
    var sel = $("category");
    if (!sel) return;
    sel.textContent = "";
    var opts = [{ id: ALL, label: "Everything" }].concat(categories());
    opts.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.label;
      sel.appendChild(opt);
    });
    sel.value = prefs.category;
  }

  function showNext(animate) {
    var pool = itemsFor(prefs.category);
    var next = pickDifferent(pool, current ? current.text : null, Math.random);
    renderCard(next, animate);
  }

  function persist() {
    savePrefs({ category: prefs.category, favourites: prefs.favourites });
  }

  function copyText(text) {
    if (!text) return;
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        setNote("Copied \u2014 go send it \u2665");
      }, function () {
        setNote(text);
      });
      return;
    }
    setNote(text);
  }

  function boot() {
    loadPrefs(function (loaded) {
      prefs = loaded;
      renderCategoryOptions();
      renderFavourites();
      showNext(false);

      var sel = $("category");
      if (sel) sel.addEventListener("change", function () {
        prefs.category = sel.value;
        persist();
        showNext(true);
        setNote("Showing " + labelFor(sel.value) + ".");
      });

      var refresh = $("refresh-btn");
      if (refresh) refresh.addEventListener("click", function () { showNext(true); });

      var settings = $("settings-btn");
      if (settings) settings.addEventListener("click", function () { showNext(true); });

      var favBtn = $("fav-btn");
      if (favBtn) favBtn.addEventListener("click", function () {
        if (!current) return;
        var was = isFavourite(prefs.favourites, current.text);
        prefs.favourites = toggleFavourite(prefs.favourites, current.text);
        persist();
        renderFavourites();
        renderCard(current, false);
        setNote(was ? "Removed from favourites." : "Saved to favourites \u2665");
      });

      var copy = $("copy-btn");
      if (copy) copy.addEventListener("click", function () {
        copyText(current ? current.text : "");
      });
    });
  }

  if (typeof document !== "undefined" && document.addEventListener) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  }
})();
