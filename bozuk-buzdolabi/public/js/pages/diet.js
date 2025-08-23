// public/js/pages/diet.js
window.renderDiet = function(){
  const root = document.createElement("div");
  root.innerHTML = `
  <header class="topbar container">
    <div class="brand">
      <div class="logo">🥫</div>
      <h1>Diyet Planı</h1>
      <p>Kişisel bilgilerine göre günlük/haftalık beslenme planı çıkar.</p>
    </div>
  </header>

  <div class="container layout">
    <main>
      <section class="card">
        <h2 class="section-title">Profil</h2>
        <div class="grid2">
          <div><label>Boy (cm)</label><input id="d_height" type="number" min="120" max="230" class="input" placeholder="186"></div>
          <div><label>Kilo (kg)</label><input id="d_weight" type="number" min="35" max="250" class="input" placeholder="110"></div>
          <div><label>Yaş</label><input id="d_age" type="number" min="12" max="90" class="input" placeholder="20"></div>
          <div><label>Cinsiyet</label>
            <select id="d_sex" class="select"><option value="male">Erkek</option><option value="female">Kadın</option></select>
          </div>
          <div><label>Aktivite</label>
            <select id="d_activity" class="select">
              <option value="sedentary">Düşük</option><option value="light">Hafif</option>
              <option value="moderate" selected>Orta</option><option value="high">Yüksek</option><option value="athlete">Çok yüksek</option>
            </select>
          </div>
          <div><label>Hedef</label>
            <select id="d_goal" class="select">
              <option value="lose">Kilo ver</option><option value="maintain" selected>Koru</option><option value="gain">Kilo al</option>
            </select>
          </div>
          <div class="span2">
            <label>Kısıtlar / tercihler (virgülle)</label>
            <input id="d_restr" class="input" placeholder="vegan, glutensiz, laktozsuz">
          </div>
        </div>
        <div class="actions" style="margin-top:10px">
          <button id="d_build" class="btn primary">Plan Oluştur</button>
          <button id="d_save" class="btn">Planı Kaydet</button>
          <button id="d_shopping" class="btn">Alışveriş listesi çıkar</button>
        </div>
        <p class="muted" style="margin-top:6px">Bilgilendirme: Bu içerik tıbbi tavsiye değildir; genel bilgi amaçlıdır.</p>
      </section>

      <section class="card" id="d_result" style="display:none">
        <h2 class="section-title">Sonuç</h2>
        <div id="d_kcal" class="badge" style="margin-bottom:10px"></div>
        <div id="d_table" class="prose"></div>
      </section>
    </main>

    <aside>
      <section class="card sticky"><h3>Kaydedilen Plan</h3><div id="d_saved" class="muted">Henüz kayıt yok.</div></section>
    </aside>
  </div>
  `;

  // helpers
  function getProfileFromForm(){
    return {
      height: Number(root.querySelector("#d_height").value || 0),
      weight: Number(root.querySelector("#d_weight").value || 0),
      age: Number(root.querySelector("#d_age").value || 0),
      sex: root.querySelector("#d_sex").value || "male",
      activity: root.querySelector("#d_activity").value || "moderate",
      goal: root.querySelector("#d_goal").value || "maintain",
      restrictions: (root.querySelector("#d_restr").value || "").split(",").map(s=>s.trim()).filter(Boolean)
    };
  }
  function fillFormFromStore(){
    const p = window.store.state.dietProfile;
    if(!p) return;
    root.querySelector("#d_height").value = p.height ?? "";
    root.querySelector("#d_weight").value = p.weight ?? "";
    root.querySelector("#d_age").value    = p.age ?? "";
    root.querySelector("#d_sex").value    = p.sex ?? "male";
    root.querySelector("#d_activity").value = p.activity ?? "moderate";
    root.querySelector("#d_goal").value   = p.goal ?? "maintain";
    root.querySelector("#d_restr").value  = (p.restrictions || []).join(", ");
  }
  function kcalBadge(kcal){ return `Hedef: <b>${kcal}</b> kcal / gün`; }
  function renderSavedBox(){
    const box = root.querySelector("#d_saved");
    const p = window.store.state.dietProfile;
    if(!p){ box.textContent="Henüz kayıt yok."; return; }
    box.innerHTML = `
      Boy: ${p.height} cm • Kilo: ${p.weight} kg • Yaş: ${p.age} •
      Cinsiyet: ${p.sex} • Aktivite: ${p.activity} • Hedef: ${p.goal}<br>
      Kısıtlar: ${(p.restrictions||[]).join(", ")||"—"}<br>
      Hedef kcal: <b>${p.targetKcal || "?"}</b>
    `;
  }

  // events
  root.querySelector("#d_build").onclick = async ()=>{
    const profile = getProfileFromForm();
    try{
      const data = await window.api.dietPlan(profile);
      root.querySelector("#d_kcal").innerHTML = kcalBadge(data.targetKcal || "?");

      const tbl = [];
      (data.dayPlan || []).forEach(block=>{
        const rows = (block.recipes || []).map(r=>`
          <div class="recipe-card">
            <h4>${r.title}</h4>
            <p class="muted">${r.summary || ""}</p>
            <div class="meta small">~${r.meta?.time || "?"} dk • ${r.meta?.servings || "?"} p</div>
            <div class="rc-actions" style="margin-top:6px">
              <button class="btn small" data-open='${encodeURIComponent(JSON.stringify(r))}'>Aç</button>
              <button class="btn small outline" data-save='${encodeURIComponent(JSON.stringify(r))}'>Kaydet</button>
            </div>
          </div>
        `).join("");
        tbl.push(`<div class="meal-block"><h3>${block.meal}</h3><div class="meal-recipes">${rows || "<p class='muted'>Öneri yok.</p>"}</div></div>`);
      });
      root.querySelector("#d_table").innerHTML = `<div class="diet-result">${tbl.join("")}</div>`;
      root.querySelector("#d_result").style.display = "";

      // store son plan
      window.store.state._lastDietPlan = data;
      window.store.state._lastDietProfile = profile;
      window.store.save();

      // buton bağla
      root.querySelectorAll("[data-open]").forEach(b=>{
        b.onclick = ()=>{
          const r = JSON.parse(decodeURIComponent(b.getAttribute("data-open")));
          window.App.openRecipeModal(r, window.store.state.pantry||[], window.App.config.staples);
        };
      });
      root.querySelectorAll("[data-save]").forEach(b=>{
        b.onclick = ()=>{
          const r = JSON.parse(decodeURIComponent(b.getAttribute("data-save")));
          const arr = window.store.state.savedRecipes || [];
          if (!arr.some(x=>x.id===r.id)) arr.push(r);
          window.store.state.savedRecipes = arr; window.store.save();
          showToast("Kaydedildi");
        };
      });

      showToast("Plan oluşturuldu");
    }catch(e){
      console.error(e);
      showToast("Plan oluşturulamadı");
    }
  };

  root.querySelector("#d_save").onclick = ()=>{
    const profile = getProfileFromForm();
    const last = window.store.state._lastDietPlan;
    profile.targetKcal = last?.targetKcal || profile.targetKcal || null;
    window.store.state.dietProfile = profile; window.store.save();
    renderSavedBox(); showToast("Plan kaydedildi");
  };

  root.querySelector("#d_shopping").onclick = async ()=>{
    const plan = window.store.state._lastDietPlan;
    if(!plan){ showToast("Önce plan oluştur"); return; }
    const allRecipes = (plan.dayPlan||[]).flatMap(b=>b.recipes||[]);
    const itemsFlat = [];
    // basit "Malzemeler:" bölümü ayrıştır
    allRecipes.forEach(r=>{
      const lines = String(r.body||"").split(/\r?\n/);
      const i = lines.findIndex(l=>/^\s*malzemeler\s*[:：]/i.test(l));
      if (i<0) return;
      for (let k=i+1;k<lines.length;k++){
        const row = lines[k].trim();
        if(!row) continue;
        if(/^\s*adımlar\s*[:：]/i.test(row)) break;
        const s = row.replace(/^[-•]\s*/, "");
        const m = s.match(/^(\d+(?:[.,]\d+)?)\s*(adet|kg|g|ml|lt|paket|y\.k|t\.k)?\s*(.+)$/i);
        if (m) itemsFlat.push({ name:m[3].trim(), qty:Number(m[1]), unit:(m[2]||"").toLowerCase() });
        else itemsFlat.push({ name:s, qty:1, unit:"" });
      }
    });
    try{
      const merged = await window.api.mergeShoppingList({
        recipes: allRecipes.map(r=>({ id:r.id, ingredients: itemsFlat }))
      });
      window.store.state.cart = window.store.state.cart || [];
      (merged.items || itemsFlat).forEach(it=>{
        const label = [it.qty, it.unit, it.name].filter(Boolean).join(" ");
        window.store.state.cart.push(label);
      });
      window.store.save();
      showToast("Alışveriş listesi sepete eklendi");
    }catch(e){
      console.error(e); showToast("Liste oluşturulamadı");
    }
  };

  // init
  fillFormFromStore(); renderSavedBox();
  return root;
};
