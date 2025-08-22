// Market — Yakında (coming soon) ekranı
window.renderMarket = function () {
  const root = document.createElement("div");
  root.innerHTML = `
  <header class="topbar container">
    <div class="brand">
      <div class="logo">🥫</div>
      <h1>Market</h1>
      <p>Yakında: sepetine göre market karşılaştırma ve en uygun fiyat!</p>
    </div>
  </header>

  <div class="container layout">
    <main>
      <section class="card">
        <h2 class="section-title">Yakında</h2>
        <p class="muted">
          Bu özellik şu an kapalı. Sponsor/iş ortakları ile birlikte çok yakında açacağız.
          O zamana kadar tarif üretip kaydedebilir, buzdolabı modunu kullanabilirsin.
        </p>
        <div class="actions" style="margin-top:10px">
          <a class="btn primary" href="#/fridge">Tarif üretmeye dön</a>
        </div>
      </section>
    </main>
  </div>
  `;
  return root;
};
