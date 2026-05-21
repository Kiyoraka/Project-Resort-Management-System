/* ============================================================
   Stalls page — Kiyo Coast
   Public stall listing with category filter
   ============================================================ */

(async () => {
  if (window.app?.ready) {
    try { await window.app.ready; } catch (_) { /* continue */ }
  }
  initStallsPage();
})();

/* ---------- state ---------- */
const state = {
  activeCat: 'all',
  stalls: [],
};

/* ---------- helpers ---------- */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const key in attrs) {
    if (key === 'class') node.className = attrs[key];
    else if (key === 'text') node.textContent = attrs[key];
    else if (key === 'html') node.innerHTML = attrs[key];
    else if (key.startsWith('data-')) node.setAttribute(key, attrs[key]);
    else if (key === 'aria') {
      for (const a in attrs.aria) node.setAttribute('aria-' + a, attrs.aria[a]);
    } else {
      node.setAttribute(key, attrs[key]);
    }
  }
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null) return;
    if (typeof c === 'string') node.appendChild(document.createTextNode(c));
    else node.appendChild(c);
  });
  return node;
}

/* ---------- init ---------- */
function initStallsPage() {
  if (!window.store) return;

  try {
    state.stalls = window.store.list('stalls') || [];
  } catch (e) {
    state.stalls = [];
  }

  renderGrid();
  wireFilters();
}

/* ---------- filter wiring ---------- */
function wireFilters() {
  const chips = document.querySelectorAll('.stalls__filters .chip[data-cat]');
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const cat = chip.getAttribute('data-cat') || 'all';
      state.activeCat = cat;
      chips.forEach((c) => c.classList.toggle('is-active', c === chip));
      renderGrid();
    });
  });
}

/* ---------- render grid ---------- */
function renderGrid() {
  const mount = document.querySelector('[data-stall-grid]');
  const empty = document.querySelector('[data-stall-empty]');
  if (!mount) return;

  const filtered = state.activeCat === 'all'
    ? state.stalls
    : state.stalls.filter((s) => s.category === state.activeCat);

  mount.innerHTML = '';

  if (filtered.length === 0) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  filtered.forEach((stall) => {
    mount.appendChild(buildCard(stall));
  });
}

/* ---------- card builder ---------- */
function buildCard(stall) {
  const id = encodeURIComponent(stall.id);

  const mediaLink = el('a', { href: `stall.html?id=${id}` }, [
    el('img', {
      class: 'card__media card__media--square',
      src: stall.cover || 'assets/img/placeholder.jpg',
      alt: stall.name || 'Stall',
      loading: 'lazy',
    }),
  ]);

  const badge = el('span', {
    class: 'badge badge--muted',
    text: stall.category || 'General',
  });
  const title = el('h2', { class: 'card__title', text: stall.name || 'Untitled' });
  const meta = el('p', { class: 'card__meta', text: stall.hours || '' });
  const body = el('p', { class: 'card__body', text: stall.tagline || '' });
  const footer = el('div', { class: 'card__footer' }, [
    el('a', {
      href: `stall.html?id=${id}`,
      class: 'btn btn--ghost btn--sm',
      text: 'Visit Stall',
    }),
  ]);

  return el('article', { class: 'card' }, [mediaLink, badge, title, meta, body, footer]);
}
