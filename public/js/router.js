// public/js/router.js
window.router = {
  routes: {
    "#/": window.renderFridge,
    "#/diet": window.renderDiet,
    "#/plan": window.renderPlan,
    "#/market": window.renderMarket
  },
  init() {
    window.addEventListener("hashchange", () => this.render());
    this.render();
  },
  render() {
    const app = document.getElementById("app");
    app.innerHTML = "";
    const path = location.hash || "#/";
    const pageFn = this.routes[path];
    if (pageFn) {
      app.appendChild(pageFn());
    } else {
      app.innerHTML = "<p>Sayfa bulunamadı.</p>";
    }
  }
};
