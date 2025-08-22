"use strict";

const path = require("path");
const express = require("express");
const dotenv = require("dotenv");
dotenv.config();

const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// Orta katmanlar
app.use(express.json({ limit: "64kb" }));
app.use(express.static(path.join(__dirname, "public"))); // /public klasörünü servis et

// Sağlık kontrolü
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ---------- Yardımcılar ----------
function extractJson(text) {
  const fenced = text && text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const raw = fenced ? fenced[1] : (text || "");
  try { return JSON.parse(raw); }
  catch {
    try { return JSON.parse(raw.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'")); }
    catch { return null; }
  }
}

function buildPrompt({ mode, prompt = "", items = [], filters = {} }) {
  const equip = (filters.equipment || filters.equip || []).join(", ");
  return [
    "Sen profesyonel bir şefsin. Kullanıcının girdisine göre kısa ve uygulanabilir tarif önerileri üret.",
    mode === "chips" ? `Malzemeler: ${items.join(", ") || "—"}` : `Serbest istek: ${prompt || "—"}`,
    `Kısıtlar: diyet=${filters.diet || "—"}, max_süre=${filters.maxTime || "—"} dk, porsiyon=${filters.servings || "—"}, bütçe=${filters.budget || "—"}, ekipman=${equip || "—"}`,
    "Çıktıyı SADECE şu JSON olarak ver:",
`{
  "suggestions": [
    {
      "id": "string",
      "title": "string",
      "summary": "string",
      "meta": { "time": number, "servings": number, "budget": "düşük|orta|yüksek|esnek", "equip": ["ocak"], "diet": "string" },
      "body": "Malzemeler:\\n- ...\\n\\nAdımlar:\\n1) ...\\n2) ...\\n3) ..."
    }
  ]
}`,
    "JSON anahtarları eksiksiz olsun, body satır sonlarında \\n kullan, 1–3 öneri üret."
  ].join("\n");
}

function mockSuggestions(payload = {}) {
  const { mode = "chips", items = [], prompt = "", filters = {} } = payload;
  const base = mode === "free" ? (prompt || "serbest tarif") : (items.join(", ") || "malzemeler");
  const mk = (i) => ({
    id: "rec_" + (Date.now() + i),
    title: i ? `${base} • öneri ${i + 1}` : base,
    summary: `${filters.maxTime || 20} dakikada pratik tarif.`,
    meta: {
      time: Number(filters.maxTime) || 20,
      servings: Number(filters.servings) || 2,
      budget: filters.budget || "orta",
      equip: filters.equipment || filters.equip || [],
      diet: filters.diet || ""
    },
    body:
`Malzemeler:
- ${mode === "free" ? "makarna" : (items[0] || "soğan")}
- ${mode === "free" ? "zeytinyağı" : (items[1] || "domates")}
- tuz

Adımlar:
1) Hazırlık yapın.
2) Pişirin.
3) Servis edin.`
  });
  return { suggestions: [mk(0), mk(1), mk(2)] };
}

async function generateWithGemini(payload) {
  if (!GEMINI_API_KEY) return mockSuggestions(payload);
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = buildPrompt(payload);
    const result = await model.generateContent(prompt);
    const text = result?.response?.text() || "";
    const parsed = extractJson(text) || mockSuggestions(payload);
    if (!Array.isArray(parsed.suggestions)) return mockSuggestions(payload);
    // normalize
    parsed.suggestions = parsed.suggestions.map((s, i) => ({
      id: s.id || "rec_" + (Date.now() + i),
      title: s.title || "Tarif",
      summary: s.summary || "Kısa özet.",
      meta: {
        time: Number(s.meta?.time || payload.filters?.maxTime || 20),
        servings: Number(s.meta?.servings || payload.filters?.servings || 2),
        budget: s.meta?.budget || payload.filters?.budget || "orta",
        equip: Array.isArray(s.meta?.equip) ? s.meta.equip : (payload.filters?.equipment || payload.filters?.equip || []),
        diet: s.meta?.diet || payload.filters?.diet || ""
      },
      body: s.body || "Malzemeler:\n- ...\n\nAdımlar:\n1) ...\n2) ...\n3) ..."
    }));
    return parsed;
  } catch {
    return mockSuggestions(payload);
  }
}

// ---------- DIET yardımcıları ----------
function computeKcal(profile = {}) {
  const { height, weight, age, sex = "male", activity = "moderate", goal = "maintain" } = profile;
  if (!(height && weight && age)) return 2000;
  const s = sex === "female" ? -161 : 5;
  let bmr = 10 * Number(weight) + 6.25 * Number(height) - 5 * Number(age) + s;
  const fac = { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725, athlete: 1.9 }[activity] || 1.55;
  let kcal = bmr * fac;
  if (goal === "lose") kcal -= 300; if (goal === "gain") kcal += 300;
  return Math.round(kcal);
}

function mockDayPlan() {
  const mk = (meal) => ({
    meal,
    recipes: [{
      id: "r_" + Math.random().toString(36).slice(2),
      title: `${meal} — pratik`,
      summary: "Kısa özet.",
      meta: { time: 15, servings: 1 },
      body: `Malzemeler:\n- yumurta\n- ekmek\n\nAdımlar:\n1) Hazırlık\n2) Pişir\n3) Ye`
    }]
  });
  return [mk("Kahvaltı"), mk("Öğle"), mk("Akşam")];
}

async function dietPlanWithGemini({ targetKcal, restrictions = [] }) {
  if (!GEMINI_API_KEY) return { targetKcal, dayPlan: mockDayPlan() };
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = [
      `Günlük hedef ${targetKcal} kcal. Kısıtlar: ${restrictions.join(", ") || "—"}.`,
      "Kahvaltı/Öğle/Akşam için her biri 1 tarif öner. SADECE şu JSON:",
`{
  "dayPlan": [
    { "meal":"Kahvaltı", "recipes":[{ "id":"string","title":"string","summary":"string","meta":{"time":number,"servings":number},"body":"Malzemeler:\\n- ...\\n\\nAdımlar:\\n1) ..."}] },
    { "meal":"Öğle",     "recipes":[{ ... }] },
    { "meal":"Akşam",    "recipes":[{ ... }] }
  ]
}`
    ].join("\n");
    const res = await model.generateContent(prompt);
    const parsed = extractJson(res?.response?.text() || "") || {};
    let dayPlan = Array.isArray(parsed.dayPlan) && parsed.dayPlan.length ? parsed.dayPlan : mockDayPlan();
    // normalize
    dayPlan = dayPlan.map((b, bi) => ({
      meal: b.meal || ["Kahvaltı","Öğle","Akşam"][bi] || "Öğün",
      recipes: (Array.isArray(b.recipes) && b.recipes.length ? b.recipes : mockDayPlan()[0].recipes).map((r, i) => ({
        id: r.id || ("r_" + Date.now() + "_" + bi + "_" + i),
        title: r.title || "Tarif",
        summary: r.summary || "Kısa özet.",
        meta: { time: Number(r.meta?.time || 15), servings: Number(r.meta?.servings || 1) },
        body: r.body || `Malzemeler:\n- ...\n\nAdımlar:\n1) ...\n2) ...\n3) ...`
      }))
    }));
    return { targetKcal, dayPlan };
  } catch (e) {
    console.error(e);
    return { targetKcal, dayPlan: mockDayPlan() };
  }
}

// ---------- API ----------
app.post("/api/generate", async (req, res) => {
  try {
    const mode = req.body?.mode || "chips";
    const items = Array.isArray(req.body?.items) ? req.body.items
                 : Array.isArray(req.body?.pantry) ? req.body.pantry
                 : [];
    const prompt = (req.body?.prompt || req.body?.freeText || "").toString();
    const filters = req.body?.filters || {};
    const data = await generateWithGemini({ mode: mode === "pantry" ? "chips" : mode, items, prompt, filters });
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(200).json(mockSuggestions(req.body || {}));
  }
});

app.post("/api/merge-shoppinglist", (req, res) => {
  try {
    const map = new Map();
    const recipes = Array.isArray(req.body?.recipes) ? req.body.recipes : [];
    recipes.forEach(r => {
      (r.ingredients || []).forEach(it => {
        const key = (String(it.name || "").toLowerCase()) + "|" + (it.unit || "");
        const cur = map.get(key) || { name: it.name, qty: 0, unit: it.unit || "" };
        cur.qty += Number(it.qty || 1);
        map.set(key, cur);
      });
    });
    res.json({ items: Array.from(map.values()) });
  } catch (e) {
    console.error(e);
    res.json({ items: [] });
  }
});

app.post("/api/price-compare", (req, res) => {
  try {
    const markets = ["Market A", "Market B", "Market C"];
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const offers = markets.map(m => ({
      name: m,
      total: Number((Math.random() * 120 + 40).toFixed(2)),
      breakdown: items.map(it => ({
        name: it.name, qty: it.qty || 1, unit: it.unit || "", price: Number((Math.random() * 20 + 5).toFixed(2))
      }))
    }));
    res.json({ markets: offers });
  } catch (e) {
    console.error(e);
    res.json({ markets: [] });
  }
});

// ---- DIET endpoint ----
app.post("/api/diet-plan", async (req, res) => {
  try {
    const profile = req.body?.profile || null;
    const restrictions = Array.isArray(req.body?.restrictions)
      ? req.body.restrictions
      : Array.isArray(profile?.restrictions) ? profile.restrictions : [];
    const targetKcal = Number(req.body?.targetKcal) || (profile ? computeKcal(profile) : 2000);
    const data = await dietPlanWithGemini({ targetKcal, restrictions });
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(200).json({ targetKcal: 2000, dayPlan: mockDayPlan() });
  }
});

// SPA fallback – her şeyi index.html’e yönlendir
// ✅ Express 5 uyumlu SPA fallback
app.use((_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Sunucu
app.listen(PORT, () => {
  console.log(`✅ Bozuk Buzdolabı ${PORT} portunda çalışıyor...`);
});
