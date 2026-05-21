/**
 * date-range.js — lightweight vanilla date-range coordinator
 *
 * Coordinates min/max attributes between two native <input type="date"> fields
 * to enforce a valid check-in / check-out range. Does NOT render a custom
 * calendar — relies on the browser's native date picker UI.
 *
 * Usage:
 *   const api = window.dateRange.attach('#checkIn', '#checkOut', {
 *     minNights: 1,
 *     onChange: ({ start, end, nights, isValid }) => { ... }
 *   });
 */
(function () {
  'use strict';

  /** WeakMap storing per-instance listener bindings for clean destroy. */
  const instances = new WeakMap();

  const MS_PER_DAY = 86400000;

  /**
   * Resolve a selector or element to an HTMLInputElement.
   * @param {HTMLInputElement|string} ref
   * @returns {HTMLInputElement|null}
   */
  function resolveInput(ref) {
    if (!ref) return null;
    if (typeof ref === 'string') return document.querySelector(ref);
    return ref instanceof HTMLInputElement ? ref : null;
  }

  /**
   * Coerce a value (Date | string | null) to a Date or null.
   * @param {Date|string|null|undefined} value
   * @returns {Date|null}
   */
  function toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    if (typeof value === 'string') {
      // YYYY-MM-DD strings parsed as local midnight to avoid TZ shift
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const d = new Date(value + 'T00:00:00');
        return isNaN(d.getTime()) ? null : d;
      }
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  /**
   * Add N days to a Date, returning a new Date (does not mutate).
   * @param {Date} date
   * @param {number} days
   * @returns {Date}
   */
  function addDays(date, days) {
    const out = new Date(date.getTime());
    out.setDate(out.getDate() + days);
    return out;
  }

  /**
   * Format a Date object as YYYY-MM-DD using local time components.
   * Avoids the UTC-offset shift that `toISOString()` introduces.
   * @param {Date|string|null} date
   * @returns {string} YYYY-MM-DD or empty string
   */
  function toInputValue(date) {
    const d = toDate(date);
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /**
   * Parse a YYYY-MM-DD string into a Date at local midnight.
   * @param {string} str
   * @returns {Date|null}
   */
  function parseInputValue(str) {
    if (!str || typeof str !== 'string') return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
    const d = new Date(str + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }

  /**
   * Calculate integer nights between two dates (>= 0).
   * @param {Date|string|null} start
   * @param {Date|string|null} end
   * @returns {number}
   */
  function nights(start, end) {
    const s = toDate(start);
    const e = toDate(end);
    if (!s || !e) return 0;
    return Math.max(0, Math.round((e.getTime() - s.getTime()) / MS_PER_DAY));
  }

  /**
   * Format a date for display. Uses window.utils.formatDate when available,
   * otherwise falls back to a basic en-MY representation.
   * @param {Date|string|null} date
   * @param {string} [fmt='short']
   * @returns {string}
   */
  function format(date, fmt = 'short') {
    const d = toDate(date);
    if (!d) return '';
    if (window.utils && typeof window.utils.formatDate === 'function') {
      try {
        return window.utils.formatDate(d, fmt);
      } catch (_err) {
        /* fall through to default */
      }
    }
    const opts =
      fmt === 'long'
        ? { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
        : { year: 'numeric', month: 'short', day: 'numeric' };
    try {
      return d.toLocaleDateString('en-MY', opts);
    } catch (_err) {
      return toInputValue(d);
    }
  }

  /**
   * Briefly toggle a CSS error class on a field to signal invalid input.
   * @param {HTMLInputElement} input
   */
  function flashError(input) {
    if (!input) return;
    const field = input.closest('.field') || input;
    field.classList.add('field--error');
    setTimeout(() => field.classList.remove('field--error'), 1200);
  }

  /**
   * Attach range-coordination behavior to two date inputs.
   * @param {HTMLInputElement|string} startInput
   * @param {HTMLInputElement|string} endInput
   * @param {Object} [opts]
   * @param {string|Date} [opts.minStart] - Earliest allowed start (default: today)
   * @param {string|Date} [opts.maxEnd] - Latest allowed end (default: minStart + 365d)
   * @param {number} [opts.minNights=1] - Minimum nights between start and end
   * @param {Function} [opts.onChange] - Called with {start, end, nights, isValid}
   * @returns {{getRange: Function, setRange: Function, validate: Function, destroy: Function}}
   */
  function attach(startInput, endInput, opts = {}) {
    const startEl = resolveInput(startInput);
    const endEl = resolveInput(endInput);

    if (!startEl || !endEl) {
      console.warn('[dateRange] start or end input not found');
      return {
        getRange: () => ({ start: null, end: null }),
        setRange: () => {},
        validate: () => false,
        destroy: () => {}
      };
    }

    const minNightsValue = Number.isFinite(opts.minNights) && opts.minNights >= 0 ? opts.minNights : 1;
    const minStartDate = toDate(opts.minStart) || new Date();
    // Normalize minStart to local midnight
    minStartDate.setHours(0, 0, 0, 0);
    const maxEndDate = toDate(opts.maxEnd) || addDays(minStartDate, 365);
    const onChange = typeof opts.onChange === 'function' ? opts.onChange : null;

    // Apply initial bounds
    startEl.min = toInputValue(minStartDate);
    startEl.max = toInputValue(addDays(maxEndDate, -minNightsValue));
    endEl.max = toInputValue(maxEndDate);

    /**
     * Recompute end.min based on current start value.
     */
    function syncEndMin() {
      const startVal = parseInputValue(startEl.value);
      const floor = startVal ? addDays(startVal, minNightsValue) : addDays(minStartDate, minNightsValue);
      endEl.min = toInputValue(floor);
    }

    /**
     * Emit onChange with current state.
     */
    function emitChange() {
      if (!onChange) return;
      const start = parseInputValue(startEl.value);
      const end = parseInputValue(endEl.value);
      const n = nights(start, end);
      const isValid = validate();
      onChange({ start, end, nights: n, isValid });
    }

    /**
     * Validate full range — both filled, end >= start + minNights, within bounds.
     * @returns {boolean}
     */
    function validate() {
      const start = parseInputValue(startEl.value);
      const end = parseInputValue(endEl.value);
      if (!start || !end) return false;
      if (start.getTime() < minStartDate.getTime()) return false;
      if (end.getTime() > maxEndDate.getTime()) return false;
      const n = nights(start, end);
      return n >= minNightsValue;
    }

    function handleStartChange() {
      const start = parseInputValue(startEl.value);
      if (!start) {
        syncEndMin();
        emitChange();
        return;
      }
      const end = parseInputValue(endEl.value);
      const requiredEnd = addDays(start, minNightsValue);
      if (!end || end.getTime() < requiredEnd.getTime()) {
        endEl.value = toInputValue(requiredEnd);
      }
      syncEndMin();
      emitChange();
    }

    function handleEndChange() {
      const start = parseInputValue(startEl.value);
      const end = parseInputValue(endEl.value);
      if (!end) {
        emitChange();
        return;
      }
      if (start) {
        const requiredEnd = addDays(start, minNightsValue);
        if (end.getTime() < requiredEnd.getTime()) {
          flashError(endEl);
          endEl.value = toInputValue(requiredEnd);
        }
      }
      emitChange();
    }

    startEl.addEventListener('change', handleStartChange);
    endEl.addEventListener('change', handleEndChange);

    // Seed initial end.min from current start (if any)
    syncEndMin();

    const api = {
      /**
       * @returns {{start: Date|null, end: Date|null}}
       */
      getRange() {
        return {
          start: parseInputValue(startEl.value),
          end: parseInputValue(endEl.value)
        };
      },
      /**
       * @param {{start?: Date|string, end?: Date|string}} range
       */
      setRange(range = {}) {
        if (Object.prototype.hasOwnProperty.call(range, 'start')) {
          startEl.value = toInputValue(range.start);
        }
        syncEndMin();
        if (Object.prototype.hasOwnProperty.call(range, 'end')) {
          endEl.value = toInputValue(range.end);
        }
        emitChange();
      },
      validate,
      destroy() {
        startEl.removeEventListener('change', handleStartChange);
        endEl.removeEventListener('change', handleEndChange);
        instances.delete(startEl);
        instances.delete(endEl);
      }
    };

    instances.set(startEl, api);
    instances.set(endEl, api);

    return api;
  }

  window.dateRange = {
    attach,
    toInputValue,
    parseInputValue,
    format,
    nights
  };
})();
