/**
 * auth.js — Authentication & Route Guard System
 *
 * Provides session-based authentication using localStorage via window.store.
 * Exposes window.auth API for login, logout, registration, role-based route
 * guarding, and password management.
 *
 * Sessions are stored as: {userId, role, loggedInAt: ISO} or null when logged out.
 *
 * Path depth aware — protected pages live one folder deep (admin/, resort/,
 * stall/, user/), so redirects automatically prefix '../' when needed.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Detect path depth and return appropriate prefix for redirects.
   * Pages inside admin/, resort/, stall/, user/ folders need '../' prefix.
   * @returns {string} '' for root pages, '../' for subfolder pages
   */
  function _pathPrefix() {
    const path = window.location.pathname;
    if (/\/(admin|stall|resort|user)\//.test(path)) {
      return '../';
    }
    return '';
  }

  /**
   * Generate a unique ID for new user records.
   * Uses crypto.randomUUID when available, otherwise a timestamp+random fallback.
   * @returns {string}
   */
  function _uuid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  /**
   * Role-to-home-page map (relative paths from project root).
   */
  const HOME_BY_ROLE = {
    admin: 'admin/home.html',
    resort: 'resort/home.html',
    stall: 'stall/pos.html',
    user: 'user/home.html'
  };

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  window.auth = {
    /**
     * Attempt to log in with email and password.
     * Trims and lowercases email for comparison. Password is strict equality
     * (plaintext per demo spec). On success, writes session via store.setSession.
     *
     * @param {string} email
     * @param {string} password
     * @returns {{success: boolean, user?: object, error?: string}}
     */
    login(email, password) {
      if (!email || !password) {
        return { success: false, error: 'Email and password are required' };
      }
      const normalizedEmail = String(email).toLowerCase().trim();
      const matches = window.store.where('users', function (u) {
        return u && u.email && u.email.toLowerCase() === normalizedEmail;
      });
      if (!matches || matches.length === 0) {
        return { success: false, error: 'Invalid email or password' };
      }
      const user = matches[0];
      if (user.password !== password) {
        return { success: false, error: 'Invalid email or password' };
      }
      window.store.setSession({
        userId: user.id,
        role: user.role,
        loggedInAt: new Date().toISOString()
      });
      return { success: true, user: user };
    },

    /**
     * Clear the active session, optionally redirecting after.
     * @param {string} [redirectTo='index.html'] - URL to navigate to after logout
     */
    logout(redirectTo) {
      if (redirectTo === undefined) redirectTo = 'index.html';
      window.store.clearSession();
      if (redirectTo) {
        window.location.href = _pathPrefix() + redirectTo;
      }
    },

    /**
     * Page guard — call at top of a protected page.
     * If no session or session.role does not match required role(s),
     * redirects to login.html?denied=1 (or ?denied=role for role mismatch).
     *
     * @param {string|string[]} role - allowed role name or array of allowed roles
     */
    requireRole(role) {
      const session = window.store.getSession();
      const prefix = _pathPrefix();
      if (!session) {
        window.location.href = prefix + 'login.html?denied=1';
        return;
      }
      let allowed = false;
      if (Array.isArray(role)) {
        allowed = role.indexOf(session.role) !== -1;
      } else {
        allowed = session.role === role;
      }
      if (!allowed) {
        window.location.href = prefix + 'login.html?denied=role';
      }
    },

    /**
     * Page guard — reverse of requireRole. Used on login/register pages
     * to prevent already-authenticated users from seeing them.
     * If a session exists, redirects to the role's home page.
     */
    requireGuest() {
      const session = window.store.getSession();
      if (session && session.role) {
        const home = this.homeForRole(session.role);
        if (home) {
          window.location.href = _pathPrefix() + home;
        }
      }
    },

    /**
     * Get the current session object, or null if logged out.
     * @returns {{userId: string, role: string, loggedInAt: string}|null}
     */
    getSession() {
      return window.store.getSession();
    },

    /**
     * Get the full current user record by resolving session.userId.
     * @returns {object|null}
     */
    getCurrentUser() {
      const session = window.store.getSession();
      if (!session || !session.userId) return null;
      return window.store.find('users', session.userId);
    },

    /**
     * Self-register a new user account. Role is always 'user'.
     * Validates required fields, password length (>= 6), and email uniqueness.
     * On success, inserts the user, auto-logs them in, and returns the new user.
     *
     * @param {{name: string, email: string, password: string, phone?: string}} data
     * @returns {{success: boolean, user?: object, error?: string}}
     */
    register(data) {
      if (!data || typeof data !== 'object') {
        return { success: false, error: 'Invalid registration data' };
      }
      const name = data.name && String(data.name).trim();
      const email = data.email && String(data.email).trim();
      const password = data.password;
      const phone = data.phone ? String(data.phone).trim() : '';

      if (!name || !email || !password) {
        return { success: false, error: 'Name, email, and password are required' };
      }
      if (password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters' };
      }

      const normalizedEmail = email.toLowerCase();
      const existing = window.store.where('users', function (u) {
        return u && u.email && u.email.toLowerCase() === normalizedEmail;
      });
      if (existing && existing.length > 0) {
        return { success: false, error: 'An account with this email already exists' };
      }

      const newUser = {
        id: _uuid(),
        name: name,
        email: email,
        password: password,
        phone: phone,
        role: 'user',
        createdAt: new Date().toISOString()
      };

      window.store.insert('users', newUser);
      window.store.setSession({
        userId: newUser.id,
        role: newUser.role,
        loggedInAt: new Date().toISOString()
      });
      return { success: true, user: newUser };
    },

    /**
     * Map a role name to its default home page path (relative to project root).
     * @param {string} role - 'admin' | 'resort' | 'stall' | 'user'
     * @returns {string|null}
     */
    homeForRole(role) {
      return HOME_BY_ROLE[role] || null;
    },

    /**
     * Update the current user's password. Verifies current password first.
     * @param {string} currentPwd
     * @param {string} newPwd
     * @returns {{success: boolean, error?: string}}
     */
    changePassword(currentPwd, newPwd) {
      const user = this.getCurrentUser();
      if (!user) {
        return { success: false, error: 'Not logged in' };
      }
      if (user.password !== currentPwd) {
        return { success: false, error: 'Current password is incorrect' };
      }
      if (!newPwd || newPwd.length < 6) {
        return { success: false, error: 'New password must be at least 6 characters' };
      }
      window.store.update('users', user.id, { password: newPwd });
      return { success: true };
    }
  };
})();
