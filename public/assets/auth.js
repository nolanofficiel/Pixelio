(() => {
  const $ = (selector) => document.querySelector(selector);

  /* Bouton « voir le mot de passe » */
  document.querySelectorAll('.reveal').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.target);
      if (!input) return;
      const revealed = button.getAttribute('aria-pressed') === 'true';
      input.type = revealed ? 'password' : 'text';
      button.setAttribute('aria-pressed', String(!revealed));
      button.setAttribute('aria-label', revealed ? 'Voir le mot de passe' : 'Masquer le mot de passe');
      input.focus({ preventScroll: true });
      try {
        input.setSelectionRange(input.value.length, input.value.length);
      } catch {
        /* certains navigateurs refusent sur les champs masqués */
      }
    });
  });

  function setHint(element, state, text) {
    if (!element) return;
    element.classList.remove('ok', 'bad');
    if (state) element.classList.add(state);
    element.textContent = text;
  }

  function showError(message) {
    const box = $('#error');
    if (!box) return;
    box.textContent = message;
    box.hidden = false;
  }

  function hideError() {
    const box = $('#error');
    if (box) box.hidden = true;
  }

  async function postJson(url, body) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Une erreur est survenue.');
    return data;
  }

  function submitter(form, label) {
    const button = form.querySelector('button[type="submit"]');
    return {
      start() {
        button.disabled = true;
        button.dataset.label = button.textContent;
        button.textContent = label;
        hideError();
      },
      stop() {
        button.disabled = false;
        button.textContent = button.dataset.label || button.textContent;
      },
    };
  }

  /* ---------- Connexion ---------- */
  const loginForm = $('#loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const username = $('#username').value.trim();
      const password = $('#password').value;
      if (!username || !password) {
        showError("Renseignez votre nom d'utilisateur et votre mot de passe.");
        return;
      }
      const state = submitter(loginForm, 'Connexion…');
      state.start();
      try {
        await postJson('/api/auth/login', { username, password });
        window.location.assign('/app');
      } catch (error) {
        showError(error.message);
        state.stop();
        document.getElementById('password').focus();
      }
    });
  }

  /* ---------- Inscription ---------- */
  const registerForm = $('#registerForm');
  if (registerForm) {
    const username = $('#username');
    const password = $('#password');
    const confirm = $('#passwordConfirm');
    const usernameHint = $('#usernameHint');
    const passwordHint = $('#passwordHint');
    const confirmHint = $('#confirmHint');

    const USERNAME_RE = /^[A-Za-z0-9._-]{3,24}$/;

    function checkUsername() {
      const value = username.value.trim();
      if (!value) {
        setHint(usernameHint, null, 'Lettres, chiffres, point, tiret et underscore.');
      } else if (USERNAME_RE.test(value)) {
        setHint(usernameHint, 'ok', "Nom d'utilisateur disponible.");
      } else {
        setHint(usernameHint, 'bad', '3 à 24 caractères : lettres, chiffres, . _ -');
      }
    }

    function checkPassword() {
      const value = password.value;
      if (!value) {
        setHint(passwordHint, null, '8 caractères minimum.');
      } else if (value.length < 8) {
        setHint(passwordHint, 'bad', `Encore ${8 - value.length} caractère(s).`);
      } else {
        setHint(passwordHint, 'ok', 'Longueur suffisante.');
      }
      checkConfirm();
    }

    function checkConfirm() {
      if (!confirm.value) {
        setHint(confirmHint, null, 'Les deux mots de passe doivent être identiques.');
      } else if (confirm.value === password.value) {
        setHint(confirmHint, 'ok', 'Les mots de passe correspondent.');
      } else {
        setHint(confirmHint, 'bad', 'Les mots de passe ne correspondent pas.');
      }
    }

    username.addEventListener('input', checkUsername);
    password.addEventListener('input', checkPassword);
    confirm.addEventListener('input', checkConfirm);

    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const value = username.value.trim();

      if (!USERNAME_RE.test(value)) {
        showError("Le nom d'utilisateur doit contenir 3 à 24 caractères (lettres, chiffres, . _ -).");
        username.focus();
        return;
      }
      if (password.value.length < 8) {
        showError('Le mot de passe doit contenir au moins 8 caractères.');
        password.focus();
        return;
      }
      if (password.value !== confirm.value) {
        showError('Les deux mots de passe ne correspondent pas.');
        confirm.focus();
        return;
      }

      const state = submitter(registerForm, 'Création…');
      state.start();
      try {
        await postJson('/api/auth/register', {
          username: value,
          password: password.value,
          passwordConfirm: confirm.value,
        });
        window.location.assign('/app');
      } catch (error) {
        showError(error.message);
        state.stop();
      }
    });
  }
})();
