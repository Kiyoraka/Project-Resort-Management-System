(async () => {
  if (window.app?.ready) await window.app.ready;

  // Guest guard - if already logged in, send to role home
  const session = window.auth?.getSession?.();
  if (session) {
    window.location.href = window.auth.homeForRole(session.role);
    return;
  }

  const form = document.getElementById('registerForm');
  if (!form) return;

  // Eye toggles for both password fields
  form.querySelectorAll('[data-action="toggle-password"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.target;
      const input = document.getElementById(id);
      if (!input) return;
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.innerHTML = showing ? '&#128065;' : '&#128584;';
      btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    });
  });

  // Password strength meter
  const pwdInput = document.getElementById('regPassword');
  const strengthLabel = form.querySelector('[data-strength-label]');
  const strengthFill = form.querySelector('[data-strength-fill]');

  const computeStrength = (pwd) => {
    if (!pwd) return { level: 'none', label: 'Strength: enter a password' };
    const len = pwd.length;
    const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter(re => re.test(pwd)).length;
    if (len < 6) return { level: 'weak', label: 'Weak - too short (min 6 characters)' };
    if (len >= 12 && classes >= 3) return { level: 'strong', label: 'Strong' };
    if (len >= 10 && classes >= 2) return { level: 'medium', label: 'Medium' };
    return { level: 'weak', label: 'Weak - mix letters, numbers, and symbols' };
  };

  pwdInput?.addEventListener('input', () => {
    const { level, label } = computeStrength(pwdInput.value);
    if (strengthLabel) strengthLabel.textContent = label;
    if (strengthFill) {
      strengthFill.className = 'register__strength-bar-fill';
      if (level !== 'none') strengthFill.classList.add(`is-${level}`);
    }
  });

  // Error helpers
  const showError = (name, msg) => {
    const el = form.querySelector(`[data-error-for="${name}"]`);
    if (el) el.textContent = msg || '';
    const input = form.querySelector(`[name="${name}"]`);
    if (input) input.classList.toggle('input--error', !!msg);
  };
  const clearErrors = () => {
    form.querySelectorAll('[data-error-for]').forEach(el => el.textContent = '');
    form.querySelectorAll('.input--error').forEach(el => el.classList.remove('input--error'));
  };

  // Submit handler
  form.addEventListener('submit', e => {
    e.preventDefault();
    clearErrors();
    const data = Object.fromEntries(new FormData(form));
    let bad = false;

    if (!data.name || data.name.trim().length < 2) {
      showError('name', 'Please enter your name.');
      bad = true;
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(data.email || '')) {
      showError('email', 'Please enter a valid email.');
      bad = true;
    }
    if (!data.password || data.password.length < 6) {
      showError('password', 'Password must be at least 6 characters.');
      bad = true;
    }
    if (data.password !== data.confirm) {
      showError('confirm', 'Passwords do not match.');
      bad = true;
    }
    if (!data.terms) {
      window.toast?.error?.('You must agree to the terms.');
      bad = true;
    }

    if (bad) return;

    const result = window.auth.register({
      name: data.name.trim(),
      email: data.email.trim(),
      password: data.password,
      phone: data.phone?.trim() || ''
    });

    if (result?.success) {
      const firstName = result.user?.name?.split(' ')[0] || 'friend';
      window.toast?.success?.(`Welcome to Kiyo Coast, ${firstName}!`);
      setTimeout(() => { window.location.href = 'user/home.html'; }, 700);
    } else {
      const msg = result?.error || 'Could not create account.';
      if (/email/i.test(msg)) showError('email', msg);
      window.toast?.error?.(msg);
    }
  });
})();
