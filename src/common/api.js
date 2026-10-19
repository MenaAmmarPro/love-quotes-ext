"use strict";

/*
 * src/common/api.js — the one place that knows which extension API we run on.
 *
 * Loaded first, as a plain script (not a module), so every other script on the
 * page can just use `api.*`. Chrome/Edge expose `chrome`, Firefox exposes
 * `browser` (which recent Chrome also sets as an alias).
 */

const api = globalThis.browser || globalThis.chrome;
