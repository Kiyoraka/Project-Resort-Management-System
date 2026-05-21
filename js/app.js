/**
 * app.js — Global boot file for KIYO COAST Resort Management System.
 *
 * Loaded by every HTML page AFTER utils/store/seed/auth/components, BEFORE page-specific scripts.
 * Responsibilities:
 *   - Apply persisted theme synchronously to prevent flash-of-wrong-theme
 *   - Ensure demo data is seeded
 *   - Expose `window.app` namespace with theme controls, ready Promise, reset flow
 *   - Print console banner on first page in session
 *
 * @namespace window.app
 */

// ─────────────────────────────────────────────────────────────────────────────
// SYNCHRONOUS THEME BOOT — must run before first paint to avoid FOUC.
// Reads from localStorage directly (store.js may not be initialized for some
// edge cases, but it is loaded before us — defensive direct read as fallback).
// ─────────────────────────────────────────────────────────────────────────────
(function applyThemeImmediately() {
    'use strict';
    try {
        var mode = 'light';
        if (window.store && typeof window.store.get === 'function') {
            mode = window.store.get('theme', 'light');
        } else {
            // Fallback: read raw localStorage
            var raw = localStorage.getItem('rms.theme');
            if (raw) {
                try { mode = JSON.parse(raw); } catch (e) { mode = raw; }
            }
        }
        var effective = mode;
        if (mode === 'auto') {
            effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        document.documentElement.setAttribute('data-theme', effective);
    } catch (err) {
        console.warn('[app] Theme pre-boot failed, defaulting to light:', err);
        document.documentElement.setAttribute('data-theme', 'light');
    }
})();

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP MODULE
// ─────────────────────────────────────────────────────────────────────────────
(function () {
    'use strict';

    var VERSION = '1.0.0';
    var VALID_MODES = ['light', 'dark', 'auto'];

    // Defensive guards
    if (!window.utils) console.error('[app] utils.js not loaded — script order broken');
    if (!window.store) console.error('[app] store.js not loaded — script order broken');
    if (!window.seed)  console.error('[app] seed.js not loaded — script order broken');

    // ── Theme subscribers ────────────────────────────────────────────────────
    var themeSubscribers = new Set();
    var mediaQueryListenerRegistered = false;

    /**
     * Resolve a theme mode to its effective value (light or dark).
     * @param {string} mode - 'light' | 'dark' | 'auto'
     * @returns {'light'|'dark'}
     */
    function resolveEffective(mode) {
        if (mode === 'auto') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return mode === 'dark' ? 'dark' : 'light';
    }

    /**
     * Emit a theme change to all subscribers and dispatch a window event.
     * @param {string} mode
     * @param {string} effective
     */
    function emitThemeChange(mode, effective) {
        themeSubscribers.forEach(function (fn) {
            try { fn({ mode: mode, effective: effective }); }
            catch (e) { console.error('[app] theme subscriber threw:', e); }
        });
        window.dispatchEvent(new CustomEvent('app:theme', {
            detail: { mode: mode, effective: effective }
        }));
    }

    /**
     * Register the OS-level prefers-color-scheme listener once.
     * Fires only when current mode is 'auto'.
     */
    function ensureMediaQueryListener() {
        if (mediaQueryListenerRegistered) return;
        mediaQueryListenerRegistered = true;
        var mq = window.matchMedia('(prefers-color-scheme: dark)');
        var handler = function () {
            if (getTheme() === 'auto') {
                var effective = resolveEffective('auto');
                document.documentElement.setAttribute('data-theme', effective);
                emitThemeChange('auto', effective);
            }
        };
        if (mq.addEventListener) mq.addEventListener('change', handler);
        else if (mq.addListener) mq.addListener(handler); // Safari < 14
    }

    /**
     * Set the current theme mode. Persists to store and applies to DOM.
     * @param {'light'|'dark'|'auto'} mode
     */
    function setTheme(mode) {
        if (VALID_MODES.indexOf(mode) === -1) {
            console.warn('[app] Invalid theme mode:', mode, '— ignoring');
            return;
        }
        var effective = resolveEffective(mode);
        document.documentElement.setAttribute('data-theme', effective);
        if (window.store) window.store.set('theme', mode);
        ensureMediaQueryListener();
        emitThemeChange(mode, effective);
    }

    /**
     * Get the currently persisted theme mode.
     * @returns {'light'|'dark'|'auto'}
     */
    function getTheme() {
        if (window.store && typeof window.store.get === 'function') {
            return window.store.get('theme', 'light');
        }
        return 'light';
    }

    /**
     * Subscribe to theme changes.
     * @param {function({mode:string, effective:string}):void} fn
     * @returns {function():void} unsubscribe
     */
    function onThemeChange(fn) {
        if (typeof fn !== 'function') return function () {};
        themeSubscribers.add(fn);
        return function unsubscribe() { themeSubscribers.delete(fn); };
    }

    // ── Reset demo data ──────────────────────────────────────────────────────
    /**
     * Wipe all rms.* keys and re-seed demo data. Prompts user via modal.
     * Reloads the page on success.
     * @returns {Promise<void>}
     */
    async function resetDemoData() {
        var confirmed = false;
        if (window.modal && typeof window.modal.confirm === 'function') {
            confirmed = await window.modal.confirm({
                title: 'Reset Demo Data',
                message: 'Wipe all demo data and reload?',
                confirmText: 'Reset',
                cancelText: 'Cancel',
                danger: true
            });
        } else {
            confirmed = window.confirm('Wipe all demo data and reload?');
        }
        if (!confirmed) return;

        try {
            if (window.store && typeof window.store.reset === 'function') {
                window.store.reset();
            }
            if (window.seed && typeof window.seed.forceReseed === 'function') {
                await window.seed.forceReseed();
            }
            if (window.toast && typeof window.toast.success === 'function') {
                window.toast.success('Demo data reset');
            }
            // Small delay so toast is visible before reload
            setTimeout(function () { window.location.reload(); }, 400);
        } catch (err) {
            console.error('[app] resetDemoData failed:', err);
            if (window.toast && typeof window.toast.error === 'function') {
                window.toast.error('Reset failed: ' + err.message);
            }
        }
    }

    // ── Convenience: mark site-header as scrolled (for hero-less pages) ──────
    /**
     * Add `.is-scrolled` to the .site-header immediately.
     * Useful for pages without a hero section.
     */
    function markScrolled() {
        var header = document.querySelector('.site-header');
        if (header) header.classList.add('is-scrolled');
    }

    // ── Boot sequence: seed + DOMContentLoaded → ready Promise ───────────────
    var domReadyPromise = new Promise(function (resolve) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () { resolve(); }, { once: true });
        } else {
            resolve();
        }
    });

    var seedReadyPromise = (async function () {
        try {
            if (window.seed && typeof window.seed.ensureSeeded === 'function') {
                await window.seed.ensureSeeded();
            }
        } catch (err) {
            console.error('[app] Seed failed:', err);
        }
    })();

    var ready = Promise.all([domReadyPromise, seedReadyPromise]).then(function () {
        // Register media listener after boot (in case current mode is auto)
        ensureMediaQueryListener();
    });

    // ── Console banner (once per session) ────────────────────────────────────
    try {
        if (!sessionStorage.getItem('rms.banner')) {
            console.log(
                '%cKIYO COAST %c Resort Management System v' + VERSION,
                'font:bold 14px serif; color:#1F7A6F',
                'color:#6B6050'
            );
            sessionStorage.setItem('rms.banner', '1');
        }
    } catch (e) { /* sessionStorage may be blocked — silent */ }

    // ── Expose namespace ─────────────────────────────────────────────────────
    window.app = {
        ready: ready,
        setTheme: setTheme,
        getTheme: getTheme,
        onThemeChange: onThemeChange,
        resetDemoData: resetDemoData,
        markScrolled: markScrolled,
        version: VERSION
    };
})();
