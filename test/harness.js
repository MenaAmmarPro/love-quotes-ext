"use strict";

/*
 * test/harness.js — dependency-free checks for love-quotes-ext.
 *
 * Run:  node test/harness.js
 * Loads src/common/api.js + data.js + src/popup/popup.js in a bare context with
 * a mocked `chrome` and checks the pure helpers on window.MenaQuotes.
 */

const fs = require("fs");
const vm = require("vm");
const path = require("path");

/* ---------------- a tiny in-memory chrome.storage.local ---------------- */
const storage = {};

const mockApi = {
  storage: {
    local: {
      get(keys, cb) {
        const out = {};
        if (typeof keys === "string") {
          if (keys in storage) out[keys] = storage[keys];
        } else if (Array.isArray(keys)) {
          keys.forEach((k) => { if (k in storage) out[k] = storage[k]; });
        } else if (keys && typeof keys === "object") {
          Object.keys(keys).forEach((k) => { out[k] = (k in storage) ? storage[k] : keys[k]; });
        }
        cb(out);
      },
      set(obj, cb) {
        Object.keys(obj).forEach((k) => { storage[k] = obj[k]; });
        if (cb) cb();
      },
      remove(keys, cb) {
        (Array.isArray(keys) ? keys : [keys]).forEach((k) => { delete storage[k]; });
        if (cb) cb();
      }
    }
  }
};

const el = () => ({
  style: {}, classList: { add() {}, remove() {}, toggle() {} }, dataset: {},
  appendChild() {}, addEventListener() {}, setAttribute() {}, removeAttribute() {},
  querySelector: () => null, querySelectorAll: () => [], focus() {}, remove() {},
  innerHTML: "", textContent: "", value: ""
});

const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval, Date, Math, JSON,
  chrome: mockApi,
  navigator: { language: "en", clipboard: { writeText: async () => {} } },
  document: {
    readyState: "loading",
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    createElement: () => el(),
    body: { appendChild() {} }
  }
};

sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const scripts = [
  "src/common/api.js",
  "src/common/data.js",
  "src/popup/popup.js"
];
for (const f of scripts) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), sandbox, { filename: f });
}

const NS = sandbox.window.MenaQuotes;
const DATA = sandbox.window.MENA_QUOTES;

const sleep = () => new Promise((r) => setTimeout(r, 0));

let failures = 0;
function assert(cond, message) {
  if (!cond) {
    console.error("FAIL: " + message);
    failures += 1;
    process.exitCode = 1;
  } else {
    console.log("ok - " + message);
  }
}

/* ---------------- data + namespace ---------------- */
assert(!!NS, "namespace window.MenaQuotes is exposed");
assert(NS.STORE === "mena-quotes", "storage key is mena-quotes");
assert(NS.ALL === "all", "the 'all' sentinel is exposed");
assert(!!DATA && Array.isArray(DATA.items), "bundled data is present");
assert(NS.categories().length === 5, "five categories");

const ids = NS.categories().map((c) => c.id).join(",");
assert(ids === "reason,quote,goodnight,distance,romanian", "category ids in order");
assert(NS.labelFor("romanian") === "Romanian sweetness", "labelFor reads a category label");
assert(NS.labelFor("all") === "Everything", "labelFor maps all -> Everything");
assert(NS.labelFor("nope") === "nope", "labelFor passes unknown ids through");

/* ---------------- items + categories ---------------- */
const all = NS.itemsFor("all");
assert(all.length === DATA.items.length, "itemsFor('all') returns everything");
assert(NS.itemsFor("reason").length === 65, "65 reasons");
assert(NS.itemsFor("quote").length === 15, "15 little quotes");
assert(NS.itemsFor("goodnight").length === 8, "8 goodnights");
assert(NS.itemsFor("distance").length === 8, "8 distance lines");
assert(NS.itemsFor("romanian").length === 7, "7 Romanian lines");

const known = {};
NS.categories().forEach((c) => { known[c.id] = true; });
assert(DATA.items.every((it) => it && typeof it.text === "string" && it.text && known[it.cat]),
  "every item has text and a known category");

/* ---------------- pick ---------------- */
const four = [{ text: "a" }, { text: "b" }, { text: "c" }, { text: "d" }];
assert(NS.pick(four, () => 0).text === "a", "pick(0) is the first item");
assert(NS.pick(four, () => 0.999).text === "d", "pick(~1) is the last item");
assert(NS.pick([], Math.random) === null, "pick on an empty list is null");
assert(NS.pick(four).text !== undefined, "pick works with the default random");

/* ---------------- pickDifferent ---------------- */
let seq = [0, 0, 0.5];
const seqRand = () => (seq.length ? seq.shift() : 0.5);
const diff = NS.pickDifferent(four, "a", seqRand);
assert(diff.text === "c", "pickDifferent retries past the same text");
assert(NS.pickDifferent([{ text: "only" }], "only", () => 0).text === "only",
  "pickDifferent returns the only item even if it matches");
assert(NS.pickDifferent([], null, Math.random) === null, "pickDifferent on empty is null");

/* ---------------- favourites ---------------- */
assert(NS.isFavourite([], "x") === false, "isFavourite false on empty");
assert(NS.isFavourite(["x"], "x") === true, "isFavourite finds a saved line");
let favs = NS.toggleFavourite([], "hello");
assert(favs.length === 1 && favs[0] === "hello", "toggleFavourite adds");
favs = NS.toggleFavourite(favs, "hello");
assert(favs.length === 0, "toggleFavourite removes on second tap");
favs = NS.toggleFavourite(["a", "b"], "c");
assert(favs.join(",") === "a,b,c", "toggleFavourite appends and keeps order");
assert(NS.toggleFavourite(["a"], "a").join(",") === "", "toggleFavourite removes the only one");

/* ---------------- normalizePrefs ---------------- */
let prefs = NS.normalizePrefs(null);
assert(prefs.category === "all" && prefs.favourites.length === 0, "normalizePrefs defaults");
prefs = NS.normalizePrefs({ category: "quote", favourites: ["one", "one", "two"] });
assert(prefs.category === "quote", "normalizePrefs keeps a known category");
assert(prefs.favourites.join(",") === "one,two", "normalizePrefs de-duplicates favourites");
prefs = NS.normalizePrefs({ category: "bogus", favourites: ["x", 3, ""] });
assert(prefs.category === "all", "normalizePrefs rejects an unknown category");
assert(prefs.favourites.join(",") === "x,3", "normalizePrefs stringifies but drops blanks");

/* ---------------- storage round-trip (mocked api.*) ---------------- */
(async function () {
  let stored = null;
  NS.savePrefs({ category: "goodnight", favourites: ["sweet dreams"] }, () => {
    stored = storage["mena-quotes"];
  });
  await sleep();
  assert(!!stored && stored.category === "goodnight", "savePrefs writes to chrome.storage.local");

  let loaded = null;
  NS.loadPrefs((p) => { loaded = p; });
  await sleep();
  assert(loaded && loaded.category === "goodnight", "loadPrefs reads the category back");
  assert(loaded.favourites.join(",") === "sweet dreams", "loadPrefs reads favourites back");

  storage["mena-quotes"] = { category: "bogus", favourites: "nope" };
  let repaired = null;
  NS.loadPrefs((p) => { repaired = p; });
  await sleep();
  assert(repaired.category === "all" && Array.isArray(repaired.favourites),
    "loadPrefs repairs corrupt stored data");

  console.log(failures ? "\n" + failures + " failure(s)" : "\nall checks passed");
})();
