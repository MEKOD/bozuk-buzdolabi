// public/js/pages/diet.js
// Sadece günlük kalori hedefini göster — tarif/öğün BLOKLARI YOK

window.renderDiet = function () {
  const root = document.createElement("div");
  root.innerHTML = `
    <header class="topbar container">
      <div class="brand">
        <div class="logo">🥫</div>
        <h1>Diyet</h1>
        <p>Günlük hedef kalorini hesapla (tarif/öğün gösterimi yok).</p>
      </div>
    </header>

    <div class="container layout">
      <main>
        <section class="card">
          <h2 class="section-title">Profil</h2>
          <div class="grid2">
            <div><label>Boy (cm)</label><input id="d_height" type="number" min="120" max="230" class="input" placeholder="175" /></div>
            <div><label>Kilo (kg)</label><input id="d_weight" type="number" min="35" max="250" class="input" placeholder="70" /></div>
            <div><label>Yaş</label><input id="d_age" type="number" min="12" max="90" class="input" placeholder="25" /></div>
            <div>
              <label>Cinsiyet</label>
              <select id="d_sex" class="input">
                <option value="male">Erkek</option>
                <option value="female">Kadın</option>
              </select>
            </div>
            <div>
              <label>Aktivite</label>
              <select id="d_activity" class="input">
                <option value="sedentary">Düşük</option>
                <option value="light">Hafif</option>
                <option value="moderate" selected>Orta</option>
                <option value="high">Yüksek</option>
                <option value="athlete">Çok yüksek</option>
              </select>
            </div>
            <div>
              <label>Hedef</label>
              <select id="d_goal" class="input">
                <option value="lose">Kilo ver</option>
                <option value="maintain" selected>Koru</option>
                <option value="gain">Kilo al</option>
              </select>
            </div>
            <div class="span2">
              <label>Kısıtlar / tercihler (virgülle)</label>
              <input id="d_restr" class="input" placeholder="vegan, glutensiz" />
            </div>
          </div>

          <div class="actions" style="margin-top:12px">
            <button id="d_calc" class="btn primary">Kalori Hesapla</button>
            <button id="d_save" class="btn">Kaydet</button>
          </div>
          <p class="muted" style="margin-top:6px">Not: Bu araç genel bilgilendirme içindir, tıbbi tavsiye değildir.</p>
        </section>

        <section class="card" id="d_result" style="display:none">
          <h2 class="section-title">Sonuç</h2>
          <div id="d_kcal" class="badge" style="margin-bottom:8px"></div>
          <p class="muted" id="d_note">
            Tarif/öğün planlama bu sürümde gizlendi. Sadece günlük hedef kaloriyi gösteriyoruz.
          </p>
        </section>
      </main>

      <aside>
        <section class="card sticky">
          <h3>Kaydedilen Profil</h3>
          <div id="d_saved" class="muted">Henüz kayıt yok.</div>
        </section>
      </aside>
    </div>
  `;

  function getProfile() {
    return {
      height: Number(root.querySelector("#d_height").value || 0),
      weight: Number(root.querySelector("#d_weight").value || 0),
      age: Number(root.querySelector("#d_age").value || 0),
      sex: root.querySelector("#d_sex").value || "male",
      activity: root.querySelector("#d_activity").value || "moderate",
      goal: root.querySelector("#d_goal").value || "maintain",
      restrictions: (root.querySelector("#d_restr").value || "")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean)
    };
  }

  function fillForm() {
    const p = (window.store && window.store.state && window.store.state.dietProfile) || null;
    if (!p) return;
    root.querySelector("#d_height").value = p.height ?? "";
    root.querySelector("#d_weight").value = p.weight ?? "";
    root.querySelector("#d_age").value    = p.age ?? "";
    root.querySelector("#d_sex").value    = p.sex || "male";
    root.querySelector("#d_activity").value = p.activity || "moderate";
    root.querySelector("#d_goal").value   = p.goal || "maintain";
    root.querySelector("#d_restr").value  = (p.restrictions || []).join(", ");
    if (p.targetKcal) {
      root.querySelector("#d_result").style.display = "";
      root.querySelector("#d_kcal").innerHTML = `Hedef: <b>${p.targetKcal}</b> kcal / gün`;
    }
  }

  function renderSavedBox() {
    const box = root.querySelector("#d_saved");
    const p = (window.store && window.store.state && window.store.state.dietProfile) || null;
    if (!p) { box.textContent = "Henüz kayıt yok."; return; }
    box.innerHTML = `
      Boy: ${p.height||"-"} cm • Kilo: ${p.weight||"-"} kg • Yaş: ${p.age||"-"}<br>
      Cinsiyet: ${p.sex||"-"} • Aktivite: ${p.activity||"-"} • Hedef: ${p.goal||"-"}<br>
      Kısıtlar: ${(p.restrictions||[]).join(", ")||"—"}<br>
      Hedef kcal: <b>${p.targetKcal || "?"}</b>
    `;
  }

  // Kalori Hesapla (sadece targetKcal kullan, öğünleri YOK SAY)
  root.querySelector("#d_calc").onclick = async () => {
    const profile = getProfile();
    try {
      const res = await (window.api && typeof window.api.dietPlan === "function"
        ? window.api.dietPlan(profile)
        : Promise.resolve({ targetKcal: 2000 }));

      const kcal = res?.targetKcal || 2000;
      root.querySelector("#d_kcal").innerHTML = `Hedef: <b>${kcal}</b> kcal / gün`;
      root.querySelector("#d_result").style.display = "";
      // geçici kaydet (son plan)
      window.store.state._lastDietPlan = { targetKcal: kcal, dayPlan: [] };
      window.store.state._lastDietProfile = profile;
      window.store.save();
      showToast?.("Kalori hedefi hesaplandı");
    } catch (e) {
      console.error(e);
      showToast?.("Hesaplanamadı");
    }
  };

  // Kaydet
  root.querySelector("#d_save").onclick = () => {
    const p = getProfile();
    const last = window.store.state._lastDietPlan || {};
    p.targetKcal = last.targetKcal || p.targetKcal || null;
    window.store.state.dietProfile = p;
    window.store.save();
    renderSavedBox();
    showToast?.("Kaydedildi");
  };

  fillForm();
  renderSavedBox();
  return root;
};
