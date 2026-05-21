/**
 * store.js — Resort Management System (RMS)
 * ---------------------------------------------------------------------------
 * localStorage CRUD wrapper that acts as the project's "database".
 * All keys are namespaced under `rms.*`.
 *
 * Collections:
 *   rms.users         Array<User>
 *   rms.resorts       Array<Resort>
 *   rms.stalls        Array<Stall>
 *   rms.products      Array<Product>
 *   rms.parking       Array<ParkingSlot>  (24 slots seeded)
 *   rms.bookings      Array<Booking>
 *   rms.transactions  Array<Transaction>
 *   rms.messages      Array<Message>
 *
 * Single-value keys:
 *   rms.session       {userId, role, loggedInAt} | null
 *   rms.theme         'light' | 'dark' | 'auto'
 *   rms.seeded        boolean — true once seed.js has run
 *
 * Exposes a global `window.store` API with generic key/value access,
 * collection CRUD, bulk utilities, session helpers, demo data control,
 * and a lightweight pub/sub (same-tab + cross-tab via storage event).
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';

  const NAMESPACE = 'rms.';

  // Map<collectionName, Set<callback>> — same-tab subscribers
  const subscribers = new Map();

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Build the full storage key for a collection / single value.
   * @param {string} coll
   * @returns {string}
   */
  function _key(coll) {
    return NAMESPACE + coll;
  }

  /**
   * Generate a UUID. Prefers crypto.randomUUID, falls back to window.utils.uuid,
   * then to a timestamp+random string.
   * @returns {string}
   */
  function _uuid() {
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
    } catch (_) { /* ignore */ }

    if (window.utils && typeof window.utils.uuid === 'function') {
      try { return window.utils.uuid(); } catch (_) { /* ignore */ }
    }

    return (
      Date.now().toString(36) +
      '-' +
      Math.random().toString(36).slice(2, 10) +
      '-' +
      Math.random().toString(36).slice(2, 10)
    );
  }

  /**
   * Safe localStorage read + JSON parse.
   * @param {string} fullKey
   * @returns {*} parsed value, or undefined when absent / invalid
   */
  function _readRaw(fullKey) {
    try {
      const raw = localStorage.getItem(fullKey);
      if (raw === null || raw === undefined) return undefined;
      return JSON.parse(raw);
    } catch (err) {
      console.error('[store] read error for', fullKey, err);
      return undefined;
    }
  }

  /**
   * Safe localStorage write + JSON stringify. Returns boolean success.
   * @param {string} fullKey
   * @param {*} value
   * @returns {boolean}
   */
  function _writeRaw(fullKey, value) {
    try {
      localStorage.setItem(fullKey, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error('[store] write error for', fullKey, err);
      return false;
    }
  }

  /**
   * Emit a change notification for a collection — both to same-tab subscribers
   * and as a window-level CustomEvent 'rms:change'.
   * @param {string} coll
   */
  function _emit(coll) {
    const set = subscribers.get(coll);
    if (set) {
      set.forEach(function (fn) {
        try { fn(coll); } catch (err) { console.error('[store] subscriber error', err); }
      });
    }
    try {
      window.dispatchEvent(new CustomEvent('rms:change', { detail: { coll: coll } }));
    } catch (_) { /* ignore in old browsers */ }
  }

  /**
   * Shallow-equality predicate factory for `where`.
   * @param {Object} partial
   * @returns {(item: Object) => boolean}
   */
  function _partialMatch(partial) {
    const keys = Object.keys(partial);
    return function (item) {
      if (!item) return false;
      for (let i = 0; i < keys.length; i++) {
        if (item[keys[i]] !== partial[keys[i]]) return false;
      }
      return true;
    };
  }

  // Cross-tab sync — listen to native storage events from other tabs.
  window.addEventListener('storage', function (e) {
    if (!e.key || e.key.indexOf(NAMESPACE) !== 0) return;
    const coll = e.key.slice(NAMESPACE.length);
    const set = subscribers.get(coll);
    if (set) {
      set.forEach(function (fn) {
        try { fn(coll); } catch (err) { console.error('[store] cross-tab subscriber error', err); }
      });
    }
    try {
      window.dispatchEvent(new CustomEvent('rms:change', { detail: { coll: coll, crossTab: true } }));
    } catch (_) { /* ignore */ }
  });

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  const store = {
    NAMESPACE: NAMESPACE,

    // -------------------------------------------------------------------------
    // Generic key/value
    // -------------------------------------------------------------------------

    /**
     * Read a single namespaced value.
     * @param {string} key
     * @param {*} [fallback=null]
     * @returns {*}
     */
    get(key, fallback = null) {
      const v = _readRaw(_key(key));
      return v === undefined ? fallback : v;
    },

    /**
     * Write a single namespaced value. Emits a change for that key.
     * @param {string} key
     * @param {*} value
     * @returns {boolean} success
     */
    set(key, value) {
      const ok = _writeRaw(_key(key), value);
      if (ok) _emit(key);
      return ok;
    },

    /**
     * Remove a single namespaced value. Emits a change for that key.
     * @param {string} key
     */
    remove(key) {
      try {
        localStorage.removeItem(_key(key));
        _emit(key);
      } catch (err) {
        console.error('[store] remove error for', key, err);
      }
    },

    // -------------------------------------------------------------------------
    // Collection CRUD
    // -------------------------------------------------------------------------

    /**
     * List all items in a collection.
     * @param {string} coll
     * @returns {Array}
     */
    list(coll) {
      const v = _readRaw(_key(coll));
      return Array.isArray(v) ? v : [];
    },

    /**
     * Find an item by id.
     * @param {string} coll
     * @param {string} id
     * @returns {Object|null}
     */
    find(coll, id) {
      const items = this.list(coll);
      for (let i = 0; i < items.length; i++) {
        if (items[i] && items[i].id === id) return items[i];
      }
      return null;
    },

    /**
     * Filter a collection by a predicate function or a partial-match object.
     * @param {string} coll
     * @param {Function|Object} predicateOrPartial
     * @returns {Array}
     */
    where(coll, predicateOrPartial) {
      const items = this.list(coll);
      if (typeof predicateOrPartial === 'function') {
        return items.filter(predicateOrPartial);
      }
      if (predicateOrPartial && typeof predicateOrPartial === 'object') {
        return items.filter(_partialMatch(predicateOrPartial));
      }
      return items.slice();
    },

    /**
     * Insert an item. Assigns `id` (uuid) if missing and `createdAt` (ISO) if missing.
     * @param {string} coll
     * @param {Object} item
     * @returns {Object|null} the inserted item, or null on quota failure
     */
    insert(coll, item) {
      const items = this.list(coll);
      const toInsert = Object.assign({}, item);
      if (!toInsert.id) toInsert.id = _uuid();
      if (!toInsert.createdAt) toInsert.createdAt = new Date().toISOString();
      items.push(toInsert);
      const ok = _writeRaw(_key(coll), items);
      if (!ok) return null;
      _emit(coll);
      return toInsert;
    },

    /**
     * Shallow-merge `patch` into the existing item with the given id.
     * Preserves the original `id` and `createdAt`.
     * @param {string} coll
     * @param {string} id
     * @param {Object} patch
     * @returns {Object|null} the updated item, or null if not found / failed
     */
    update(coll, id, patch) {
      const items = this.list(coll);
      for (let i = 0; i < items.length; i++) {
        if (items[i] && items[i].id === id) {
          const original = items[i];
          const cloned = JSON.parse(JSON.stringify(original));
          const merged = Object.assign({}, cloned, patch || {}, {
            id: original.id,
            createdAt: original.createdAt
          });
          items[i] = merged;
          const ok = _writeRaw(_key(coll), items);
          if (!ok) return null;
          _emit(coll);
          return merged;
        }
      }
      return null;
    },

    /**
     * Remove an item by id. Returns the removed item (for undo) or null.
     * @param {string} coll
     * @param {string} id
     * @returns {Object|null}
     */
    remove(coll, id) {
      // Overloaded with generic remove(key) — disambiguate: if only one arg, treat as key.
      if (arguments.length === 1) {
        try {
          localStorage.removeItem(_key(coll));
          _emit(coll);
        } catch (err) {
          console.error('[store] remove error for', coll, err);
        }
        return null;
      }
      const items = this.list(coll);
      for (let i = 0; i < items.length; i++) {
        if (items[i] && items[i].id === id) {
          const removed = items.splice(i, 1)[0];
          const ok = _writeRaw(_key(coll), items);
          if (!ok) return null;
          _emit(coll);
          return removed;
        }
      }
      return null;
    },

    // -------------------------------------------------------------------------
    // Bulk / utility
    // -------------------------------------------------------------------------

    /**
     * Overwrite an entire collection. Used by seed.js.
     * @param {string} coll
     * @param {Array} items
     * @returns {boolean} success
     */
    replace(coll, items) {
      const arr = Array.isArray(items) ? items : [];
      const ok = _writeRaw(_key(coll), arr);
      if (ok) _emit(coll);
      return ok;
    },

    /**
     * Count items in a collection.
     * @param {string} coll
     * @returns {number}
     */
    count(coll) {
      return this.list(coll).length;
    },

    // -------------------------------------------------------------------------
    // Session helpers
    // -------------------------------------------------------------------------

    /**
     * Get the current session object.
     * @returns {Object|null}
     */
    getSession() {
      return this.get('session', null);
    },

    /**
     * Persist a session object.
     * @param {Object} s
     * @returns {boolean}
     */
    setSession(s) {
      return this.set('session', s);
    },

    /**
     * Clear the current session.
     */
    clearSession() {
      this.remove('session');
    },

    // -------------------------------------------------------------------------
    // Demo data control
    // -------------------------------------------------------------------------

    /**
     * Remove every `rms.*` key from localStorage (full wipe).
     * Emits a 'rms:change' event with coll='*'.
     */
    clear() {
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf(NAMESPACE) === 0) toRemove.push(k);
      }
      toRemove.forEach(function (k) {
        try { localStorage.removeItem(k); } catch (err) { console.error('[store] clear error for', k, err); }
      });
      // Notify any subscribers of cleared collections.
      toRemove.forEach(function (k) {
        const coll = k.slice(NAMESPACE.length);
        const set = subscribers.get(coll);
        if (set) set.forEach(function (fn) { try { fn(coll); } catch (_) {} });
      });
      try {
        window.dispatchEvent(new CustomEvent('rms:change', { detail: { coll: '*' } }));
      } catch (_) { /* ignore */ }
    },

    /**
     * Alias for clear(). Used by the "Reset Demo Data" button.
     */
    reset() {
      this.clear();
    },

    /**
     * Export every `rms.*` collection / value as a plain object.
     * Useful for download / debug inspection.
     * @returns {Object}
     */
    exportAll() {
      const out = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || k.indexOf(NAMESPACE) !== 0) continue;
        const name = k.slice(NAMESPACE.length);
        out[name] = _readRaw(k);
      }
      return out;
    },

    // -------------------------------------------------------------------------
    // Pub/sub
    // -------------------------------------------------------------------------

    /**
     * Subscribe to changes on a collection (same-tab + cross-tab).
     * @param {string} coll
     * @param {(coll: string) => void} fn
     * @returns {() => void} unsubscribe function
     */
    onChange(coll, fn) {
      if (typeof fn !== 'function') return function () {};
      let set = subscribers.get(coll);
      if (!set) {
        set = new Set();
        subscribers.set(coll, set);
      }
      set.add(fn);
      return function unsubscribe() {
        const s = subscribers.get(coll);
        if (s) {
          s.delete(fn);
          if (s.size === 0) subscribers.delete(coll);
        }
      };
    },

    /**
     * Internal — emit a change notification for a collection.
     * Exposed for advanced/batch flows (e.g. seed.js).
     * @param {string} coll
     */
    _emit(coll) {
      _emit(coll);
    }
  };

  window.store = store;
})();
