/**
 * header.js — Public site navigation header component.
 *
 * Injects the KIYO COAST top navigation into any page that contains a
 * placeholder element matching `[data-component="site-header"]`.
 *
 * Features:
 *   - Auth-aware login/dashboard chip (reads window.auth.getSession()).
 *   - Scroll-triggered opacity transition (.is-scrolled @ scrollY > 50).
 *   - Hero detection: pages without .hero start opaque immediately.
 *   - Mobile drawer with toggle, outside-click, escape-key, and link-click close.
 *   - Active-link highlighting based on current pathname.
 *
 * Public API (window.header):
 *   - init(targetSelector?)  — inject + wire up (auto-runs on DOMContentLoaded).
 *   - refresh()              — re-render auth chip after login/logout.
 */
(function () {
  'use strict';

  var SCROLL_THRESHOLD = 50;
  var NAV_LINKS = [
    { href: 'index.html',   label: 'Home' },
    { href: 'parking.html', label: 'Parking' },
    { href: 'resorts.html', label: 'Resorts' },
    { href: 'stalls.html',  label: 'Stalls' },
    { href: 'contact.html', label: 'Contact' }
  ];

  // Internal references kept after init for refresh() and event handlers.
  var headerEl = null;
  var drawerEl = null;
  var authDesktopEl = null;
  var authMobileEl = null;
  var scrollTicking = false;
  var heroPresent = false;

  /**
   * Build an anchor element.
   * @param {string} href
   * @param {string} text
   * @param {string} [cls]
   * @returns {HTMLAnchorElement}
   */
  function makeLink(href, text, cls) {
    var a = document.createElement('a');
    a.href = href;
    a.textContent = text;
    if (cls) a.className = cls;
    return a;
  }

  /**
   * Determine if a nav link href matches the current page.
   * @param {string} href
   * @returns {boolean}
   */
  function isActiveLink(href) {
    var current = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (current === '' && href === 'index.html') return true;
    return current === href.toLowerCase();
  }

  /**
   * Build the auth chip content (Login or Dashboard link) into a container.
   * @param {HTMLElement} container
   */
  function renderAuthChip(container) {
    while (container.firstChild) container.removeChild(container.firstChild);

    var session = (window.auth && typeof window.auth.getSession === 'function')
      ? window.auth.getSession()
      : null;

    if (session && session.role) {
      var dashHref = (typeof window.auth.homeForRole === 'function')
        ? window.auth.homeForRole(session.role)
        : 'index.html';
      var dashLink = makeLink(dashHref, 'Dashboard →', 'btn btn--primary btn--sm');
      container.appendChild(dashLink);
    } else {
      var loginLink = makeLink('login.html', 'Login', 'btn btn--ghost btn--sm');
      container.appendChild(loginLink);
    }
  }

  /**
   * Build the nav list (used for both desktop nav and mobile drawer).
   * @param {HTMLElement} container
   */
  function renderNavLinks(container) {
    NAV_LINKS.forEach(function (item) {
      var link = makeLink(item.href, item.label);
      if (isActiveLink(item.href)) link.classList.add('is-active');
      container.appendChild(link);
    });
  }

  /**
   * Close the mobile drawer if open.
   */
  function closeDrawer() {
    if (drawerEl && drawerEl.classList.contains('is-open')) {
      drawerEl.classList.remove('is-open');
    }
  }

  /**
   * Toggle the mobile drawer open/closed.
   */
  function toggleDrawer() {
    if (!drawerEl) return;
    drawerEl.classList.toggle('is-open');
  }

  /**
   * Scroll handler — toggles .is-scrolled on the header.
   * Uses rAF throttle to coalesce events.
   */
  function onScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    window.requestAnimationFrame(function () {
      if (headerEl) {
        if (!heroPresent || window.scrollY > SCROLL_THRESHOLD) {
          headerEl.classList.add('is-scrolled');
        } else {
          headerEl.classList.remove('is-scrolled');
        }
      }
      scrollTicking = false;
    });
  }

  /**
   * Document click handler — close drawer if click is outside.
   * @param {MouseEvent} e
   */
  function onDocumentClick(e) {
    if (!drawerEl || !drawerEl.classList.contains('is-open')) return;
    var target = e.target;
    if (drawerEl.contains(target)) return;
    if (headerEl && headerEl.contains(target)) return;
    closeDrawer();
  }

  /**
   * Keydown handler — close drawer on Escape.
   * @param {KeyboardEvent} e
   */
  function onKeydown(e) {
    if (e.key === 'Escape' || e.keyCode === 27) closeDrawer();
  }

  /**
   * Build and inject the entire header DOM into the given mount element.
   * @param {HTMLElement} mount
   */
  function buildHeader(mount) {
    // <header class="site-header">
    headerEl = document.createElement('header');
    headerEl.className = 'site-header';

    // Brand
    var brand = makeLink('index.html', 'KIYO COAST', 'site-header__brand');
    headerEl.appendChild(brand);

    // Desktop nav
    var nav = document.createElement('nav');
    nav.className = 'site-header__nav';
    renderNavLinks(nav);
    headerEl.appendChild(nav);

    // Auth chip (desktop)
    authDesktopEl = document.createElement('div');
    authDesktopEl.className = 'site-header__auth';
    renderAuthChip(authDesktopEl);
    headerEl.appendChild(authDesktopEl);

    // Mobile menu toggle
    var toggle = document.createElement('button');
    toggle.className = 'site-header__menu-toggle';
    toggle.setAttribute('aria-label', 'Open menu');
    toggle.type = 'button';
    toggle.textContent = '☰';
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleDrawer();
    });
    headerEl.appendChild(toggle);

    // Mobile drawer
    drawerEl = document.createElement('div');
    drawerEl.className = 'site-header__drawer';
    renderNavLinks(drawerEl);

    authMobileEl = document.createElement('div');
    authMobileEl.className = 'site-header__auth';
    renderAuthChip(authMobileEl);
    drawerEl.appendChild(authMobileEl);

    // Close drawer when any link inside it is clicked
    drawerEl.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.tagName === 'A') closeDrawer();
    });

    // Spacer to offset fixed header height
    var spacer = document.createElement('div');
    spacer.className = 'site-header-spacer';

    // Replace placeholder content
    while (mount.firstChild) mount.removeChild(mount.firstChild);
    mount.appendChild(headerEl);
    mount.appendChild(drawerEl);
    mount.appendChild(spacer);
  }

  /**
   * Detect whether the current page has a hero element at the top.
   * @returns {boolean}
   */
  function detectHero() {
    var hero = document.querySelector('.hero');
    if (!hero) return false;
    // Treat hero as "at top" if it appears within the first 200px of the document.
    var rect = hero.getBoundingClientRect();
    var topInDoc = rect.top + window.scrollY;
    return topInDoc < 200;
  }

  /**
   * Public init — inject header into placeholder and wire up listeners.
   * @param {string} [targetSelector]
   */
  function init(targetSelector) {
    var selector = targetSelector || '[data-component="site-header"]';
    var mount = document.querySelector(selector);
    if (!mount) return; // silent no-op

    buildHeader(mount);

    heroPresent = detectHero();
    if (!heroPresent) {
      headerEl.classList.add('is-scrolled');
    } else {
      // Initial scroll position check (page might be loaded mid-scroll)
      onScroll();
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onKeydown);
  }

  /**
   * Public refresh — re-render the auth chip (call after login/logout).
   */
  function refresh() {
    if (authDesktopEl) renderAuthChip(authDesktopEl);
    if (authMobileEl)  renderAuthChip(authMobileEl);
  }

  window.header = {
    init: init,
    refresh: refresh
  };

  // Auto-init on DOM ready via utils.onReady if available, else DOMContentLoaded.
  if (window.utils && typeof window.utils.onReady === 'function') {
    window.utils.onReady(function () { init(); });
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); });
  } else {
    init();
  }
})();
