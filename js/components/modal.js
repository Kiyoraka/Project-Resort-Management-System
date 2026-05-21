/**
 * Modal Component
 * Promise-based modal helper with queue, focus trap, scroll lock.
 * Exposes window.modal API.
 */
(function () {
  'use strict';

  var utils = window.utils || {};
  var escapeHtml = utils.escapeHtml || function (s) { return String(s); };

  // ----- Internal state -----
  var _currentModal = null;       // backdrop DOM element of the active modal
  var _currentOpts = null;        // opts for the active modal
  var _currentResolver = null;    // resolve fn of the active modal promise
  var _previousFocus = null;      // element that had focus before modal opened
  var _queue = [];                // [{ opts, resolve }]
  var _transitionMs = 300;        // matches --dur-med
  var _escBound = false;

  // ----- Esc key handler (bound once) -----
  function _ensureEscBound() {
    if (_escBound) return;
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!_currentModal) return;
      if (_currentOpts && _currentOpts.dismissible === false) return;
      _close(null);
    });
    _escBound = true;
  }

  // ----- Build modal DOM -----
  function _build(opts) {
    var backdrop = document.createElement('div');
    backdrop.className = 'modal__backdrop';

    var dialog = document.createElement('div');
    dialog.className = 'modal__dialog';
    if (opts.size) {
      dialog.classList.add('modal__dialog--' + opts.size);
    }

    // Header
    var header = document.createElement('div');
    header.className = 'modal__header';

    var title = document.createElement('h2');
    title.className = 'modal__title';
    title.innerHTML = escapeHtml(opts.title || '');
    header.appendChild(title);

    var closeBtn = document.createElement('button');
    closeBtn.className = 'modal__close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.type = 'button';
    closeBtn.innerHTML = '&times;';
    header.appendChild(closeBtn);

    dialog.appendChild(header);

    // Body
    var body = document.createElement('div');
    body.className = 'modal__body';
    if (opts.body instanceof HTMLElement) {
      body.appendChild(opts.body);
    } else if (typeof opts.body === 'string') {
      body.innerHTML = opts.body;
    }
    dialog.appendChild(body);

    // Footer
    var actions = Array.isArray(opts.actions) ? opts.actions : [];
    if (actions.length > 0) {
      var footer = document.createElement('div');
      footer.className = 'modal__footer';
      actions.forEach(function (action) {
        var btn = document.createElement('button');
        btn.type = 'button';
        var variant = action.variant || 'primary';
        btn.className = 'btn btn--' + variant;
        btn.setAttribute('data-action', action.key);
        btn.textContent = action.label;
        footer.appendChild(btn);
      });
      dialog.appendChild(footer);
    }

    backdrop.appendChild(dialog);

    // ----- Listeners -----
    closeBtn.addEventListener('click', function () {
      if (opts.dismissible === false) return;
      _close(null);
    });

    backdrop.addEventListener('click', function (e) {
      if (e.target !== backdrop) return;
      if (opts.dismissible === false) return;
      _close(null);
    });

    // Delegated action button clicks
    dialog.addEventListener('click', function (e) {
      var target = e.target;
      while (target && target !== dialog) {
        if (target.hasAttribute && target.hasAttribute('data-action')) {
          var key = target.getAttribute('data-action');
          _close(key);
          return;
        }
        target = target.parentNode;
      }
    });

    return backdrop;
  }

  // ----- Open a modal (internal) -----
  function _open(opts, resolve) {
    _ensureEscBound();

    _previousFocus = document.activeElement;
    _currentOpts = opts;
    _currentResolver = resolve;

    var backdrop = _build(opts);
    _currentModal = backdrop;
    document.body.appendChild(backdrop);

    // Body scroll lock
    document.body.style.overflow = 'hidden';

    // Trigger transition on next frame
    requestAnimationFrame(function () {
      backdrop.classList.add('is-open');
    });

    // Focus management — first action button, else close button, else input
    setTimeout(function () {
      if (!_currentModal) return;
      var input = _currentModal.querySelector('.modal__body input, .modal__body textarea, .modal__body select');
      if (input) {
        input.focus();
        if (typeof input.select === 'function') {
          try { input.select(); } catch (e) { /* ignore */ }
        }
        return;
      }
      var firstAction = _currentModal.querySelector('.modal__footer .btn');
      if (firstAction) {
        firstAction.focus();
        return;
      }
      var closeBtn = _currentModal.querySelector('.modal__close');
      if (closeBtn) closeBtn.focus();
    }, 50);
  }

  // ----- Close current modal (internal) -----
  function _close(resolution) {
    if (!_currentModal) return;

    var backdrop = _currentModal;
    var resolver = _currentResolver;
    var opts = _currentOpts;

    // Allow caller hooks (e.g., prompt) to capture input BEFORE we tear down
    var finalResolution = resolution;
    if (opts && typeof opts._beforeResolve === 'function') {
      try {
        finalResolution = opts._beforeResolve(resolution, backdrop);
      } catch (e) {
        finalResolution = resolution;
      }
    }

    _currentModal = null;
    _currentResolver = null;
    _currentOpts = null;

    backdrop.classList.remove('is-open');

    setTimeout(function () {
      if (backdrop.parentNode) {
        backdrop.parentNode.removeChild(backdrop);
      }

      // If nothing queued, release scroll lock + restore focus
      if (_queue.length === 0) {
        document.body.style.overflow = '';
        if (_previousFocus && typeof _previousFocus.focus === 'function') {
          try { _previousFocus.focus(); } catch (e) { /* ignore */ }
        }
        _previousFocus = null;
      }

      if (typeof resolver === 'function') {
        resolver(finalResolution);
      }

      // Process next in queue
      if (_queue.length > 0) {
        var next = _queue.shift();
        _open(next.opts, next.resolve);
      }
    }, _transitionMs);
  }

  // ----- Public API -----

  /**
   * Show a modal. Returns a Promise that resolves with the action key chosen
   * (or null if dismissed via Esc/backdrop click/X button).
   *
   * @param {Object} opts
   * @param {string} opts.title
   * @param {string|HTMLElement} opts.body
   * @param {Array<{key:string,label:string,variant?:string}>} [opts.actions]
   * @param {boolean} [opts.dismissible=true]
   * @param {string} [opts.size] - 'sm'|'md'|'lg'
   * @returns {Promise<string|null>}
   */
  function show(opts) {
    opts = opts || {};
    if (!Array.isArray(opts.actions)) {
      opts.actions = [{ key: 'ok', label: 'OK', variant: 'primary' }];
    }
    if (typeof opts.dismissible !== 'boolean') {
      opts.dismissible = true;
    }

    return new Promise(function (resolve) {
      if (_currentModal) {
        _queue.push({ opts: opts, resolve: resolve });
      } else {
        _open(opts, resolve);
      }
    });
  }

  /**
   * Simple alert dialog.
   * @param {string} message
   * @param {string} [title='Notice']
   * @returns {Promise<'ok'>}
   */
  function alertModal(message, title) {
    return show({
      title: title || 'Notice',
      body: '<p>' + escapeHtml(message) + '</p>',
      actions: [{ key: 'ok', label: 'OK', variant: 'primary' }],
      dismissible: true
    });
  }

  /**
   * Confirm dialog.
   * @param {string} message
   * @param {string} [title='Confirm']
   * @returns {Promise<boolean>}
   */
  function confirmModal(message, title) {
    return show({
      title: title || 'Confirm',
      body: '<p>' + escapeHtml(message) + '</p>',
      actions: [
        { key: 'no', label: 'Cancel', variant: 'ghost' },
        { key: 'yes', label: 'Confirm', variant: 'primary' }
      ],
      dismissible: true
    }).then(function (result) {
      return result === 'yes';
    });
  }

  /**
   * Prompt dialog with text input.
   * @param {string} message
   * @param {string} [defaultValue='']
   * @returns {Promise<string|null>}
   */
  function promptModal(message, defaultValue) {
    var safeDefault = defaultValue == null ? '' : String(defaultValue);
    var bodyHtml =
      '<p>' + escapeHtml(message) + '</p>' +
      '<input class="input" type="text" value="' + escapeHtml(safeDefault) + '" />';

    return show({
      title: 'Prompt',
      body: bodyHtml,
      actions: [
        { key: 'cancel', label: 'Cancel', variant: 'ghost' },
        { key: 'ok', label: 'OK', variant: 'primary' }
      ],
      dismissible: true,
      _beforeResolve: function (resolution, backdrop) {
        if (resolution !== 'ok') return null;
        var input = backdrop.querySelector('.modal__body input');
        return input ? input.value : '';
      }
    });
  }

  /**
   * Programmatically dismiss the current modal.
   * @param {*} [resolution=null]
   */
  function close(resolution) {
    _close(resolution == null ? null : resolution);
  }

  window.modal = {
    show: show,
    alert: alertModal,
    confirm: confirmModal,
    prompt: promptModal,
    close: close
  };
})();
