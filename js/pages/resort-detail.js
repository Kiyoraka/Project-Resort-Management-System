/* ============================================================
   Resort Detail microsite — Kiyo Coast
   4 tabs (Home / Booking / About / Contact) + booking flow
   with date conflict check. URL hash sync for active tab.
   ============================================================ */

(async () => {
  if (window.app?.ready) {
    try { await window.app.ready; } catch (_) { /* continue */ }
  }
  initResortDetail();
})();

// ---------------------------------------------------------------
// Tiny DOM helper (local, mirrors landing.js convention)
// ---------------------------------------------------------------
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const key in attrs) {
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

// In-page state for booking flow
const state = {
  resort: null,
  selectedRoomId: null
};

// ---------------------------------------------------------------
// Entry
// ---------------------------------------------------------------
function initResortDetail() {
  const id = window.utils.getQueryParam('id');
  if (!id) {
    window.toast && window.toast.error('Resort not specified');
    setTimeout(() => { window.location.href = 'resorts.html'; }, 800);
    return;
  }

  const resort = window.store.find('resorts', id);
  if (!resort) {
    window.toast && window.toast.error('Resort not found');
    setTimeout(() => { window.location.href = 'resorts.html'; }, 800);
    return;
  }
  state.resort = resort;

  populateHero(resort);
  renderHome(resort);
  renderBooking(resort);
  renderAbout(resort);
  renderContact(resort);

  initTabs();
  initHashRouting();
}

// ---------------------------------------------------------------
// Hero + breadcrumb + page title
// ---------------------------------------------------------------
function populateHero(resort) {
  document.title = `${resort.name} - KIYO COAST`;
  const titleTag = document.querySelector('[data-resort-title-tag]');
  if (titleTag) titleTag.textContent = document.title;

  const cover = document.querySelector('[data-resort-cover]');
  if (cover) {
    cover.src = resort.cover || '';
    cover.alt = `${resort.name} cover image`;
  }

  const nameEl = document.querySelector('[data-resort-name]');
  if (nameEl) nameEl.textContent = resort.name;

  const titleEl = document.querySelector('[data-resort-title]');
  if (titleEl) titleEl.textContent = resort.name;

  const locEl = document.querySelector('[data-resort-location]');
  if (locEl) locEl.textContent = resort.location || '';
}

// ---------------------------------------------------------------
// Tab switching + URL hash sync
// ---------------------------------------------------------------
function initTabs() {
  const tabs = window.utils.qsa('.microsite__tab');
  const panels = window.utils.qsa('.microsite__panel');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');
      activateTab(target, tabs, panels);
      // Write hash without scroll-jump
      const url = new URL(window.location.href);
      url.hash = target;
      window.history.replaceState({}, '', url.toString());
    });
  });

  // Hook home Book Now button
  const gotoBooking = document.querySelector('[data-action="goto-booking"]');
  if (gotoBooking) {
    gotoBooking.addEventListener('click', () => {
      activateTab('booking', tabs, panels);
      const url = new URL(window.location.href);
      url.hash = 'booking';
      window.history.replaceState({}, '', url.toString());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}

function activateTab(name, tabs, panels) {
  tabs.forEach((t) => {
    const on = t.getAttribute('data-tab') === name;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  panels.forEach((p) => {
    const on = p.getAttribute('data-panel') === name;
    p.classList.toggle('is-active', on);
  });
}

function initHashRouting() {
  const validTabs = ['home', 'booking', 'about', 'contact'];
  const raw = (window.location.hash || '').replace(/^#/, '');
  if (validTabs.includes(raw)) {
    const tabs = window.utils.qsa('.microsite__tab');
    const panels = window.utils.qsa('.microsite__panel');
    activateTab(raw, tabs, panels);
  }
}

// ---------------------------------------------------------------
// HOME tab
// ---------------------------------------------------------------
function renderHome(resort) {
  const tagline = document.querySelector('[data-resort-tagline]');
  if (tagline) tagline.textContent = resort.tagline || '';

  const desc = document.querySelector('[data-resort-description]');
  if (desc) desc.textContent = resort.description || '';

  const amenitiesMount = document.querySelector('[data-resort-amenities]');
  if (amenitiesMount) {
    amenitiesMount.innerHTML = '';
    (resort.amenities || []).forEach((a) => {
      amenitiesMount.appendChild(
        el('span', { class: 'badge badge--muted', text: a })
      );
    });
  }

  const roomsMount = document.querySelector('[data-resort-rooms]');
  if (roomsMount) {
    roomsMount.innerHTML = '';
    (resort.rooms || []).forEach((room) => {
      roomsMount.appendChild(buildRoomCard(room, false));
    });
  }
}

function buildRoomCard(room, selectable) {
  const card = el('article', {
    class: 'card card--room',
    'data-room-id': room.id
  });
  if (room.image) {
    const fig = el('figure', { class: 'card__media' });
    fig.appendChild(el('img', { src: room.image, alt: room.type || 'Room' }));
    card.appendChild(fig);
  }
  const body = el('div', { class: 'card__body' });
  body.appendChild(el('h3', { class: 'card__title', text: room.type || 'Room' }));
  body.appendChild(
    el('p', {
      class: 'card__meta',
      text: `${window.utils.formatMYR(room.rate)} / night · Sleeps ${room.capacity || 2}`
    })
  );
  if (room.description) {
    body.appendChild(el('p', { class: 'card__desc', text: room.description }));
  }
  if (selectable) {
    body.appendChild(
      el('button', {
        class: 'btn btn--secondary btn--sm',
        type: 'button',
        'data-select-room': room.id,
        text: 'Select'
      })
    );
  }
  card.appendChild(body);
  return card;
}

// ---------------------------------------------------------------
// BOOKING tab
// ---------------------------------------------------------------
function renderBooking(resort) {
  const mount = document.querySelector('[data-booking-rooms]');
  if (mount) {
    mount.innerHTML = '';
    (resort.rooms || []).forEach((room) => {
      const card = buildRoomCard(room, true);
      card.addEventListener('click', () => {
        selectRoom(room.id);
      });
      mount.appendChild(card);
    });
  }

  // Date min constraints
  const today = new Date().toISOString().slice(0, 10);
  const checkin = document.querySelector('[data-checkin]');
  const checkout = document.querySelector('[data-checkout]');
  if (checkin) checkin.min = today;
  if (checkout) checkout.min = today;

  // Wire up date-range component if available, else fall back
  if (window.dateRange && typeof window.dateRange.attach === 'function' && checkin && checkout) {
    try {
      window.dateRange.attach(checkin, checkout, { minToday: true });
    } catch (_) { /* fallback below covers it */ }
  }

  // Live recalc on any input change
  const inputs = [
    checkin,
    checkout,
    document.querySelector('[data-adults]'),
    document.querySelector('[data-children]')
  ].filter(Boolean);
  inputs.forEach((inp) => {
    inp.addEventListener('change', () => {
      // Enforce checkout >= checkin+1 manually as a safety net
      if (checkin && checkout && checkin.value) {
        const nextDay = window.utils.addDays(new Date(checkin.value), 1)
          .toISOString()
          .slice(0, 10);
        if (!checkout.value || checkout.value <= checkin.value) {
          checkout.min = nextDay;
        } else {
          checkout.min = nextDay;
        }
      }
      updateSummary();
    });
    inp.addEventListener('input', updateSummary);
  });

  // Confirm booking
  const confirmBtn = document.querySelector('[data-action="confirm-booking"]');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', confirmBooking);
  }

  updateSummary();
}

function selectRoom(roomId) {
  state.selectedRoomId = roomId;
  window.utils.qsa('[data-booking-rooms] .card').forEach((c) => {
    c.classList.toggle(
      'is-selected',
      c.getAttribute('data-room-id') === roomId
    );
  });
  updateSummary();
}

function getBookingInputs() {
  return {
    checkIn: document.querySelector('[data-checkin]')?.value || '',
    checkOut: document.querySelector('[data-checkout]')?.value || '',
    adults: parseInt(document.querySelector('[data-adults]')?.value || '0', 10),
    children: parseInt(document.querySelector('[data-children]')?.value || '0', 10)
  };
}

function getSelectedRoom() {
  if (!state.resort || !state.selectedRoomId) return null;
  return (state.resort.rooms || []).find((r) => r.id === state.selectedRoomId) || null;
}

function updateSummary() {
  const room = getSelectedRoom();
  const inputs = getBookingInputs();

  const roomEl = document.querySelector('[data-summary-room]');
  const nightsEl = document.querySelector('[data-summary-nights]');
  const subEl = document.querySelector('[data-summary-subtotal]');
  const taxEl = document.querySelector('[data-summary-tax]');
  const totEl = document.querySelector('[data-summary-total]');

  if (roomEl) roomEl.textContent = room ? room.type : '—';

  let nights = 0;
  if (inputs.checkIn && inputs.checkOut && inputs.checkOut > inputs.checkIn) {
    nights = window.utils.daysBetween(inputs.checkIn, inputs.checkOut);
  }
  if (nightsEl) nightsEl.textContent = nights > 0 ? String(nights) : '—';

  const rate = room ? Number(room.rate) || 0 : 0;
  const subtotal = rate * nights;
  const tax = subtotal * 0.06;
  const total = subtotal + tax;

  if (subEl) subEl.textContent = window.utils.formatMYR(subtotal);
  if (taxEl) taxEl.textContent = window.utils.formatMYR(tax);
  if (totEl) totEl.textContent = window.utils.formatMYR(total);
}

function confirmBooking() {
  // Auth guard
  const session = window.auth ? window.auth.getSession() : window.store.getSession();
  if (!session) {
    window.toast && window.toast.info('Please sign in to book a stay.');
    setTimeout(() => { window.location.href = 'login.html?denied=1'; }, 700);
    return;
  }

  const room = getSelectedRoom();
  if (!room) {
    window.toast && window.toast.error('Please pick a room first.');
    return;
  }

  const { checkIn, checkOut, adults, children } = getBookingInputs();
  const todayStr = new Date().toISOString().slice(0, 10);
  if (!checkIn || !checkOut) {
    window.toast && window.toast.error('Please choose check-in and check-out dates.');
    return;
  }
  if (checkIn < todayStr) {
    window.toast && window.toast.error('Check-in cannot be in the past.');
    return;
  }
  if (checkOut <= checkIn) {
    window.toast && window.toast.error('Check-out must be after check-in.');
    return;
  }
  if (!Number.isFinite(adults) || adults < 1) {
    window.toast && window.toast.error('At least one adult is required.');
    return;
  }

  // Conflict check — any active booking on this room overlapping these dates?
  const existing = window.store.list('bookings') || [];
  const conflict = existing.some((b) => {
    if (!b || b.type !== 'resort') return false;
    if (b.roomId !== room.id) return false;
    if (!['pending', 'confirmed'].includes(b.status)) return false;
    if (!b.checkIn || !b.checkOut) return false;
    return window.utils.dateRangeOverlaps(checkIn, checkOut, b.checkIn, b.checkOut);
  });
  if (conflict) {
    window.toast && window.toast.error(
      'Those dates are already booked, please pick others.'
    );
    return;
  }

  const nights = window.utils.daysBetween(checkIn, checkOut);
  const subtotal = (Number(room.rate) || 0) * nights;
  const tax = subtotal * 0.06;
  const total = subtotal + tax;

  const inserted = window.store.insert('bookings', {
    type: 'resort',
    userId: session.userId,
    resortId: state.resort.id,
    roomId: room.id,
    checkIn,
    checkOut,
    guests: { adults, children },
    subtotal,
    tax,
    total,
    status: 'pending',
    createdAt: new Date().toISOString()
  });

  if (!inserted) {
    window.toast && window.toast.error('Could not save booking. Please try again.');
    return;
  }

  window.toast && window.toast.success(
    `Booking confirmed! ${nights} night${nights > 1 ? 's' : ''} at ${state.resort.name}.`
  );
  setTimeout(() => { window.location.href = 'user/bookings.html'; }, 1100);
}

// ---------------------------------------------------------------
// ABOUT tab
// ---------------------------------------------------------------
function renderAbout(resort) {
  const aboutImg = document.querySelector('[data-about-image]');
  if (aboutImg) {
    const firstGallery = Array.isArray(resort.gallery) && resort.gallery.length > 0
      ? resort.gallery[0]
      : resort.cover || '';
    aboutImg.src = firstGallery;
    aboutImg.alt = `${resort.name} gallery image`;
  }

  const story = document.querySelector('[data-about-story]');
  if (story) story.textContent = resort.about || resort.description || '';

  const ci = document.querySelector('[data-about-checkin]');
  if (ci) ci.textContent = resort.checkInTime || '14:00';

  const co = document.querySelector('[data-about-checkout]');
  if (co) co.textContent = resort.checkOutTime || '12:00';

  const cp = document.querySelector('[data-about-cancellation]');
  if (cp) cp.textContent = resort.cancellationPolicy || 'Free cancellation up to 48 hours before check-in.';

  const gallery = document.querySelector('[data-about-gallery]');
  if (gallery) {
    gallery.innerHTML = '';
    const images = Array.isArray(resort.gallery) ? resort.gallery.slice(0, 3) : [];
    images.forEach((src) => {
      const fig = el('figure', { class: 'gallery__item' });
      fig.appendChild(el('img', { src, alt: `${resort.name} photo` }));
      gallery.appendChild(fig);
    });
  }
}

// ---------------------------------------------------------------
// CONTACT tab
// ---------------------------------------------------------------
function renderContact(resort) {
  const phoneLink = document.querySelector('[data-contact-phone]');
  if (phoneLink) {
    const ph = resort.phone || '';
    phoneLink.textContent = ph || 'Not available';
    phoneLink.href = ph ? `tel:${ph.replace(/\s+/g, '')}` : '#';
  }
  const emailLink = document.querySelector('[data-contact-email]');
  if (emailLink) {
    const em = resort.email || '';
    emailLink.textContent = em || 'Not available';
    emailLink.href = em ? `mailto:${em}` : '#';
  }

  const form = document.querySelector('[data-contact-form]');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const name = (data.get('name') || '').toString().trim();
      const email = (data.get('email') || '').toString().trim();
      const message = (data.get('message') || '').toString().trim();
      if (!name || !email || !message) {
        window.toast && window.toast.error('Please fill in all fields.');
        return;
      }
      window.toast && window.toast.success(
        `Thanks ${name.split(' ')[0]}, the resort will be in touch shortly.`
      );
      form.reset();
    });
  }
}
