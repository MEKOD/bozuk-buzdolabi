// public/js/pages/market.js
window.renderMarket = function () {
  const root = document.createElement("div");
  root.innerHTML = `
  <header class="topbar container">
    <div class="brand">
      <div class="logo">🥫</div>
      <h1>Market</h1>
      <p>Sepetindeki ürünleri karşılaştır, en uygun fiyatı bul.</p>
    </div>
  </header>

  <div class="container layout">
    <main>
      <section class="card">
        <h2 class="section-title">Sepet</h2>
        <div id="m_cart"></div>
        <div class="actions" style="margin-top:10px">
          <button id="m_find" class="btn primary">Ucuza Bul</button>
          <button id="m_clear" class="btn">Sepeti Temizle</button>
        </div>
      </section>

      <section class="card" id="m_results" style="display:none">
        <h2 class="section-title">Karşılaştırma Sonuçları</h2>
        <div id="m_compare"></div>
      </section>
    </main>
  </div>
  `;

  function renderCart() {
    const cartBox = root.querySelector("#m_cart");
    const cart = window.store.state.cart || [];
    if (!cart.length) {
      cartBox.innerHTML = `<p class="muted">Sepet boş.</p>`;
      return;
    }
    cartBox.innerHTML = `
      <ul class="saved-list">
        ${cart.map((item, idx) => `
          <li>
            <input type="text" value="${item}" data-idx="${idx}" class="input small" />
          </li>
        `).join("")}
      </ul>
    `;
    cartBox.querySelectorAll("input").forEach(inp => {
      inp.onchange = () => {
        const idx = parseInt(inp.dataset.idx, 10);
        window.store.state.cart[idx] = inp.value;
        window.store.save();
      };
    });
  }

  async function findCheap() {
    const cart = window.store.state.cart || [];
    if (!cart.length) { showToast?.("Sepet boş"); return; }

    const items = cart.map(str => {
      const parts = str.trim().split(" ");
      if (parts.length >= 3 && !isNaN(parseFloat(parts[0]))) {
        return { qty: parseFloat(parts[0]), unit: parts[1], name: parts.slice(2).join(" ") };
      } else {
        return { qty: 1, unit: "", name: str };
      }
    });

    try {
      const res = await fetch("/api/price-compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items })
      });
      const data = await res.json();
      renderCompare(data.markets || []);
    } catch (e) {
      console.error(e);
      showToast?.("Karşılaştırma yapılamadı");
    }
  }

  function renderCompare(markets) {
    const box = root.querySelector("#m_compare");
    if (!markets.length) {
      box.innerHTML = `<p class="muted">Sonuç yok.</p>`;
      root.querySelector("#m_results").style.display = "";
      return;
    }
    const cheapest = markets.reduce((a, b) => parseFloat(a.total) < parseFloat(b.total) ? a : b);
    box.innerHTML = `
      <p>En ucuz: <b>${cheapest.name}</b> (${cheapest.total}₺)</p>
      ${markets.map(m => `
        <div class="market-card">
          <h4>${m.name} — ${m.total}₺</h4>
          <ul>
            ${m.breakdown.map(it => `<li>${it.qty} ${it.unit} ${it.name} — ${it.price}₺</li>`).join("")}
          </ul>
        </div>
      `).join("")}
    `;
    root.querySelector("#m_results").style.display = "";
  }

  root.querySelector("#m_find").onclick = findCheap;
  root.querySelector("#m_clear").onclick = () => {
    window.store.state.cart = [];
    window.store.save();
    renderCart();
    root.querySelector("#m_results").style.display = "none";
    showToast?.("Sepet temizlendi");
  };

  renderCart();
  return root;
};
