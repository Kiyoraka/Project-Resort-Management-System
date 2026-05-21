/* ============================================================
   Resorts listing page — Kiyo Coast
   Renders resort cards with live filter + search
   ============================================================ */

(async () => {
  if (window.app?.ready) {
    try { await window.app.ready; } catch (_) { /* continue */ }
  }
  initResortsPage();
})();

const state = { filter: 'all', search: '', resorts: [] };

/* ---------- helpers ---------- */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const key in attrs) {
    if (key === 'class') node.className = attrs[key];
    else if (key === 'text') node.textContent = attrs[key];
    else if (key.startsWith('data-')) node.setAttribute(key, attrs[key]);
    else node.setAttribute(key, attrs[key]);
  }
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null) return;
    if (typeof c === 'string') node.appendChild(document.createTextNode(c));
    else node.appendChild(c);
  });
  return node;
}

function shorten(str, max) {
  if (!str) return '';
  return str.length <= max ? str : str.slice(0, max).trimEnd() + '…';
}

function minRoomRate(rooms) {
  if (!Array.isArray(rooms) || rooms.length === 0) return null;
  const rates = rooms.map((r) => r.rate).filter((n) => typeof n === 'number');
  return rates.length === 0 ? null : Math.min(...rates);
}

function debounce(fn, wait) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

/* ---------- init ---------- */
function initResortsPage() {
  if (!window.store) return;
  try {
    state.resorts = window.store.list('resorts') || [];
  } catch (e) {
    state.resorts = [];
  }
  wireFilterChips();
  wireSearchInput();
  render();
}

function wireFilterChips() {
  const chips = document.querySelectorAll('[data-filter]');
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      state.filter = chip.getAttribute('data-filter') || 'all';
      chips.forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      render();
    });
  });
}

function wireSearchInput() {
  const input = document.querySelector('[data-resort-search]');
  if (!input) return;
  const handler = debounce((e) => {
    state.search = (e.target.value || '').trim().toLowerCase();
    render();
  }, 300);
  input.addEventListener('input', handler);
}

/* ---------- filtering ---------- */
function applyFilters(resorts) {
  return resorts.filter((r) => {
    if (state.filter === 'beachfront') {
      const amenities = Array.isArray(r.amenities) ? r.amenities : [];
      if (!amenities.includes('Beach access')) return false;
    }
    if (state.search) {
      const name = (r.name || '').toLowerCase();
      const loc = (r.location || '').toLowerCase();
      if (!name.includes(state.search) && !loc.includes(state.search)) return false;
    }
    return true;
  });
}

/* ---------- render ---------- */
function render() {
  const grid = document.querySelector('[data-resort-grid]');
  const empty = document.querySelector('[data-resort-empty]');
  const countNode = document.querySelector('[data-resort-count]');
  if (!grid) return;

  const filtered = applyFilters(state.resorts);
  if (countNode) countNode.textContent = String(filtered.length);

  grid.innerHTML = '';

  if (filtered.length === 0) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  filtered.forEach((resort) => grid.appendChild(buildCard(resort)));
  revealCards(grid);
}

function buildCard(resort) {
  const rate = minRoomRate(resort.rooms);
  const roomCount = Array.isArray(resort.rooms) ? resort.rooms.length : 0;
  const metaParts = [];
  if (resort.location) metaParts.push(resort.location);
  if (rate != null) metaParts.push(`From RM${rate}/night`);
  if (roomCount > 0) metaParts.push(`${roomCount} room types`);

  const href = `resort.html?id=${encodeURIComponent(resort.id)}`;

  const mediaLink = el('a', { href, class: 'card__media-link' }, [
    el('img', {
      src: resort.cover || 'assets/img/placeholder.jpg',
      alt: resort.name || 'Resort',
      class: 'card__media',
      loading: 'lazy',
    }),
  ]);

  const amenities = Array.isArray(resort.amenities) ? resort.amenities.slice(0, 4) : [];
  const amenityChips = amenities.map((a) =>
    el('span', { class: 'badge badge--muted', text: a })
  );

  return el('article', { class: 'card reveal' }, [
    mediaLink,
    el('h2', { class: 'card__title', text: resort.name || 'Untitled' }),
    el('p', { class: 'card__meta', text: metaParts.join(' · ') }),
    el('p', { class: 'card__body', text: shorten(resort.description || '', 180) }),
    el('div', { class: 'cluster card__amenities' }, amenityChips),
    el('div', { class: 'card__footer' }, [
      el('a', { href, class: 'btn btn--primary btn--sm', text: 'Visit Microsite' }),
    ]),
  ]);
}

/* ---------- Reveal-on-scroll ---------- */
function revealCards(scope) {
  const targets = scope.querySelectorAll('.reveal:not(.is-visible)');
  if (targets.length === 0) return;
  if (!('IntersectionObserver' in window)) {
    targets.forEach((t) => t.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
  );
  targets.forEach((t) => observer.observe(t));
}
