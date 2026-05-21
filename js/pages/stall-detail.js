/* ============================================================
   Stall detail microsite — Kiyo Coast
   Per-stall page with 3 tabs (Home / About / Contact),
   product grid with stock badges, contact form (mock).
   URL: stall.html?id=stall-1
   ============================================================ */

(async () => {
  if (window.app && window.app.ready) {
    try { await window.app.ready; } catch (_) { /* continue */ }
  }
  initStallDetailPage();
})();

/* ---------- DOM helper ---------- */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const key in attrs) {
    if (attrs[key] == null) continue;
    if (key === 'class') node.className = attrs[key];
    else if (key === 'text') node.textContent = attrs[key];
    else if (key === 'html') node.innerHTML = attrs[key];
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

/* ---------- init ---------- */
function initStallDetailPage() {
  if (!window.store) return;

  const id = window.utils.getQueryParam('id');
  if (!id) {
    notifyAndRedirect('No stall specified.');
    return;
  }

  const stall = window.store.find('stalls', id);
  if (!stall) {
    notifyAndRedirect('Stall not found.');
    return;
  }

  const resort = stall.resortId ? window.store.find('resorts', stall.resortId) : null;
  const products = window.store.where('products', { stallId: stall.id }) || [];

  populateHero(stall, resort);
  populateHomePanel(stall, products);
  populateAboutPanel(stall, resort);
  populateContactPanel(stall);

  wireTabs();
  wireContactForm();
}

function notifyAndRedirect(msg) {
  try {
    if (window.toast && typeof window.toast.error === 'function') {
      window.toast.error(msg);
    }
  } catch (_) { /* ignore */ }
  setTimeout(() => { window.location.href = 'stalls.html'; }, 700);
}

/* ---------- Hero + breadcrumb + title ---------- */
function populateHero(stall, resort) {
  const cover = document.querySelector('[data-stall-cover]');
  if (cover) {
    cover.src = stall.cover || 'assets/img/placeholder.jpg';
    cover.alt = stall.name || 'Stall';
  }

  const title = document.querySelector('[data-stall-title]');
  if (title) title.textContent = stall.name || 'Untitled stall';

  const nameSpan = document.querySelector('[data-stall-name]');
  if (nameSpan) nameSpan.textContent = stall.name || 'Stall';

  const metaParts = [];
  if (stall.category) metaParts.push(stall.category);
  if (resort && resort.name) metaParts.push('at ' + resort.name);
  const metaEl = document.querySelector('[data-stall-meta]');
  if (metaEl) metaEl.textContent = metaParts.join(' · ');

  const titleTag = document.querySelector('[data-stall-title-tag]');
  if (titleTag) titleTag.textContent = (stall.name || 'Stall') + ' - KIYO COAST';
}

/* ---------- HOME panel ---------- */
function populateHomePanel(stall, products) {
  const tagline = document.querySelector('[data-stall-tagline]');
  if (tagline) tagline.textContent = stall.tagline || '';

  const desc = document.querySelector('[data-stall-description]');
  if (desc) desc.textContent = stall.description || '';

  const hours = document.querySelector('[data-stall-hours]');
  if (hours) hours.textContent = stall.hours || 'See contact tab';

  const grid = document.querySelector('[data-stall-products]');
  if (!grid) return;
  grid.innerHTML = '';

  if (!products.length) {
    grid.appendChild(el('p', { class: 'microsite__meta', text: 'No products listed yet.' }));
    return;
  }

  products.forEach((p) => grid.appendChild(buildProductCard(p)));
}

function buildProductCard(p) {
  const img = el('img', {
    src: p.image || 'assets/img/placeholder.jpg',
    alt: p.name || 'Product',
    class: 'card__media card__media--square',
    loading: 'lazy',
  });
  const title = el('h3', { class: 'card__title', text: p.name || 'Untitled' });
  const meta = el('p', { class: 'card__meta', text: p.category || '' });
  const price = el('p', {
    class: 'product-card__price',
    text: window.utils.formatMYR(p.price || 0),
  });

  const stockNode = el('p', { class: 'product-card__stock' }, [buildStockBadge(p.qty)]);

  const body = el('p', { class: 'card__body', text: p.description || '' });

  return el('article', { class: 'card product-card' }, [
    img, title, meta, price, stockNode, body,
  ]);
}

function buildStockBadge(qty) {
  const q = Number(qty);
  if (!Number.isFinite(q) || q === 0) {
    return el('span', { class: 'badge badge--danger', text: 'Out of stock' });
  }
  if (q < 5) {
    return el('span', { class: 'badge badge--warn', text: 'Low: ' + q + ' left' });
  }
  return el('span', { class: 'badge badge--ok', text: 'In stock' });
}

/* ---------- ABOUT panel ---------- */
function populateAboutPanel(stall, resort) {
  const story = document.querySelector('[data-stall-about-story]');
  if (story) story.textContent = stall.description || '';

  const link = document.querySelector('[data-stall-resort-link]');
  if (link) {
    if (resort) {
      link.href = 'resort.html?id=' + encodeURIComponent(resort.id);
      link.textContent = resort.name || 'Parent resort';
    } else {
      link.removeAttribute('href');
      link.textContent = 'Unaffiliated stall';
    }
  }
}

/* ---------- CONTACT panel ---------- */
function populateContactPanel(stall) {
  const phone = document.querySelector('[data-contact-phone]');
  if (phone) {
    if (stall.phone) {
      phone.href = 'tel:' + stall.phone.replace(/\s+/g, '');
      phone.textContent = stall.phone;
    } else {
      phone.removeAttribute('href');
      phone.textContent = '—';
    }
  }

  const email = document.querySelector('[data-contact-email]');
  if (email) {
    if (stall.email) {
      email.href = 'mailto:' + stall.email;
      email.textContent = stall.email;
    } else {
      email.removeAttribute('href');
      email.textContent = '—';
    }
  }

  const hours = document.querySelector('[data-contact-hours]');
  if (hours) hours.textContent = stall.hours || '—';
}

/* ---------- Tab switching ---------- */
function wireTabs() {
  const tabs = document.querySelectorAll('[data-tab]');
  const panels = document.querySelectorAll('[data-panel]');
  if (!tabs.length || !panels.length) return;

  function activate(name, pushHash) {
    let matched = false;
    tabs.forEach((t) => {
      const isActive = t.getAttribute('data-tab') === name;
      t.classList.toggle('is-active', isActive);
      t.setAttribute('aria-selected', isActive ? 'true' : 'false');
      if (isActive) matched = true;
    });
    if (!matched) return;
    panels.forEach((p) => {
      const isActive = p.getAttribute('data-panel') === name;
      p.classList.toggle('is-active', isActive);
      if (isActive) p.removeAttribute('hidden');
      else p.setAttribute('hidden', '');
    });
    if (pushHash) {
      try {
        history.replaceState(null, '', '#' + name);
      } catch (_) { /* ignore */ }
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const name = tab.getAttribute('data-tab');
      if (name) activate(name, true);
    });
  });

  // Restore from hash on load
  const initial = (window.location.hash || '').replace('#', '');
  if (initial && ['home', 'about', 'contact'].indexOf(initial) !== -1) {
    activate(initial, false);
  }

  // Cross-tab hash navigation
  window.addEventListener('hashchange', () => {
    const next = (window.location.hash || '').replace('#', '');
    if (next && ['home', 'about', 'contact'].indexOf(next) !== -1) {
      activate(next, false);
    }
  });
}

/* ---------- Contact form (mock) ---------- */
function wireContactForm() {
  const form = document.querySelector('[data-contact-form]');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const email = String(data.get('email') || '').trim();
    const message = String(data.get('message') || '').trim();

    if (!name || !email || !message) {
      if (window.toast && window.toast.error) {
        window.toast.error('Please fill in all fields.');
      }
      return;
    }

    if (window.toast && window.toast.success) {
      window.toast.success('Message sent — the stall owner will be in touch.');
    }
    form.reset();
  });
}
