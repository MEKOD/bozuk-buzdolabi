window.renderHeader = function(){
  const el = document.querySelector(".app-nav");
  if(!el) return;
  el.innerHTML = `
    <div class="nav-inner">
      <div class="brand">${(window.ENV?.PORTAL_NAME)||"Bozuk Buzdolabı"}</div>
      <nav class="nav-links">
        <a href="#/fridge">Buzdolabı</a>
        <a href="#/diet">Diyet</a>
        <a href="#/market">Market</a>
      </nav>
      <button id="toggleTheme" class="btn small">Tema</button>
    </div>
  `;
};
