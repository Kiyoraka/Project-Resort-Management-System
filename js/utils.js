/**
 * utils.js — Shared utility helpers for the Resort Management System
 * Exposed via `window.utils` namespace (no module system).
 * Browser-native ES6+, no dependencies.
 */
(function () {
  'use strict';

  // ---------- DOM helpers ----------

  /** Single element querySelector shortcut. */
  const qs = (selector, parent = document) => parent.querySelector(selector);

  /** querySelectorAll returning a real Array (spread of NodeList). */
  const qsa = (selector, parent = document) => [...parent.querySelectorAll(selector)];

  // ---------- Formatters ----------

  const _myrFormatter = new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
  });

  /** Format a number as MYR currency, e.g. 1234.5 -> "RM 1,234.50". */
  const formatMYR = (amount) => {
    const n = Number(amount);
    if (!Number.isFinite(n)) return _myrFormatter.format(0);
    return _myrFormatter.format(n);
  };

  /**
   * Format a Date or date string with one of: 'short' | 'long' | 'time' | 'datetime'.
   * Locale: en-MY.
   */
  const formatDate = (date, fmt = 'short') => {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '';

    let options;
    switch (fmt) {
      case 'long':
        options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        return new Intl.DateTimeFormat('en-MY', options).format(d);
      case 'time':
        options = { hour: '2-digit', minute: '2-digit', hour12: false };
        return new Intl.DateTimeFormat('en-MY', options).format(d);
      case 'datetime': {
        const datePart = new Intl.DateTimeFormat('en-MY', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }).format(d);
        const timePart = new Intl.DateTimeFormat('en-MY', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(d);
        return `${datePart} ${timePart}`;
      }
      case 'short':
      default:
        options = { day: 'numeric', month: 'short', year: 'numeric' };
        return new Intl.DateTimeFormat('en-MY', options).format(d);
    }
  };

  /** Shortcut for formatDate(date, 'datetime'). */
  const formatDateTime = (date) => formatDate(date, 'datetime');

  // ---------- IDs & timing ----------

  /** RFC 4122 v4 UUID via crypto, with a timestamp+random fallback. */
  const uuid = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  };

  /** Trailing-edge debounce — fn runs ms after the last call. */
  const debounce = (fn, ms = 300) => {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  };

  /** Leading-edge throttle — fn runs at most once per ms window. */
  const throttle = (fn, ms = 300) => {
    let lastCall = 0;
    let timer = null;
    return function (...args) {
      const now = Date.now();
      const remaining = ms - (now - lastCall);
      if (remaining <= 0) {
        clearTimeout(timer);
        timer = null;
        lastCall = now;
        fn.apply(this, args);
      } else if (!timer) {
        timer = setTimeout(() => {
          lastCall = Date.now();
          timer = null;
          fn.apply(this, args);
        }, remaining);
      }
    };
  };

  // ---------- URL query params ----------

  /** Read a query param from the current URL. */
  const getQueryParam = (name) => new URLSearchParams(window.location.search).get(name);

  /** Set / remove a query param without page reload (uses history.replaceState). */
  const setQueryParam = (name, value) => {
    const url = new URL(window.location.href);
    if (value === null || value === undefined || value === '') {
      url.searchParams.delete(name);
    } else {
      url.searchParams.set(name, value);
    }
    window.history.replaceState({}, '', url.toString());
  };

  // ---------- Date math ----------

  /** Inclusive positive day diff between two dates. */
  const daysBetween = (from, to) => {
    const a = from instanceof Date ? from : new Date(from);
    const b = to instanceof Date ? to : new Date(to);
    return Math.ceil(Math.abs(b - a) / (1000 * 60 * 60 * 24));
  };

  /** Inclusive date-range overlap test — used for booking conflict detection. */
  const dateRangeOverlaps = (aStart, aEnd, bStart, bEnd) => {
    const as = aStart instanceof Date ? aStart : new Date(aStart);
    const ae = aEnd instanceof Date ? aEnd : new Date(aEnd);
    const bs = bStart instanceof Date ? bStart : new Date(bStart);
    const be = bEnd instanceof Date ? bEnd : new Date(bEnd);
    return as <= be && bs <= ae;
  };

  /** Returns a new Date n days from the input (n can be negative). */
  const addDays = (date, n) => {
    const d = date instanceof Date ? new Date(date.getTime()) : new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  };

  // ---------- Misc helpers ----------

  /** Clamp a number between min and max (inclusive). */
  const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

  /** "Bachok Cove" -> "bachok-cove". */
  const slugify = (str) =>
    String(str)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

  /** Escape &, <, >, ", ' for safe HTML insertion. */
  const escapeHtml = (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  // ---------- localStorage wrapper (JSON-safe) ----------

  const storage = {
    /** Get and JSON.parse a key — returns fallback on missing or parse error. */
    get(key, fallback = null) {
      try {
        const raw = window.localStorage.getItem(key);
        if (raw === null) return fallback;
        return JSON.parse(raw);
      } catch (_) {
        return fallback;
      }
    },
    /** JSON.stringify and store a value. Returns true on success. */
    set(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (_) {
        return false;
      }
    },
    remove(key) {
      try {
        window.localStorage.removeItem(key);
      } catch (_) {
        /* noop */
      }
    },
    has(key) {
      try {
        return window.localStorage.getItem(key) !== null;
      } catch (_) {
        return false;
      }
    },
  };

  // ---------- Toast stub (early-boot safe) ----------

  /** Forwards to window.toast if loaded, otherwise logs to console. */
  const toast = (type, message, ms = 3000) => {
    if (typeof window.toast === 'function' && window.toast !== toast) {
      return window.toast(type, message, ms);
    }
    const fn = type === 'error' ? console.error : type === 'warn' ? console.warn : console.log;
    fn(`[toast:${type}] ${message}`);
  };

  // ---------- Async helpers ----------

  /** Promise that resolves after ms milliseconds. */
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /** Run fn on DOMContentLoaded, or immediately if DOM is already ready. */
  const onReady = (fn) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  };

  // ---------- Expose ----------

  window.utils = {
    qs,
    qsa,
    formatMYR,
    formatDate,
    formatDateTime,
    uuid,
    debounce,
    throttle,
    getQueryParam,
    setQueryParam,
    daysBetween,
    dateRangeOverlaps,
    addDays,
    clamp,
    slugify,
    escapeHtml,
    storage,
    toast,
    sleep,
    onReady,
  };
})();
