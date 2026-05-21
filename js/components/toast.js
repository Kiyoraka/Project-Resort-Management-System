/**
 * Toast Notification Component
 *
 * Stacking auto-dismiss notification system. Exposes window.toast with
 * show/success/error/info/warn/clear methods. Toasts stack bottom-right,
 * pause auto-dismiss on hover, and animate in/out via CSS transitions.
 *
 * @module components/toast
 */
(function () {
  'use strict';

  // --- Constants ---------------------------------------------------------

  /** Max toasts visible at one time; older ones dismiss when exceeded. */
  var MAX_STACK = 5;

  /** CSS transition duration for exit animation (must match components.css). */
  var EXIT_ANIMATION_MS = 300;

  /** Icon glyphs per toast type. */
  var ICONS = {
    success: '✓', // ✓
    error:   '✕', // ✕
    info:    'ℹ', // ℹ
    warn:    '⚠'  // ⚠
  };

  // --- Internal helpers --------------------------------------------------

  /**
   * Get or create the .toast__stack container.
   * @returns {HTMLElement}
   */
  function _getStack() {
    var stack = document.querySelector('.toast__stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast__stack';
      document.body.appendChild(stack);
    }
    return stack;
  }

  /**
   * Safe text escaping — prefers window.utils.escapeHtml if available,
   * otherwise falls back to a minimal escape. Used defensively even though
   * the message is set via textContent.
   * @param {string} str
   * @returns {string}
   */
  function _escape(str) {
    if (window.utils && typeof window.utils.escapeHtml === 'function') {
      return window.utils.escapeHtml(str);
    }
    return String(str == null ? '' : str);
  }

  /**
   * Build a toast DOM element (not yet inserted).
   * @param {string} type
   * @param {string} message
   * @returns {HTMLElement}
   */
  function _buildToast(type, message) {
    var validType = ICONS.hasOwnProperty(type) ? type : 'info';

    var toast = document.createElement('div');
    toast.className = 'toast toast--' + validType;

    var icon = document.createElement('span');
    icon.className = 'toast__icon';
    icon.textContent = ICONS[validType];

    var msg = document.createElement('span');
    msg.className = 'toast__msg';
    // textContent is XSS-safe; _escape is belt-and-braces normalization
    msg.textContent = _escape(message);

    var closeBtn = document.createElement('button');
    closeBtn.className = 'toast__close';
    closeBtn.setAttribute('aria-label', 'Dismiss');
    closeBtn.type = 'button';
    closeBtn.textContent = '×'; // ×

    toast.appendChild(icon);
    toast.appendChild(msg);
    toast.appendChild(closeBtn);

    return toast;
  }

  /**
   * Dismiss a toast: remove visible class, then remove from DOM after
   * the CSS exit transition completes.
   * @param {HTMLElement} toastEl
   */
  function _dismiss(toastEl) {
    if (!toastEl || toastEl._dismissed) return;
    toastEl._dismissed = true;

    if (toastEl._timer) {
      clearTimeout(toastEl._timer);
      toastEl._timer = null;
    }

    toastEl.classList.remove('is-visible');

    setTimeout(function () {
      if (toastEl.parentNode) {
        toastEl.parentNode.removeChild(toastEl);
      }
    }, EXIT_ANIMATION_MS);
  }

  /**
   * Enforce stack ceiling — dismiss oldest toasts beyond MAX_STACK.
   * @param {HTMLElement} stack
   */
  function _enforceMax(stack) {
    var toasts = stack.querySelectorAll('.toast:not(.is-dismissing)');
    while (toasts.length > MAX_STACK) {
      var oldest = toasts[0]; // first child = oldest in DOM order
      oldest.classList.add('is-dismissing');
      _dismiss(oldest);
      toasts = stack.querySelectorAll('.toast:not(.is-dismissing)');
    }
  }

  /**
   * Attach hover-pause behavior to a toast with an auto-dismiss timer.
   * On mouseleave, restart the timer using the original duration.
   * @param {HTMLElement} toastEl
   * @param {number} ms
   */
  function _attachHoverPause(toastEl, ms) {
    toastEl.addEventListener('mouseenter', function () {
      if (toastEl._timer) {
        clearTimeout(toastEl._timer);
        toastEl._timer = null;
      }
    });
    toastEl.addEventListener('mouseleave', function () {
      if (!toastEl._dismissed && !toastEl._timer) {
        toastEl._timer = setTimeout(function () {
          _dismiss(toastEl);
        }, ms);
      }
    });
  }

  // --- Public API --------------------------------------------------------

  window.toast = {
    /**
     * Show a toast notification.
     * @param {string} type - 'success' | 'error' | 'info' | 'warn'
     * @param {string} message - Text content (escaped).
     * @param {number} [ms=3000] - Auto-dismiss after ms; 0 = sticky.
     * @returns {HTMLElement} The toast DOM element.
     */
    show: function (type, message, ms) {
      if (typeof ms !== 'number') ms = 3000;

      var stack = _getStack();
      var toastEl = _buildToast(type, message);

      // Newest appended at bottom of DOM; CSS column-reverse renders it on top
      stack.appendChild(toastEl);

      // Enforce max stack ceiling
      _enforceMax(stack);

      // Entrance animation on next frame
      requestAnimationFrame(function () {
        toastEl.classList.add('is-visible');
      });

      // Close button
      var closeBtn = toastEl.querySelector('.toast__close');
      if (closeBtn) {
        closeBtn.addEventListener('click', function () {
          _dismiss(toastEl);
        });
      }

      // Auto-dismiss timer + hover pause (skip if sticky)
      if (ms > 0) {
        toastEl._timer = setTimeout(function () {
          _dismiss(toastEl);
        }, ms);
        _attachHoverPause(toastEl, ms);
      }

      return toastEl;
    },

    /**
     * Show a success toast.
     * @param {string} message
     * @param {number} [ms=3000]
     * @returns {HTMLElement}
     */
    success: function (message, ms) {
      return this.show('success', message, typeof ms === 'number' ? ms : 3000);
    },

    /**
     * Show an error toast (default 5s — errors deserve more reading time).
     * @param {string} message
     * @param {number} [ms=5000]
     * @returns {HTMLElement}
     */
    error: function (message, ms) {
      return this.show('error', message, typeof ms === 'number' ? ms : 5000);
    },

    /**
     * Show an info toast.
     * @param {string} message
     * @param {number} [ms=3000]
     * @returns {HTMLElement}
     */
    info: function (message, ms) {
      return this.show('info', message, typeof ms === 'number' ? ms : 3000);
    },

    /**
     * Show a warning toast.
     * @param {string} message
     * @param {number} [ms=4000]
     * @returns {HTMLElement}
     */
    warn: function (message, ms) {
      return this.show('warn', message, typeof ms === 'number' ? ms : 4000);
    },

    /**
     * Dismiss all currently visible toasts.
     */
    clear: function () {
      var stack = document.querySelector('.toast__stack');
      if (!stack) return;
      var toasts = stack.querySelectorAll('.toast');
      for (var i = 0; i < toasts.length; i++) {
        _dismiss(toasts[i]);
      }
    }
  };

  // Pre-create stack container on DOM ready when utils is available
  if (window.utils && typeof window.utils.onReady === 'function') {
    window.utils.onReady(function () {
      _getStack();
    });
  }
})();
