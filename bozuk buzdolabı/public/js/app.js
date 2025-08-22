// public/js/app.js
// Bozuk Buzdolabı — App + store + Gemini-first API + router + yardımcılar

(function () {
  "use strict";

  // ------------------- ENV -------------------
  const ENV = (window.env || window.ENV || {});
  const GEMINI_API_KEY = ENV.GEMINI_API_KEY || "";
  const PORTAL_NAME    = ENV.PORTAL_NAME    || "Bozuk Buzdolabı";
  const HAS_GEMINI     = !!GEMINI_API_KEY;

  // ------------------- TOAST -------------------
  window.showToast = function (msg = "", ms = 2200) {
    const t = document.getElementById("toast");
    if (!t) return console.log("[toast]", msg);
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => t.classList.remove("show"), ms);
  };

  // ------------------- APP NAMESPACE -------------------
  const App = (window.App = {
    config: {
      staples: [
        "tuz","karabiber","pul biber","zeytinyağı","sıvı yağ","tereyağı",
        "şeker","un","su","salça","sarımsak","sirke","limon"
      ],
      portalName: PORTAL_NAME
    },

    utils: {
      id: (p="id") => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`,
      slug: s => (s||"").toString().toLowerCase().replace(/[^\p{L}\p{N}]+/gu,"-").replace(/(^-|-$)/g,""),
      uniq: a => [...new Set(a)],
      norm: s => (s||"").toString().trim().toLowerCase().replace(/\s+/g," "),
      debounce(fn,ms=250){let t;return (...args)=>{clearTimeout(t);t=setTimeout(()=>fn(...args),ms);};}
    },

    // ------------ MODAL (inline stil) ------------
    modal: {
      open({ title = "", html = "", actions = [] } = {}) {
        let wrap = document.getElementById("bb-modal");
        if (!wrap) {
          wrap = document.createElement("div");
          wrap.id = "bb-modal";
          Object.assign(wrap.style, {
            position: "fixed", inset: "0", background: "rgba(0,0,0,.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: "9999"
          });
          const card = document.createElement("div");
          Object.assign(card.style, {
            maxWidth: "720px", width: "min(720px,90vw)", maxHeight: "85vh",
            overflow: "auto", background: "var(--panel,#fff)", color: "inherit",
            borderRadius: "16px", boxShadow: "0 10px 40px rgba(0,0,0,.3)",
            padding: "16px"
          });
          card.innerHTML = `
            <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:8px">
              <h3 id="bb-m-title" style="margin:0;font-size:20px"></h3>
              <button id="bb-m-close" class="btn">Kapat</button>
            </div>
            <div id="bb-m-body" class="prose"></div>
            <div id="bb-m-actions" class="actions" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"></div>
          `;
          wrap.appendChild(card);
          document.body.appendChild(wrap);
          wrap.addEventListener("click",(e)=>{ if(e.target===wrap) wrap.remove(); });
          card.querySelector("#bb-m-close").onclick=()=>wrap.remove();
        } else {
          wrap.style.display = "flex";
        }
        wrap.querySelector("#bb-m-title").textContent = title;
        wrap.querySelector("#bb-m-body").innerHTML = html;
        const actionsEl = wrap.querySelector("#bb-m-actions");
        actionsEl.innerHTML = "";
        (actions || []).forEach((btn) => {
          const b = document.createElement("button");
          b.className = `btn small ${btn.variant || ""}`.trim();
          b.textContent = btn.label || "Buton";
          b.onclick = btn.onClick || (() => {});
          actionsEl.appendChild(b);
        });
      }
    },

    // ---- helpers for text/file
    copy: async (text)=>{ try{ await navigator.clipboard.writeText(text); showToast("Kopyalandı"); } catch { showToast("Kopyalanamadı"); } },
    downloadText(name, text){
      const a=document.createElement("a");
      a.href=URL.createObjectURL(new Blob([text],{type:"text/plain"}));
      a.download=name||"tarif.txt"; a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    },

    // ---- recipe helpers
    escapeHTML(s){ return (s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); },
    formatMetaBadges(meta={}) {
      const parts = [];
      if (meta.time)     parts.push(`<span class="badge">~${meta.time} dk</span>`);
      if (meta.servings) parts.push(`<span class="badge">${meta.servings} p</span>`);
      if (meta.budget)   parts.push(`<span class="badge">${meta.budget}</span>`);
      return parts.join(" ");
    },
    recipeToText(recipe){ return `${recipe.title || "Tarif"}\n\n${recipe.body || ""}`; },
    renderRecipeBody(recipe, pantry=[], staples=[]){
      const allowedSet = new Set([...pantry, ...staples].map(App.utils.norm));
      let body = (recipe && recipe.body) ? String(recipe.body) : "";
      const hasIng  = /(^|\n)\s*malzemeler\s*[:：]/i.test(body);
      const hasStep = /(^|\n)\s*adımlar\s*[:：]/i.test(body);

      if (!hasIng || !hasStep){
        const a = pantry?.[0] || "soğan";
        const b = pantry?.[1] || "domates";
        body = `Malzemeler:
- ${a}
- ${b}
- tuz

Adımlar:
1) Malzemeleri hazırla.
2) Pişir.
3) Servis et.`;
      }

      try{
        const lines = body.split(/\r?\n/);
        const i = lines.findIndex(l=>/^\s*malzemeler\s*[:：]/i.test(l));
        if (i >= 0){
          const out = [];
          out.push(lines[i]);
          for (let k=i+1;k<lines.length;k++){
            const row = lines[k];
            if (/^\s*adımlar\s*[:：]/i.test(row)) { out.push(row); out.push(...lines.slice(k+1)); break; }
            if (!row.trim()){ out.push(row); continue; }
            const name = App.utils.norm(row.replace(/^[-•]\s*/, "").replace(/^(\d+(?:[.,]\d+)?)\s*(adet|kg|g|ml|lt|paket|y\.k|t\.k)?\s*/i,""));
            if (!allowedSet.size || allowedSet.has(name) || App.utils.norm(name)==="tuz"){
              out.push(row);
            }
          }
          body = out.join("\n");
        }
      }catch{}

      return body;
    },

    // ---- saved recipes
    isSaved(id){ return !!window.store.state.savedRecipes.find(r=>r.id===id); },
    saveRecipe(recipe){
      if (!recipe || !recipe.id) return;
      if (App.isSaved(recipe.id)) return;
      window.store.state.savedRecipes.push({
        id: recipe.id, title: recipe.title, summary: recipe.summary || "",
        body: recipe.body || "", meta: recipe.meta || {}
      });
      window.store.save();
      document.dispatchEvent(new CustomEvent("savedRecipesChanged"));
      showToast("Tarif kaydedildi");
    },
    removeSavedRecipe(id){
      const arr = window.store.state.savedRecipes;
      const idx = arr.findIndex(r=>r.id===id);
      if (idx>=0){ arr.splice(idx,1); window.store.save(); document.dispatchEvent(new CustomEvent("savedRecipesChanged")); showToast("Kayıt silindi"); }
    },
    toggleSave(recipe){
      if (!recipe || !recipe.id) return;
      if (App.isSaved(recipe.id)) App.removeSavedRecipe(recipe.id);
      else App.saveRecipe(recipe);
    },

    // ---- modal opener
    openRecipeModal(recipe, pantry=[], staples=[]){
      if (!recipe) return;
      const safeBody = App.renderRecipeBody(recipe, pantry, staples);
      const html = `
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:-4px 0 12px">
          ${App.formatMetaBadges(recipe.meta || {})}
        </div>
        <pre class="prose" style="white-space:pre-wrap;margin:0">${App.escapeHTML(safeBody)}</pre>
      `;
      App.modal.open({
        title: recipe.title || "Tarif",
        html,
        actions: [
          { label: "Kopyala", onClick: () => App.copy(App.recipeToText({ ...recipe, body: safeBody })) },
          { label: ".txt indir", onClick: () => App.downloadText(`${App.utils.slug(recipe.title||"tarif")}.txt`, App.recipeToText({ ...recipe, body: safeBody })) },
          { label: App.isSaved(recipe.id) ? "Kaydı Sil" : "Kaydet", onClick: () => App.toggleSave({ ...recipe, body: safeBody }) }
        ]
      });
    },

    // Body → ingredient list
    parseIngredientsFromBody(body) {
      if (!body) return [];
      const lines = body.split(/\r?\n/);
      const i = lines.findIndex((l) => /^\s*malzemeler\s*[:：]/i.test(l));
      if (i < 0) return [];
      const out = [];
      for (let k = i + 1; k < lines.length; k++) {
        const row = lines[k].trim();
        if (!row) continue;
        if (/^\s*adımlar\s*[:：]/i.test(row)) break;
        const s = row.replace(/^[-•]\s*/, "");
        const m = s.match(/^(\d+(?:[.,]\d+)?)\s*(adet|kg|g|ml|lt|paket|y\.k|t\.k)?\s*(.+)$/i);
        if (m) out.push({ name: m[3].trim(), qty: Number(m[1]), unit: (m[2] || "").toLowerCase() });
        else out.push({ name: s, qty: 1, unit: "" });
      }
      return out;
    }
  });

  // ------------------- STORE (kalıcı) -------------------
  if (!window.store) window.store = { state: {}, save(){}, load(){} };
  const defaultState = {
    cart: [],
    pantry: [],
    savedRecipes: [],     // {id,title,summary,body,meta}
    favRecipeIds: [],
    weeklyPlan: { weekStartISO: null, slots: {} },
    dietProfile: null,
    _lastRecipes: null,
    _lastDietPlan: null,
    _lastDietProfile: null,
    settings: { theme: (document.documentElement.getAttribute("data-theme") || "light") }
  };
  try {
    const persisted = JSON.parse(localStorage.getItem("bb_store") || "{}");
    window.store.state = Object.assign({}, defaultState, persisted);
    window.store.save = () => localStorage.setItem("bb_store", JSON.stringify(window.store.state));
    window.store.load = () => { const v = JSON.parse(localStorage.getItem("bb_store") || "{}"); window.store.state = Object.assign({}, defaultState, v); };
  } catch {
    window.store.state = Object.assign({}, defaultState);
    window.store.save = () => {};
    window.store.load = () => {};
  }

  // ------------------- TEMA -------------------
  function applyTheme(t){ document.documentElement.setAttribute("data-theme", t); window.store.state.settings.theme=t; window.store.save(); }
  applyTheme(window.store.state.settings.theme || "light");
  document.addEventListener("click",(e)=>{
    const btn=e.target.closest?.("#toggleTheme"); if(!btn) return;
    const cur=document.documentElement.getAttribute("data-theme")||"light";
    applyTheme(cur==="light"?"dark":"light");
  });
  document.addEventListener("click",(e)=>{
    const a=e.target.closest?.("#aboutBtn"); if(!a) return; e.preventDefault();
    showToast(`${PORTAL_NAME} — malzemeleri yaz, profesyonel tarif çıkar 💡`);
  });

  // ------------------- GEMINI CORE -------------------
  async function callGeminiText(prompt, model = "gemini-1.5-pro") {
    if (!HAS_GEMINI) return "";
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }]}] }) }
      );
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (err) {
      console.error("Gemini", err);
      return "";
    }
  }

  function extractJSON(text) {
    if (!text) return null;
    const m = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const raw = m ? m[1] : text;
    try { return JSON.parse(raw); }
    catch {
      try { return JSON.parse(raw.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'")); }
      catch { return null; }
    }
  }

  function pantryPrompt(payload) {
    const { mode="pantry", pantry=[], staples=[], freeText="", filters={} } = payload || {};
    const equip = (filters.equipment || filters.equip || []).join(", ");
    const allowed = App.utils.uniq([...(pantry||[]), ...(staples||[])]).join(", ");
    return [
      "You are a professional chef. Return SHORT, ACTIONABLE recipes in Turkish.",
      "PANTRY RULES:",
      `- Allowed ingredients ONLY from: [${allowed}].`,
      "- If something else is needed, list it under 'missing' (max 3).",
      "- Include 'Malzemeler' and numbered 'Adımlar'.",
      "",
      mode === "pantry"
        ? `MODE: PANTRY_ONLY\nKullanıcı malzemeleri: [${(pantry||[]).join(", ")}]`
        : `MODE: FREE_REQUEST\nİstek: ${freeText || "—"}`,
      `Kısıtlar: diyet=${filters.diet||"—"}, max_süre=${filters.timeMax||filters.maxTime||"—"} dk, porsiyon=${filters.servings||"—"}, bütçe=${filters.budget||"—"}, ekipman=${equip||"—"}`,
      "",
      "Output JSON only:",
`{
  "exactMatches": [
    {
      "id": "string",
      "title": "string",
      "summary": "string",
      "meta": { "time": number, "servings": number, "budget": "düşük|orta|yüksek|esnek", "equip": ["ocak"], "diet": "string" },
      "body": "Malzemeler:\\n- ...\\n\\nAdımlar:\\n1) ...\\n2) ...\\n3) ..."
    }
  ],
  "nearMatches": [
    { "recipe": { /* same recipe shape */ }, "missing": ["string"] }
  ]
}`
    ].join("\n");
  }

  function normalizeRecipes(raw, payload) {
    const normRecipe = (r) => ({
      id: r.id || App.utils.id("rec"),
      title: r.title || "Tarif",
      summary: r.summary || "Kısa özet.",
      meta: {
        time: Number(r.meta?.time || payload?.filters?.timeMax || payload?.filters?.maxTime || 20) || 20,
        servings: Number(r.meta?.servings || payload?.filters?.servings || 2) || 2,
        budget: r.meta?.budget || payload?.filters?.budget || "orta",
        equip: Array.isArray(r.meta?.equip) ? r.meta.equip : (payload?.filters?.equipment || payload?.filters?.equip || []),
        diet: r.meta?.diet || payload?.filters?.diet || ""
      },
      body: App.renderRecipeBody(r, payload?.pantry || [], payload?.staples || App.config.staples)
    });

    let exact = [];
    let near  = [];

    if (Array.isArray(raw?.suggestions)) exact.push(...raw.suggestions.map(normRecipe));
    if (Array.isArray(raw?.exactMatches)) exact.push(...raw.exactMatches.map(normRecipe));
    if (Array.isArray(raw?.nearMatches)) {
      raw.nearMatches.forEach((n) => {
        const r = normRecipe(n.recipe || n);
        const missing = Array.isArray(n.missing) ? n.missing : [];
        near.push({ recipe: r, missing });
      });
    }

    // Eksikleri kendimiz hesapla (gerekirse)
    if (!near.length && exact.length && (payload?.mode === "pantry")) {
      const allowed = new Set([...(payload.pantry||[]), ...(payload.staples||[])].map(App.utils.norm));
      exact.forEach((r) => {
        const ing = App.parseIngredientsFromBody(r.body).map(x => App.utils.norm(x.name));
        const miss = ing.filter(n => !allowed.has(n));
        if (miss.length) near.push({ recipe: r, missing: App.utils.uniq(miss).slice(0,3) });
      });
      if (near.length) {
        const ids = new Set(near.map(n => n.recipe.id));
        exact = exact.filter(r => !ids.has(r.id));
      }
    }

    return { exactMatches: exact, nearMatches: near };
  }

  function mockRecipes(payload) {
    const mk = (name) => ({
      id: App.utils.id("rec"),
      title: name,
      summary: "15 dakikada pratik tarif.",
      meta: { time: 15, servings: 2, budget: "orta", equip: payload?.filters?.equipment || [], diet: payload?.filters?.diet || "" },
      body: App.renderRecipeBody({ body: "" }, payload?.pantry || [], App.config.staples)
    });
    return { exactMatches: [mk("Pantry Usulü")], nearMatches: [] };
  }

  // --- generateRecipe: Gemini → backend(/api/generate) → eski window.api → mock ---
  (function patchGenerateRecipe() {
    const orig = window.api?.generateRecipe;
    window.api = window.api || {};

    window.api.generateRecipe = async function (payload = {}) {
      payload.staples = App.config.staples.slice();

      let raw = null;

      // 1) Gemini
      if (HAS_GEMINI) {
        try {
          const prompt = pantryPrompt(payload);
          const text   = await callGeminiText(prompt);
          raw = extractJSON(text);
        } catch (e) { console.error("Gemini err", e); }
      }

      // 2) Backend
      if (!raw) {
        try {
          const body = {
            mode   : payload.mode === "pantry" ? "chips" : "free",
            items  : Array.isArray(payload.pantry) ? payload.pantry : [],
            prompt : payload.freeText || "",
            filters: payload.filters || {}
          };
          const res = await fetch("/api/generate", {
            method : "POST",
            headers: { "Content-Type": "application/json" },
            body   : JSON.stringify(body)
          });
          if (res.ok) raw = await res.json();
        } catch (e) { console.warn("/api/generate hata", e); }
      }

      // 3) Eski front mock api.js
      if (!raw && typeof orig === "function") {
        try { raw = await orig(payload); } catch (e) { console.error("orig api", e); }
      }

      // 4) Tamamen local mock
      if (!raw) raw = mockRecipes(payload);

      const out = normalizeRecipes(raw, payload);
      window.store.state._lastRecipes = out;
      window.store.save();
      return out;
    };
  })();

  // ------------------- DIET PLAN -------------------
  function computeKcal(profile) {
    const { height, weight, age, sex = "male", activity = "moderate", goal = "maintain" } = profile || {};
    if (!(height && weight && age)) return 2000;
    const s = sex === "female" ? -161 : 5;
    let bmr = 10 * weight + 6.25 * height - 5 * age + s;
    const fac = { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725, athlete: 1.9 }[activity] || 1.55;
    let kcal = bmr * fac;
    if (goal === "lose") kcal -= 300; if (goal === "gain") kcal += 300;
    return Math.round(kcal);
  }

  async function geminiDayPlan(targetKcal, restrictions) {
    if (!HAS_GEMINI) return null;
    const prompt = [
      `Günlük hedef ${targetKcal} kcal. Kısıtlar: ${restrictions?.join(", ") || "—"}.`,
      "Kahvaltı/Öğle/Akşam için her biri 1 tarif öner. ÇIKTI JSON:",
`{
  "dayPlan": [
    { "meal":"Kahvaltı", "recipes":[{ "id":"string","title":"string","summary":"string","meta":{"time":number,"servings":number},"body":"Malzemeler:\\n- ...\\n\\nAdımlar:\\n1) ..."}] },
    { "meal":"Öğle",     "recipes":[{ ... }] },
    { "meal":"Akşam",    "recipes":[{ ... }] }
  ]
}`
    ].join("\n");
    const txt = await callGeminiText(prompt);
    return extractJSON(txt);
  }

  (function patchDietPlan() {
    const orig = window.api?.dietPlan;
    window.api.dietPlan = async function (profile = {}) {
      if (typeof orig === "function") {
        try { const r = await orig(profile); if (r) return r; } catch (e) { console.error(e); }
      }
      const targetKcal = computeKcal(profile);
      let dayPlan = null;
      const g = await geminiDayPlan(targetKcal, profile?.restrictions || []);
      if (g?.dayPlan) dayPlan = g.dayPlan;

      if (!dayPlan) {
        const mk = (meal) => ({
          meal,
          recipes: [{
            id: App.utils.id("r"),
            title: `${meal} — pratik`,
            summary: "Kısa özet.",
            meta: { time: 15, servings: 1 },
            body: `Malzemeler:\n- yumurta\n- ekmek\n\nAdımlar:\n1) Hazırlık\n2) Pişir\n3) Ye`
          }]
        });
        dayPlan = [mk("Kahvaltı"), mk("Öğle"), mk("Akşam")];
      }

      const out = { targetKcal, dayPlan };
      window.store.state._lastDietPlan = out;
      window.store.state._lastDietProfile = profile;
      window.store.save();
      return out;
    };
  })();

  // ------------------- MARKET HELPERS -------------------
  if (typeof window.api?.mergeShoppingList !== "function") {
    window.api = window.api || {};
    window.api.mergeShoppingList = async function ({ recipes = [] }) {
      const map = new Map();
      recipes.forEach(r => {
        (r.ingredients || []).forEach(it => {
          const key = (App.utils.norm(it.name) || "") + "|" + (it.unit || "");
          const cur = map.get(key) || { name: it.name, qty: 0, unit: it.unit || "" };
          cur.qty += Number(it.qty || 1);
          map.set(key, cur);
        });
      });
      return { items: Array.from(map.values()) };
    };
  }

  if (typeof window.api?.priceCompare !== "function") {
    window.api = window.api || {};
    window.api.priceCompare = async function ({ items = [] }) {
      const markets = ["Market A", "Market B", "Market C"];
      const res = markets.map(m => ({ market: m, total: Number((Math.random() * 120 + 40).toFixed(2)) }));
      const cheapest = res.reduce((a, b) => a.total < b.total ? a : b, res[0]);
      return { offers: res, cheapest };
    };
  }

  // ------------------- ROUTER -------------------
  const Router = {
    routes: {
      "#/fridge": () => window.renderFridge && window.renderFridge(),
      "#/diet":   () => window.renderDiet   && window.renderDiet(),
      "#/plan":   () => window.renderPlan   && window.renderPlan(),
      "#/market": () => window.renderMarket && window.renderMarket(),
      "#/":       () => window.renderFridge && window.renderFridge()
    },
    init() {
      window.addEventListener("hashchange", () => this.render());
      if (!location.hash) location.hash = "#/fridge";
      this.render();
    },
    render() {
      const app = document.getElementById("app-main");
      if (!app) return console.error("#app-main yok");
      app.innerHTML = "";
      const path = location.hash || "#/fridge";
      const fn   = this.routes[path] || this.routes["#/fridge"];
      try {
        const node = fn && fn();
        if (node instanceof Node) app.appendChild(node);
        else if (typeof node === "string") app.innerHTML = node;
        else if (!node) app.innerHTML = `<div class="card">Sayfa yüklenemedi.</div>`;
      } catch (e) {
        console.error(e);
        app.innerHTML = `<div class="card"><b>Hata:</b> ${e?.message || e}</div>`;
      }
      document.querySelectorAll(".nav-links a, .mode-tabs a").forEach(a => {
        a.classList.toggle("active", a.getAttribute("href") === path);
      });
    }
  };

  // ------------------- STARTUP & FETCH GUARD -------------------
  window.addEventListener("DOMContentLoaded", () => {
    // header otomatik (header.js kendi <header>’ını body’nin başına koyuyor)
    if (typeof window.renderHeader === "function" && !document.querySelector(".app-nav")) {
      window.renderHeader();
    }

    // Kartların her yerinden modal açmak için delege click
    document.addEventListener("click",(e)=>{
      const el = e.target.closest?.("[data-open-recipe],[data-recipe-json],[data-recipe-id]");
      if (!el) return;

      let recipe = null;
      const j = el.getAttribute("data-recipe-json");
      if (j){ try { recipe = JSON.parse(j); } catch {} }

      if (!recipe){
        const id = el.getAttribute("data-recipe-id");
        if (id) recipe = window.store.state.savedRecipes.find(r=>r.id===id) || null;
      }

      if (!recipe && el.hasAttribute("data-open-recipe")){
        try { recipe = JSON.parse(el.getAttribute("data-open-recipe") || "{}"); } catch {}
      }

      if (recipe){
        const pantry  = window.store.state.pantry || [];
        const staples = App.config.staples;
        App.openRecipeModal(recipe, pantry, staples);
      }
    });

    Router.init();

    const ofetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      try {
        const res = await ofetch(...args);
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error("HTTP", res.status, text);
          showToast(`Sunucu hatası (${res.status})`);
        }
        return res;
      } catch (e) {
        showToast("Bağlantı hatası");
        throw e;
      }
    };

    console.log("✅ App hazır — Gemini/Backend fallback, normalize, store & router + tarif modalı aktif.");
  });

})();
