// public/js/pages/plan.js
window.renderPlan = function(){
  const root = document.createElement("div");
  const days = ["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"];
  const meals = ["Kahvaltı","Öğle","Akşam"];
  const wp = window.store.state.weeklyPlan || { weekStartISO:null, slots:{} };
  window.store.state.weeklyPlan = wp;

  root.innerHTML = `
    <header class="topbar container">
      <div class="brand">
        <div class="logo">🥫</div>
        <h1>Haftalık Plan</h1>
        <p>7 gün × 3 öğün; tarif ekle/çıkar, alışveriş listesi oluştur.</p>
      </div>
    </header>

    <div class="container">
      <div class="card">
        <div class="grid plan-grid" id="planGrid"></div>
        <div class="actions" style="margin-top:12px">
          <button id="btnExportList" class="btn primary">Haftalık alışveriş listesi</button>
          <button id="btnClearWeek" class="btn">Haftayı temizle</button>
        </div>
      </div>
    </div>
  `;

  const grid = root.querySelector("#planGrid");
  function cell(html){ const d=document.createElement("div"); d.className="plan-cell head"; d.innerHTML=html; return d; }
  function cellKey(d,m){ return `${d}.${m}`; }

  function renderGrid(){
    grid.innerHTML = "";
    grid.appendChild(cell("")); meals.forEach(meal=>grid.appendChild(cell(`<b>${meal}</b>`)));
    days.forEach((d, di)=>{
      grid.appendChild(cell(`<b>${d}</b>`));
      meals.forEach((meal, mi)=>{
        const key = cellKey(di, mi);
        const recId = wp.slots[key] || null;
        const wrap = document.createElement("div");
        wrap.className = "plan-cell";

        if(recId){
          const rec = (window.store.state.savedRecipes || []).find(r=>r.id===recId);
          wrap.innerHTML = rec
            ? `<div class="row"><div class="row-title">${rec.title}</div>
                 <div class="row-actions">
                   <button class="btn small" data-act="open">Aç</button>
                   <button class="btn small" data-act="del">Kaldır</button>
                 </div></div>`
            : `<div class="muted">Kayıt bulunamadı</div>`;
          wrap.querySelector('[data-act="open"]').onclick = ()=> rec && window.App.openRecipeModal(rec, window.store.state.pantry||[], window.App.config.staples);
          wrap.querySelector('[data-act="del"]').onclick  = ()=>{ delete wp.slots[key]; window.store.save(); renderGrid(); };
        } else {
          const btn = document.createElement("button");
          btn.className = "btn small"; btn.textContent = "Tarif ekle";
          btn.onclick = ()=> pickRecipe(key);
          wrap.appendChild(btn);
        }
        grid.appendChild(wrap);
      });
    });
  }

  function pickRecipe(slotKey){
    const saved = window.store.state.savedRecipes || [];
    if (!saved.length) return showToast("Önce tarif kaydet");
    const listHtml = saved.map(r=>`<button class="btn small" data-id="${r.id}" style="margin:4px 6px 0 0">${r.title}</button>`).join("");
    window.App.modal.open({
      title: "Tarif seç",
      html: `<div>${listHtml}</div>`,
      actions: []
    });
    document.querySelectorAll('#modal [data-id]').forEach(b=>{
      b.onclick = ()=>{
        wp.slots[slotKey] = b.getAttribute("data-id");
        window.store.save(); renderGrid();
        document.getElementById("modal-close")?.click();
      };
    });
  }

  root.querySelector("#btnExportList").onclick = async ()=>{
    const saved = window.store.state.savedRecipes || [];
    const chosen = Object.values(wp.slots || {}).map(id => saved.find(r=>r.id===id)).filter(Boolean);
    if(!chosen.length) return showToast("Plan boş");
    const recipesForMerge = chosen.map(r => ({ id:r.id, ingredients: window.App.parseIngredientsFromBody(r.body) }));

    try{
      const merged = await window.api.mergeShoppingList({ recipes: recipesForMerge });
      const items = merged.items || [];
      const lines = items.map(it => [it.qty, it.unit, it.name].filter(Boolean).join(" ")).join("\n");
      window.App.modal.open({
        title: "Haftalık alışveriş listesi",
        html: `<pre class="prose">${lines || "—"}</pre>`,
        actions: [
          { label:"Kopyala", onClick: ()=>window.App.copy(lines) },
          { label:".txt indir", onClick: ()=>window.App.downloadText("haftalik-alisveris.txt", lines) }
        ]
      });
    }catch(e){
      console.error(e); showToast("Liste oluşturulamadı");
    }
  };

  root.querySelector("#btnClearWeek").onclick = ()=>{
    wp.slots = {}; window.store.save(); renderGrid(); showToast("Hafta temizlendi");
  };

  renderGrid();
  return root;
};
