/**
 * parking-map.js — Reusable SVG parking slot grid renderer.
 *
 * Renders a responsive 4-row x 6-col grid of parking slots as inline SVG.
 * Shared by parking.html (read-only mini map), user/parking.html (interactive
 * booking), and admin/parking.html (overlay + maintenance toggle).
 *
 * Slot status precedence (high to low):
 *   1. opts.statusOverrides[slotId]   caller-forced state
 *   2. slot.status === 'maintenance'  slot-level
 *   3. Active parking booking today   (confirmed/pending covering today)
 *   4. 'available'                    default
 *
 * Public API — window.parkingMap:
 *   render(target, opts)   -> { refresh, setSelected, getStats }
 *   statusForSlot(slot, bookings, todayISO?)
 *
 * @module components/parking-map
 */
(function () {
  'use strict';

  // --- Geometry constants (SVG user units) -------------------------------
  var SLOT_W = 80, SLOT_H = 60, GAP = 8, PAD = 12;
  var COLS = 6, ROWS = 4;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var ACTIVE_BOOKING_STATUSES = ['confirmed', 'pending'];

  // --- Internal helpers --------------------------------------------------

  function _resolveTarget(target) {
    if (!target) return null;
    if (typeof target === 'string') return document.querySelector(target);
    return target.nodeType === 1 ? target : null;
  }

  /** Format Date as local YYYY-MM-DD. */
  function _toISODate(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  /** Test whether todayISO falls within booking [checkIn, checkOut] (date-only). */
  function _coversToday(b, todayISO) {
    if (!b || !b.checkIn || !b.checkOut) return false;
    return todayISO >= String(b.checkIn).slice(0, 10) &&
           todayISO <= String(b.checkOut).slice(0, 10);
  }

  /**
   * Derive base status for a slot from its record + active bookings.
   * Ignores overrides and selection — caller composes those on top.
   * @returns {'available'|'occupied'|'maintenance'}
   */
  function statusForSlot(slot, bookings, todayISO) {
    if (!slot) return 'available';
    if (slot.status === 'maintenance') return 'maintenance';
    var today = todayISO || _toISODate(new Date());
    var list = Array.isArray(bookings) ? bookings : [];
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (!b || b.type !== 'parking' || b.slotId !== slot.id) continue;
      if (ACTIVE_BOOKING_STATUSES.indexOf(b.status) === -1) continue;
      if (_coversToday(b, today)) return 'occupied';
    }
    return 'available';
  }

  /** Compose final visual status: overrides > selection > base. */
  function _composeStatus(slot, bookings, overrides, selectedId, todayISO) {
    if (overrides && Object.prototype.hasOwnProperty.call(overrides, slot.id)) {
      return overrides[slot.id];
    }
    if (selectedId && slot.id === selectedId) return 'selected';
    return statusForSlot(slot, bookings, todayISO);
  }

  function _buildSvgRoot() {
    var w = PAD * 2 + COLS * SLOT_W + (COLS - 1) * GAP;
    var h = PAD * 2 + ROWS * SLOT_H + (ROWS - 1) * GAP;
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Parking slot grid');
    return svg;
  }

  function _buildSlotNode(slot, status, interactive) {
    var col0 = Math.max(0, (slot.col || 1) - 1);
    var row0 = Math.max(0, (slot.row || 1) - 1);
    var x = PAD + col0 * (SLOT_W + GAP);
    var y = PAD + row0 * (SLOT_H + GAP);

    var g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'parking-slot parking-slot--' + status +
      (interactive ? ' parking-slot--interactive' : ''));
    g.setAttribute('data-slot-id', slot.id);
    g.setAttribute('data-slot-code', slot.code || '');
    g.setAttribute('data-status', status);
    g.setAttribute('transform', 'translate(' + x + ',' + y + ')');

    var rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('width', SLOT_W);
    rect.setAttribute('height', SLOT_H);
    rect.setAttribute('rx', 6);
    rect.setAttribute('ry', 6);
    g.appendChild(rect);

    var text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', SLOT_W / 2);
    text.setAttribute('y', SLOT_H / 2);
    text.textContent = slot.code || slot.id || '';
    g.appendChild(text);

    if (interactive) {
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', 'Slot ' + (slot.code || slot.id) + ' — ' + status);
    }
    return g;
  }

  function _sortSlots(slots) {
    return slots.slice().sort(function (a, b) {
      var ra = a.row || 0, rb = b.row || 0;
      return ra !== rb ? ra - rb : (a.col || 0) - (b.col || 0);
    });
  }

  function _computeStats(slots, bookings, overrides, todayISO) {
    var stats = { total: slots.length, available: 0, occupied: 0, maintenance: 0 };
    for (var i = 0; i < slots.length; i++) {
      // Stats ignore selection — selection is a UI overlay, not real state.
      var s = _composeStatus(slots[i], bookings, overrides, null, todayISO);
      if (s === 'available' || s === 'occupied' || s === 'maintenance') stats[s]++;
      else stats.occupied++; // unknown override -> treat as occupied (safe).
    }
    return stats;
  }

  // --- Public render -----------------------------------------------------

  /**
   * Render an SVG slot grid into target. Returns an API for live updates.
   * @param {HTMLElement|string} target
   * @param {Object} [opts]
   * @returns {{refresh:Function, setSelected:Function, getStats:Function}|null}
   */
  function render(target, opts) {
    var el = _resolveTarget(target);
    if (!el) { console.warn('[parking-map] target not found:', target); return null; }

    var state = {
      slots: [], bookings: [], interactive: false, onSelect: null,
      selectedSlotId: null, overrides: {}, todayISO: _toISODate(new Date())
    };

    function _ingest(next) {
      next = next || {};
      if (Array.isArray(next.slots)) state.slots = _sortSlots(next.slots);
      if (Array.isArray(next.bookings)) state.bookings = next.bookings;
      if (typeof next.interactive === 'boolean') state.interactive = next.interactive;
      if (typeof next.onSelect === 'function') state.onSelect = next.onSelect;
      if (Object.prototype.hasOwnProperty.call(next, 'selectedSlotId')) {
        state.selectedSlotId = next.selectedSlotId || null;
      }
      if (next.statusOverrides && typeof next.statusOverrides === 'object') {
        state.overrides = next.statusOverrides;
      }
    }

    function _attachInteractive(node, slot) {
      node.addEventListener('click', function () {
        if (typeof state.onSelect === 'function') state.onSelect(slot);
      });
      node.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          if (typeof state.onSelect === 'function') state.onSelect(slot);
        }
      });
    }

    function _draw() {
      el.innerHTML = '';
      var svg = _buildSvgRoot();
      for (var i = 0; i < state.slots.length; i++) {
        var slot = state.slots[i];
        var status = _composeStatus(slot, state.bookings, state.overrides,
                                    state.selectedSlotId, state.todayISO);
        var node = _buildSlotNode(slot, status, state.interactive);
        if (state.interactive) _attachInteractive(node, slot);
        svg.appendChild(node);
      }
      el.appendChild(svg);
    }

    _ingest(opts);
    _draw();

    return {
      refresh: function (nextOpts) { _ingest(nextOpts); _draw(); },
      setSelected: function (slotId) { state.selectedSlotId = slotId || null; _draw(); },
      getStats: function () {
        return _computeStats(state.slots, state.bookings, state.overrides, state.todayISO);
      }
    };
  }

  // --- Export ------------------------------------------------------------
  window.parkingMap = { render: render, statusForSlot: statusForSlot };
})();
