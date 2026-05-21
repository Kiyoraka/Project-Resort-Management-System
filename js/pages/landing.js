/* ============================================================
   Landing page — Kiyo Coast
   Renders featured resorts, stalls carousel, reveal-on-scroll
   ============================================================ */

(async () => {
  if (window.app?.ready) {
    try { await window.app.ready; } catch (_) { /* continue */ }
  }
  initLanding();
})();

function initLanding() {
  renderFeaturedResorts();
  renderStallCarousel();
  initRevealOnScroll();
}

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

function shorten(str, max) {
  if (!str) return '';
  if (str.length <= max) return str;
  return str.slice(0, max).trimEnd() + '…';
}

function minRoomRate(rooms) {
  if (!Array.isArray(rooms) || rooms.length === 0) return null;
  const rates = rooms.map((r) => r.rate).filter((n) => typeof n === 'number');
  if (rates.length === 0) return null;
  return Math.min(...rates);
}

/* ---------- Featured Resorts ---------- */
function renderFeaturedResorts() {
  const mount = document.querySelector('[data-resort-grid]');
  if (!mount) return;
  if (!window.store) return;

  let resorts = [];
  try {
    resorts = window.store.list('resorts') || [];
  } catch (e) {
    resorts = [];
  }

  mount.innerHTML = '';

  if (resorts.length === 0) {
    mount.appendChild(
      el('p', { class: 'section__lead', text: 'Resorts coming soon.' })
    );
    return;
  }

  resorts.forEach((resort) => {
    const rate = minRoomRate(resort.rooms);
    const rateStr = rate != null ? `From RM${rate}/night` : 'Rates on request';
    const metaParts = [rateStr];
    if (resort.location) metaParts.push(resort.location);

    const mediaLink = el('a', {
      href: `resort.html?id=${encodeURIComponent(resort.id)}`,
      class: 'card__media-link',
    }, [
      el('img', {
        src: resort.cover || 'assets/img/placeholder.jpg',
        alt: resort.name || 'Resort',
        class: 'card__media',
        loading: 'lazy',
      }),
    ]);

    const title = el('h3', { class: 'card__title', text: resort.name || 'Untitled' });
    const meta = el('p', { class: 'card__meta', text: metaParts.join(' · ') });
    const body = el('p', {
      class: 'card__body',
      text: shorten(resort.description || '', 140),
    });
    const footer = el('div', { class: 'card__footer' }, [
      el('a', {
        href: `resort.html?id=${encodeURIComponent(resort.id)}`,
        class: 'btn btn--primary btn--sm',
        text: 'Visit Microsite',
      }),
    ]);

    const card = el('article', { class: 'card reveal' }, [mediaLink, title, meta, body, footer]);
    mount.appendChild(card);
  });
}

/* ---------- Coastal Stalls Carousel ---------- */
function renderStallCarousel() {
  const track = document.querySelector('[data-stall-carousel]');
  if (!track) return;
  if (!window.store) return;

  let stalls = [];
  try {
    stalls = window.store.list('stalls') || [];
  } catch (e) {
    stalls = [];
  }

  track.innerHTML = '';

  if (stalls.length === 0) {
    track.appendChild(
      el('p', { class: 'section__lead', text: 'Stalls coming soon.' })
    );
    return;
  }

  stalls.forEach((stall) => {
    const metaParts = [];
    if (stall.category) metaParts.push(stall.category);
    if (stall.hours) metaParts.push(stall.hours);

    const link = el('a', { href: `stall.html?id=${encodeURIComponent(stall.id)}` }, [
      el('img', {
        src: stall.cover || 'assets/img/placeholder.jpg',
        alt: stall.name || 'Stall',
        class: 'card__media card__media--square',
        loading: 'lazy',
      }),
    ]);

    const title = el('h3', { class: 'card__title', text: stall.name || 'Untitled' });
    const meta = el('p', { class: 'card__meta', text: metaParts.join(' · ') });
    const footer = el('div', { class: 'card__footer' }, [
      el('a', {
        href: `stall.html?id=${encodeURIComponent(stall.id)}`,
        class: 'btn btn--ghost btn--sm',
        text: 'Visit',
      }),
    ]);

    const card = el('article', { class: 'card' }, [link, title, meta, footer]);
    track.appendChild(card);
  });

  // Wire prev/next buttons
  const prev = document.querySelector('.landing__carousel-btn--prev');
  const next = document.querySelector('.landing__carousel-btn--next');

  const getStep = () => {
    const firstCard = track.querySelector('.card');
    if (!firstCard) return 320;
    const gap = 16; // var(--space-4)
    return firstCard.offsetWidth + gap;
  };

  if (prev) {
    prev.addEventListener('click', () => {
      track.scrollBy({ left: -getStep(), behavior: 'smooth' });
    });
  }
  if (next) {
    next.addEventListener('click', () => {
      track.scrollBy({ left: getStep(), behavior: 'smooth' });
    });
  }
}

/* ---------- Reveal-on-scroll ---------- */
function initRevealOnScroll() {
  // Mark sections to reveal
  const sectionsToReveal = [
    '.landing__about',
    '.landing__resorts',
    '.landing__stalls',
    '.landing__parking-cta',
  ];
  sectionsToReveal.forEach((sel) => {
    const node = document.querySelector(sel);
    if (node) node.classList.add('reveal');
  });

  const targets = document.querySelectorAll('.reveal');
  if (targets.length === 0) return;

  // Fallback: no IntersectionObserver — reveal everything immediately
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
