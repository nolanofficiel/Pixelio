(() => {
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  /* Apparition progressive au défilement */
  const targets = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
    );
    targets.forEach((target) => observer.observe(target));
  } else {
    targets.forEach((target) => target.classList.add('in'));
  }

  /* Si la personne est déjà connectée, les appels à l'action ouvrent la galerie */
  (async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (!response.ok) return;
      const { user } = await response.json();
      if (!user) return;

      document.querySelectorAll('[data-cta-primary]').forEach((link) => {
        link.textContent = 'Ouvrir ma galerie';
        link.setAttribute('href', '/app');
      });
      document.querySelectorAll('[data-cta-secondary]').forEach((link) => link.remove());
    } catch {
      /* page publique : rien à faire */
    }
  })();
})();
