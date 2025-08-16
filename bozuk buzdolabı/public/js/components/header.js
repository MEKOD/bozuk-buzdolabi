// public/js/components/header.js
window.renderHeader = function () {
  const header = document.createElement("header");
  header.className = "app-nav";
  header.innerHTML = `
    <div class="container bar">
      <div class="brand">
        <div class="logo">
  <svg width="36" height="36" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#60a5fa"/>
        <stop offset="1" stop-color="#2563eb"/>
      </linearGradient>
    </defs>
    <rect x="8" y="8" width="32" height="32" rx="8" fill="url(#g1)"/>
    <rect x="13" y="15" width="22" height="18" rx="4" fill="white" opacity=".92"/>
    <path d="M16 20h16M16 24h16M16 28h10" stroke="#2563eb" stroke-width="2" stroke-linecap="round"/>
  </svg>
</div>
        <a href="#/fridge" class="brand-title">
          <h1 style="margin:0">${(window.env && window.env.PORTAL_NAME) || "Bozuk Buzdolabı"}</h1>
        </a>
        <p class="muted" id="brandHint">Malzemeleri yaz → profesyonel tarif çıkar</p>
      </div>

      <nav class="nav-links">
        <a href="#/fridge">Buzdolabım</a>
        <a href="#/diet">Diyet</a>
        <a href="#/plan">Haftalık Plan</a>
        <a href="#/market">Market</a>
      </nav>

      <div class="top-actions">
        <button id="toggleTheme" class="btn ghost" aria-label="Tema değiştir">🌙</button>
        <a id="aboutBtn" class="btn outline" href="#">Hakkında</a>
      </div>
    </div>
  `;
  // Body’nin başına koy
  document.body.insertBefore(header, document.body.firstChild);
  return header;
};
