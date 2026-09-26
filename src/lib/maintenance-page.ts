export function renderMaintenancePage(): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>AfricAkani — Notre boutique ouvre très bientôt</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle at 50% 0%, #0e5a44 0%, #0a4534 65%);
    color: #f4f1e9;
    font-family: Georgia, "Times New Roman", serif;
    text-align: center;
    padding: 24px;
  }
  .card { max-width: 460px; }
  .logo {
    width: 72px;
    height: 72px;
    border-radius: 9999px;
    margin: 0 auto 20px;
    display: block;
  }
  .wordmark {
    font-size: 26px;
    font-weight: 700;
    margin: 0 0 32px;
    letter-spacing: 0.01em;
  }
  .wordmark .gold { color: #e0b65a; }
  h1 {
    font-size: 28px;
    font-weight: 800;
    margin: 0 0 14px;
    line-height: 1.25;
  }
  p.tagline {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 15px;
    color: rgba(244, 241, 233, 0.85);
    margin: 0 0 34px;
    line-height: 1.6;
  }
  .actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border-radius: 9999px;
    padding: 12px 28px;
    font-size: 14px;
    font-weight: 700;
    text-decoration: none;
  }
  .btn-primary { background: #c9962c; color: #0a4534; }
  .btn-primary:hover { background: #e0b65a; }
  .btn-secondary { border: 1px solid rgba(255, 255, 255, 0.3); color: #f4f1e9; }
  .btn-secondary:hover { background: rgba(255, 255, 255, 0.1); }
  .bottom-glow {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent 0%, #c9962c 20%, #0e5a44 50%, #c9962c 80%, transparent 100%);
    box-shadow: 0 0 8px 0 rgba(201, 150, 44, 0.35);
  }
</style>
</head>
<body>
  <div class="card">
    <img class="logo" src="/logo/medallion.png" alt="AfricAkani" />
    <p class="wordmark">Afric<span class="gold">Akani</span></p>
    <h1>Notre boutique ouvre très bientôt</h1>
    <p class="tagline">
      Nous préparons quelque chose de bon. Merci de votre patience — nous
      serons de retour très vite.
    </p>
    <div class="actions">
      <a class="btn btn-primary" href="https://wa.me/15148673738" target="_blank" rel="noopener noreferrer">
        Écrire sur WhatsApp
      </a>
      <a class="btn btn-secondary" href="mailto:contact@africakani.com">
        contact@africakani.com
      </a>
    </div>
  </div>
  <div class="bottom-glow"></div>
</body>
</html>`;
}
