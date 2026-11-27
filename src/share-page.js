const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 1024) return `${bytes || 0} o`;
  const units = ['ko', 'Mo', 'Go'];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[index]}`;
}

const HEAD = (title) => `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<meta name="color-scheme" content="dark">
<title>${escapeHtml(title)}</title>
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/style.css?v=9">
<style>
  body { min-height: 100vh; display: flex; flex-direction: column; }
  .share-nav {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 16px 26px; border-bottom: 1px solid var(--line);
    background: rgba(5, 6, 14, 0.74); backdrop-filter: blur(16px);
  }
  .share-tag {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 6px 12px; border: 1px solid var(--line-strong); border-radius: 999px;
    color: var(--muted); font-size: 11px; letter-spacing: 0.09em; text-transform: uppercase;
  }
  .share-tag i { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); }
  .share-wrap {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 26px; width: 100%; max-width: 1180px; margin: 0 auto; padding: 42px 22px 60px;
  }
  .share-frame {
    display: grid; place-items: center; max-width: 100%; margin: 0;
    border: 1px solid var(--line-strong); border-radius: 20px; overflow: hidden;
    background: #080b18; box-shadow: 0 50px 90px -50px rgba(0, 0, 0, 0.95);
  }
  .share-frame img { display: block; max-width: 100%; max-height: 70vh; object-fit: contain; }
  .share-info { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
  .share-info h1 {
    max-width: 74vw; font-size: 19px; font-weight: 600;
    letter-spacing: -0.02em; overflow-wrap: anywhere;
  }
  .share-info p { color: var(--muted); font-size: 12.5px; }
  .share-foot {
    padding: 20px; text-align: center; color: var(--muted-2); font-size: 12px;
    border-top: 1px solid var(--line);
  }
  .share-foot a { color: var(--muted); }
  .share-missing {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 14px; padding: 70px 24px; text-align: center;
  }
  .share-missing .badge {
    display: grid; place-items: center; width: 52px; height: 52px; border-radius: 15px;
    border: 1px solid var(--line-strong); background: rgba(255, 255, 255, 0.04); color: var(--muted);
  }
  .share-missing h1 { font-size: 26px; font-weight: 600; letter-spacing: -0.03em; }
  .share-missing p { max-width: 400px; color: var(--muted); font-size: 14px; line-height: 1.65; }
  @media (max-width: 620px) {
    .share-nav { padding: 14px 16px; }
    .share-nav .brand small, .share-tag { display: none; }
    .share-wrap { padding: 26px 14px 44px; gap: 20px; }
    .share-info h1 { max-width: 88vw; font-size: 16px; }
  }
</style>
</head>
<body>`;

const BRAND = `<a class="brand" href="/">
  <span class="brand-mark"><img src="/assets/img/pixelio-mark.webp" alt="" width="32" height="32"></span>
  Pixelio <small>galerie</small>
</a>`;

export function renderSharePage({ name, size, createdAt, token, owner }) {
  const date = new Date(createdAt);
  const dateLabel = Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date);
  const meta = [formatSize(size), dateLabel, owner ? `partagé par ${owner}` : '']
    .filter(Boolean)
    .join(' · ');

  return `${HEAD(`${name} · Pixelio`)}
<header class="share-nav">
  ${BRAND}
  <span class="share-tag"><i></i> Image partagée · lecture seule</span>
</header>
<main class="share-wrap">
  <figure class="share-frame">
    <img src="/s/${token}/file" alt="${escapeHtml(name)}">
  </figure>
  <div class="share-info">
    <h1>${escapeHtml(name)}</h1>
    <p>${escapeHtml(meta)}</p>
  </div>
  <div>
    <a class="btn btn-primary" href="/s/${token}/file?download=1" download="${escapeHtml(name)}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 4v11"></path>
        <path d="m7.5 10.5 4.5 4.5 4.5-4.5"></path>
        <path d="M5 19h14"></path>
      </svg>
      Télécharger l'image
    </a>
  </div>
</main>
<footer class="share-foot">Partagé depuis <a href="/">Pixelio</a> — galerie d'images privée.</footer>
</body>
</html>`;
}

export function renderShareMissing() {
  return `${HEAD('Lien indisponible · Pixelio')}
<header class="share-nav">
  ${BRAND}
</header>
<main class="share-missing">
  <span class="badge">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="4" y="10.5" width="16" height="10" rx="2.5"></rect>
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"></path>
    </svg>
  </span>
  <h1>Ce lien n'est plus actif.</h1>
  <p>L'image a été retirée ou le partage a été désactivé par son propriétaire.</p>
  <a class="btn" href="/">Découvrir Pixelio</a>
</main>
<footer class="share-foot">Pixelio — galerie d'images privée.</footer>
</body>
</html>`;
}
