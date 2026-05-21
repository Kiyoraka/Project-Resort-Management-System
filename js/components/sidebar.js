/**
 * sidebar.js — Dashboard sidebar + topbar injector
 *
 * Renders per-role navigation into placeholder elements:
 *   <div data-component="dashboard-sidebar"></div>
 *   <div data-component="dashboard-topbar"></div>
 *
 * Role is detected from the URL pathname (admin/stall/resort/user subfolder),
 * so the sidebar always reflects the page being viewed. Auth.requireRole
 * enforces that the active session actually matches.
 *
 * Exposes: window.sidebar = { init, refresh, MENUS }
 */
(function () {
  'use strict';

  /**
   * Per-role navigation menu configurations.
   * Each entry: { href, icon, label }
   */
  const MENUS = {
    admin: [
      { href: 'home.html', icon: '🏠', label: 'Home' },
      { href: 'analysis.html', icon: '📊', label: 'Analysis' },
      { href: 'users.html', icon: '👥', label: 'Users' },
      { href: 'resorts.html', icon: '🏝️', label: 'Resorts' },
      { href: 'stalls.html', icon: '🛍️', label: 'Stalls' },
      { href: 'parking.html', icon: '🅿️', label: 'Parking' },
      { href: 'settings.html', icon: '⚙️', label: 'Settings' }
    ],
    stall: [
      { href: 'pos.html', icon: '💳', label: 'POS' },
      { href: 'analysis.html', icon: '📊', label: 'Analysis' },
      { href: 'stock.html', icon: '📦', label: 'Stock' },
      { href: 'messages.html', icon: '✉️', label: 'Messages' },
      { href: 'settings.html', icon: '⚙️', label: 'Settings' }
    ],
    resort: [
      { href: 'home.html', icon: '🏠', label: 'Home' },
      { href: 'analysis.html', icon: '📊', label: 'Analysis' },
      { href: 'bookings.html', icon: '📅', label: 'Bookings' },
      { href: 'messages.html', icon: '✉️', label: 'Messages' },
      { href: 'settings.html', icon: '⚙️', label: 'Settings' }
    ],
    user: [
      { href: 'home.html', icon: '🏠', label: 'Home' },
      { href: 'parking.html', icon: '🅿️', label: 'Parking' },
      { href: 'bookings.html', icon: '📅', label: 'Bookings' },
      { href: 'settings.html', icon: '⚙️', label: 'Settings' }
    ]
  };

  const ROLE_LABELS = {
    admin: 'Admin',
    stall: 'Stall',
    resort: 'Resort',
    user: 'User'
  };

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  /**
   * Detect the active role from the current URL pathname.
   * @returns {string|null} 'admin' | 'stall' | 'resort' | 'user' | null
   */
  function detectRole() {
    const path = (window.location.pathname || '').toLowerCase();
    if (path.indexOf('/admin/') !== -1) return 'admin';
    if (path.indexOf('/stall/') !== -1) return 'stall';
    if (path.indexOf('/resort/') !== -1) return 'resort';
    if (path.indexOf('/user/') !== -1) return 'user';
    return null;
  }

  /**
   * Return the basename of the current pathname (e.g. 'home.html').
   * @returns {string}
   */
  function currentBasename() {
    const path = window.location.pathname || '';
    const idx = path.lastIndexOf('/');
    return idx === -1 ? path : path.substring(idx + 1);
  }

  /**
   * Escape HTML special characters for safe interpolation.
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Resolve the page title — strips " - KIYO COAST" suffix from document.title,
   * or uses a data-page-title attribute on the placeholder if provided.
   * @param {HTMLElement} placeholder
   * @returns {string}
   */
  function resolvePageTitle(placeholder) {
    if (placeholder && placeholder.hasAttribute('data-page-title')) {
      return placeholder.getAttribute('data-page-title') || '';
    }
    const docTitle = document.title || '';
    return docTitle.replace(/ - KIYO COAST$/, '').trim();
  }

  // ------------------------------------------------------------------
  // Renderers
  // ------------------------------------------------------------------

  /**
   * Build the inner HTML for the sidebar given a role.
   * @param {string} role
   * @returns {string} HTML string
   */
  function buildSidebarHtml(role) {
    const menu = MENUS[role] || [];
    const roleLabel = ROLE_LABELS[role] || 'User';
    const activeFile = currentBasename();

    const brandHtml =
      '<div class="dashboard__sidebar-brand">KIYO COAST<br>' +
      '<span>' + escapeHtml(roleLabel) + '</span></div>';

    const itemsHtml = menu.map(function (item) {
      const isActive = item.href === activeFile;
      const cls = 'dashboard__nav-item' + (isActive ? ' is-active' : '');
      return (
        '<a href="' + escapeHtml(item.href) + '" class="' + cls + '">' +
        '<span class="icon">' + item.icon + '</span>' +
        '<span>' + escapeHtml(item.label) + '</span>' +
        '</a>'
      );
    }).join('');

    const spacerHtml = '<div style="flex:1"></div>';

    const logoutHtml =
      '<a href="javascript:void(0)" class="dashboard__nav-item" data-action="logout">' +
      '<span class="icon">🚪</span>' +
      '<span>Logout</span>' +
      '</a>';

    return brandHtml + itemsHtml + spacerHtml + logoutHtml;
  }

  /**
   * Build the inner HTML for the topbar.
   * @param {string} pageTitle
   * @param {string} userName
   * @returns {string} HTML string
   */
  function buildTopbarHtml(pageTitle, userName) {
    return (
      '<h1 class="dashboard__topbar-title">' + escapeHtml(pageTitle) + '</h1>' +
      '<div class="dashboard__topbar-actions">' +
      '<button class="btn btn--ghost btn--sm" data-action="toggle-theme">🌙</button>' +
      '<span class="chip">' + escapeHtml(userName) + '</span>' +
      '</div>'
    );
  }

  // ------------------------------------------------------------------
  // Event handlers
  // ------------------------------------------------------------------

  /**
   * Handle clicks within the sidebar — currently handles logout.
   * @param {Event} ev
   */
  function onSidebarClick(ev) {
    const target = ev.target.closest('[data-action="logout"]');
    if (!target) return;
    ev.preventDefault();
    if (window.auth && typeof window.auth.logout === 'function') {
      window.auth.logout('../login.html');
    } else {
      window.location.href = '../login.html';
    }
  }

  /**
   * Handle clicks within the topbar — currently handles theme toggle.
   * @param {Event} ev
   */
  function onTopbarClick(ev) {
    const target = ev.target.closest('[data-action="toggle-theme"]');
    if (!target) return;
    ev.preventDefault();
    const root = document.documentElement;
    const current = root.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    target.textContent = next === 'dark' ? '☀️' : '🌙';
    if (window.store && typeof window.store.set === 'function') {
      try { window.store.set('theme', next); } catch (e) { /* ignore */ }
    }
  }

  // ------------------------------------------------------------------
  // Mount helpers
  // ------------------------------------------------------------------

  /**
   * Render the sidebar into the given placeholder element.
   * @param {HTMLElement} placeholder
   */
  function mountSidebar(placeholder) {
    if (!placeholder) return;
    const role = detectRole() || 'user';
    const html = buildSidebarHtml(role);

    // Replace placeholder with a fresh <aside> so the placeholder's
    // wrapping tag doesn't double up CSS.
    const aside = document.createElement('aside');
    aside.className = 'dashboard__sidebar';
    aside.innerHTML = html;
    aside.addEventListener('click', onSidebarClick);

    placeholder.replaceWith(aside);
  }

  /**
   * Render the topbar into the given placeholder element.
   * @param {HTMLElement} placeholder
   */
  function mountTopbar(placeholder) {
    if (!placeholder) return;

    const pageTitle = resolvePageTitle(placeholder);

    let userName = '';
    if (window.auth && typeof window.auth.getCurrentUser === 'function') {
      try {
        const user = window.auth.getCurrentUser();
        if (user) {
          userName = user.name || user.username || user.email || '';
        }
      } catch (e) { /* ignore */ }
    }
    if (!userName) userName = 'Guest';

    const html = buildTopbarHtml(pageTitle, userName);

    const header = document.createElement('header');
    header.className = 'dashboard__topbar';
    header.innerHTML = html;
    header.addEventListener('click', onTopbarClick);

    // Reflect current theme on the toggle button glyph
    const themeBtn = header.querySelector('[data-action="toggle-theme"]');
    if (themeBtn) {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      themeBtn.textContent = current === 'dark' ? '☀️' : '🌙';
    }

    placeholder.replaceWith(header);
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  const sidebar = {
    MENUS: MENUS,

    /**
     * Initialize sidebar and topbar by replacing the placeholder elements.
     * Safe to call multiple times — re-queries the DOM each time.
     * @param {string} [sidebarSel] CSS selector for sidebar placeholder
     * @param {string} [topbarSel] CSS selector for topbar placeholder
     */
    init: function (sidebarSel, topbarSel) {
      sidebarSel = sidebarSel || '[data-component="dashboard-sidebar"]';
      topbarSel = topbarSel || '[data-component="dashboard-topbar"]';

      const qs = (window.utils && window.utils.qs)
        ? window.utils.qs
        : function (sel, parent) { return (parent || document).querySelector(sel); };

      const sidebarEl = qs(sidebarSel);
      const topbarEl = qs(topbarSel);

      if (sidebarEl) mountSidebar(sidebarEl);
      if (topbarEl) mountTopbar(topbarEl);
    },

    /**
     * Re-render sidebar and topbar by finding the already-mounted nodes
     * (or remaining placeholders) and replacing them.
     */
    refresh: function () {
      // Remove any previously mounted chrome and re-init from placeholders if any remain.
      const oldSidebar = document.querySelector('aside.dashboard__sidebar');
      const oldTopbar = document.querySelector('header.dashboard__topbar');

      if (oldSidebar) {
        const ph = document.createElement('div');
        ph.setAttribute('data-component', 'dashboard-sidebar');
        oldSidebar.replaceWith(ph);
      }
      if (oldTopbar) {
        const ph = document.createElement('div');
        ph.setAttribute('data-component', 'dashboard-topbar');
        // Preserve any custom title attribute if present
        oldTopbar.replaceWith(ph);
      }

      sidebar.init();
    }
  };

  window.sidebar = sidebar;

  // Auto-init on DOM ready
  if (window.utils && typeof window.utils.onReady === 'function') {
    window.utils.onReady(function () { sidebar.init(); });
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { sidebar.init(); });
  } else {
    sidebar.init();
  }
})();
