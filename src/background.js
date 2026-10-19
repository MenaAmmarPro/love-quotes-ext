"use strict";

/*
 * src/background.js — the little background worker.
 *
 * There is not much to do: on install, make sure a sensible default is in
 * storage so the popup always has something to read. The popup does the rest.
 */

const api = globalThis.browser || globalThis.chrome;

const STORE = "mena-quotes";
const DEFAULTS = { category: "all", favourites: [] };

function ensureDefaults() {
  if (!api || !api.storage || !api.storage.local) return;
  try {
    api.storage.local.get(STORE, (res) => {
      if (!res || !res[STORE]) {
        const payload = {};
        payload[STORE] = DEFAULTS;
        api.storage.local.set(payload);
      }
    });
  } catch (e) {
    // Storage is optional; the popup falls back to its own defaults.
  }
}

if (api && api.runtime && api.runtime.onInstalled) {
  api.runtime.onInstalled.addListener(ensureDefaults);
}
