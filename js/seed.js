/**
 * seed.js — First-visit demo data seeder for Resort Management System.
 *
 * Loads /data/seed-*.json files into localStorage via window.store on first
 * visit. Denormalizes nested stall.products arrays into a top-level
 * rms.products collection per store.js spec.
 *
 * Exposes: window.seed = { ensureSeeded, forceReseed, isSeeded }
 *
 * Auto-runs on DOMContentLoaded via utils.onReady().
 */
(function () {
  'use strict';

  const SEED_FILES = [
    { coll: 'users',    path: 'data/seed-users.json' },
    { coll: 'resorts',  path: 'data/seed-resorts.json' },
    { coll: 'stalls',   path: 'data/seed-stalls.json' },
    { coll: 'parking',  path: 'data/seed-parking.json' },
    { coll: 'bookings', path: 'data/seed-bookings.json' },
    { coll: 'messages', path: 'data/seed-messages.json' }
  ];

  /**
   * Fetch a JSON file via path-relative request.
   * @param {string} path
   * @returns {Promise<any>}
   */
  async function fetchJson(path) {
    const res = await fetch(path);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${path}: HTTP ${res.status}`);
    }
    return res.json();
  }

  /**
   * Core seeding routine — parallel-fetches all seed files, denormalizes
   * stall products into a separate rms.products collection, then writes
   * everything to localStorage and marks rms.seeded = true.
   * @returns {Promise<void>}
   */
  async function runSeed() {
    try {
      const datasets = await Promise.all(
        SEED_FILES.map(({ path }) => fetchJson(path))
      );

      const dataByColl = {};
      SEED_FILES.forEach((entry, i) => {
        dataByColl[entry.coll] = datasets[i];
      });

      // Denormalize stall.products into top-level rms.products collection.
      const stallsData = dataByColl.stalls || [];
      const allProducts = [];
      stallsData.forEach((stall) => {
        if (Array.isArray(stall.products)) {
          stall.products.forEach((p) => {
            allProducts.push({ ...p, stallId: stall.id });
          });
        }
      });
      // Strip the products field from stalls to avoid duplication.
      const stallsClean = stallsData.map(({ products, ...rest }) => rest);

      // Write all collections.
      window.store.replace('users',    dataByColl.users    || []);
      window.store.replace('resorts',  dataByColl.resorts  || []);
      window.store.replace('stalls',   stallsClean);
      window.store.replace('parking',  dataByColl.parking  || []);
      window.store.replace('bookings', dataByColl.bookings || []);
      window.store.replace('messages', dataByColl.messages || []);
      window.store.replace('products', allProducts);

      window.store.set('seeded', true);

      const counts = {
        users:    (dataByColl.users    || []).length,
        resorts:  (dataByColl.resorts  || []).length,
        stalls:   stallsClean.length,
        parking:  (dataByColl.parking  || []).length,
        bookings: (dataByColl.bookings || []).length,
        messages: (dataByColl.messages || []).length,
        products: allProducts.length
      };
      console.log('[seed] Demo data loaded:', counts);
    } catch (err) {
      console.error('[seed] Failed to seed demo data:', err);
      if (window.utils && typeof window.utils.toast === 'function') {
        window.utils.toast('error', 'Failed to seed demo data — try refreshing');
      }
    }
  }

  /**
   * Ensure demo data is seeded. No-op if rms.seeded is already true.
   * @returns {Promise<void>}
   */
  async function ensureSeeded() {
    if (window.store && window.store.get('seeded') === true) {
      return;
    }
    await runSeed();
  }

  /**
   * Unconditional re-seed — clears the seeded flag and re-runs seeding.
   * Used by the Reset Demo Data button.
   * @returns {Promise<void>}
   */
  async function forceReseed() {
    if (window.store && typeof window.store.remove === 'function') {
      window.store.remove('seeded');
    } else if (window.store) {
      // Fallback: explicitly unset.
      window.store.set('seeded', false);
    }
    await runSeed();
  }

  /**
   * @returns {boolean} Whether demo data has been seeded.
   */
  function isSeeded() {
    return !!(window.store && window.store.get('seeded') === true);
  }

  window.seed = {
    ensureSeeded,
    forceReseed,
    isSeeded
  };

  // Auto-run on DOMContentLoaded.
  if (window.utils && typeof window.utils.onReady === 'function') {
    window.utils.onReady(() => {
      window.seed.ensureSeeded();
    });
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.seed.ensureSeeded();
    });
  } else {
    window.seed.ensureSeeded();
  }
})();
