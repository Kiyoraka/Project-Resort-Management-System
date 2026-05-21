/* ============================================================
 * Login Page Controller
 * - Guest guard (redirect if already signed in)
 * - Demo-account chip auto-fill
 * - Eye-toggle for password field
 * - Form validation + auth.login + role-based redirect
 * - Denied flag handling (from protected-page redirects)
 * - Forgot link + Reset Demo Data
 * ============================================================ */
(async () => {
  if (window.app?.ready) await window.app.ready;

  // ----- Guest guard ------------------------------------------------
  const session = window.auth?.getSession?.();
  if (session) {
    window.location.href = window.auth.homeForRole(session.role);
    return;
  }

  // ----- Denied flag (from protected-page redirects) ---------------
  const denied = window.utils?.getQueryParam?.('denied');
  if (denied === '1') {
    window.toast?.info?.('Please sign in to access that page.');
  } else if (denied === 'role') {
    window.toast?.error?.('Your account does not have access to that area.');
  }

  // ----- Render demo chips -----------------------------------------
  const chipsContainer = document.querySelector('[data-demo-chips]');
  const users = window.store?.list?.('users') || [];
  if (chipsContainer && users.length) {
    users.forEach(u => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.textContent = u.email;
      chip.title = `${u.role} - ${u.name}`;
      chip.addEventListener('click', () => {
        const emailEl = document.getElementById('loginEmail');
        const pwdEl = document.getElementById('loginPassword');
        if (emailEl) emailEl.value = u.email;
        if (pwdEl) pwdEl.value = u.password;
      });
      chipsContainer.appendChild(chip);
    });
  }

  // ----- Eye toggle -------------------------------------------------
  const eyeBtn = document.querySelector('[data-action="toggle-password"]');
  const pwd = document.getElementById('loginPassword');
  eyeBtn?.addEventListener('click', () => {
    if (!pwd) return;
    const showing = pwd.type === 'text';
    pwd.type = showing ? 'password' : 'text';
    eyeBtn.textContent = showing ? '👁' : '🙈';
    eyeBtn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
  });

  // ----- Forgot link ------------------------------------------------
  document.querySelector('[data-action="forgot"]')?.addEventListener('click', e => {
    e.preventDefault();
    window.modal?.alert?.(
      'For this demo, all accounts use password admin123. Use Reset Demo Data to restore default state if needed.',
      'Forgot password?'
    );
  });

  // ----- Reset demo -------------------------------------------------
  document.querySelector('[data-action="reset-demo"]')?.addEventListener('click', () => {
    window.app?.resetDemoData?.();
  });

  // ----- Form submit ------------------------------------------------
  const form = document.getElementById('loginForm');
  const card = document.getElementById('loginCard');

  const showError = (name, msg) => {
    if (!form) return;
    const el = form.querySelector(`[data-error-for="${name}"]`);
    if (el) el.textContent = msg || '';
    const input = form.querySelector(`[name="${name}"]`);
    if (input) input.classList.toggle('input--error', !!msg);
  };

  const clearErrors = () => {
    if (!form) return;
    form.querySelectorAll('[data-error-for]').forEach(el => { el.textContent = ''; });
    form.querySelectorAll('.input--error').forEach(el => el.classList.remove('input--error'));
  };

  const shakeCard = () => {
    if (!card) return;
    card.classList.remove('login__card--shake');
    // force reflow so animation can replay
    void card.offsetWidth;
    card.classList.add('login__card--shake');
  };

  form?.addEventListener('submit', e => {
    e.preventDefault();
    clearErrors();

    const data = Object.fromEntries(new FormData(form));
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let bad = false;

    if (!emailRe.test(data.email || '')) {
      showError('email', 'Please enter a valid email.');
      bad = true;
    }
    if (!data.password) {
      showError('password', 'Password is required.');
      bad = true;
    }
    if (bad) {
      shakeCard();
      return;
    }

    const result = window.auth?.login?.(data.email, data.password);
    if (result?.success) {
      const firstName = result.user?.name?.split(' ')[0] || 'there';
      window.toast?.success?.(`Welcome back, ${firstName}!`);
      setTimeout(() => {
        window.location.href = window.auth.homeForRole(result.user.role);
      }, 600);
    } else {
      const errMsg = result?.error || 'Invalid email or password.';
      showError('email', errMsg);
      window.toast?.error?.(errMsg);
      shakeCard();
    }
  });
})();
