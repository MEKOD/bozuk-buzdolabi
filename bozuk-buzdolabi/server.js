// server.js
"use strict";

const path = require("path");
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
dotenv.config();

const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const NODE_ENV = process.env.NODE_ENV || "development";

// -------------------- PATHS / STATIC --------------------
const ROOT_DIR = __dirname;                           // bu dosyanın olduğu klasör
const PUBLIC_DIR = path.join(ROOT_DIR, "public");     // SADECE bu public kullanılacak
console.log("[STATIC_DIR]", PUBLIC_DIR);

// -------------------- MIDDLEWARES --------------------
app.use(express.json({ limit: "64kb" }));

// CORS: UI (localhost), Capacitor, ve varsa alan adın
app.use(
  cors({
    origin: [
      "http://localhost",            // Capacitor Android
      "capacitor://localhost",       // Capacitor iOS (ileride)
      "http://localhost:3000",       // yerel web
      process.env.APP_ORIGIN || ""   // örn. https://bozukbuzdolabi.com
    ].filter(Boolean),
    credentials: true
  })
);

// Cache kontrol: dev'de tamamen kapat, prod'da akıllı
if (NODE_ENV === "development") {
  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(
    express.static(PUBLIC_DIR, {
      etag: false,
      lastModified: false,
      maxAge: 0,
      index: "index.html"
    })
  );
} else {
  // prod
  app.use((req, res, next) => {
    // index.html asla cache'lenmesin
    if (req.path === "/" || req.path.endsWith("/index.html")) {
      res.set("Cache-Control", "no-store");
    }
    next();
  });
  app.use(
    express.static(PUBLIC_DIR, {
      // assetler uzun süre cache'lenebilir
      maxAge: "7d",
      setHeaders(res, filePath) {
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-store");
        }
      }
    })
  );
}

// -------------------- HEALTH --------------------
app.get("/api/health", (_req, res) => res.json({ ok: true, env: NODE_ENV }));

// -------------------- HELPERS --------------------
function extractJson(text) {
  const fenced = text && text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const raw = fenced ? fenced[1] : (text || "");
  try {
    return JSON.parse(raw);
  } catch {
    try {
      return JSON.parse(
        raw.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'")
      );
    } catch {
      return null;
    }
  }
}

function buildPrompt({ mode, prompt = "", items = [], filters = {} }) {
  const equip = (filters.equipment || filters.equip || []).join(", ");
  return [
    "Sen profesyonel bir şefsin. Kullanıcının girdisine göre kısa ve uygulanabilir tarif önerileri üret.",
    mode === "chips"
      ? `Malzemeler: ${items.join(", ") || "—"}`
      : `Serbest istek: ${prompt || "—"}`,
    `Kısıtlar: diyet=${filters.diet || "—"}, max_süre=${
      filters.maxTime || "—"
    } dk, porsiyon=${filters.servings || "—"}, bütçe=${
      filters.budget || "—"
    }, ekipman=${equip || "—"}`,
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
    body: `Malzemeler:
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
  } catch (e) {
    console.warn("Gemini fallback:", e?.message);
    return mockSuggestions(payload);
  }
}

// -------------------- API --------------------

// tarif üretimi
app.post("/api/generate", async (req, res) => {
  try {
    const mode = req.body?.mode || "chips";
    const items = Array.isArray(req.body?.items)
      ? req.body.items
      : Array.isArray(req.body?.pantry)
      ? req.body.pantry
      : [];
    const prompt = (req.body?.prompt || req.body?.freeText || "").toString();
    const filters = req.body?.filters || {};
    const data = await generateWithGemini({
      mode: mode === "pantry" ? "chips" : mode,
      items, prompt, filters
    });
    res.json(data);
  } catch (e) {
    console.error("/api/generate", e);
    res.status(200).json(mockSuggestions(req.body || {}));
  }
});

// market: tarif malzemelerini birleştir
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
    console.error("/api/merge-shoppinglist", e);
    res.json({ items: [] });
  }
});

// market: fiyat karşılaştırma (dummy)
app.post("/api/price-compare", (req, res) => {
  try {
    const markets = ["Market A", "Market B", "Market C"];
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const offers = markets.map(m => ({
      name: m,
      total: Number((Math.random() * 120 + 40).toFixed(2)),
      breakdown: items.map(it => ({
        name: it.name, qty: it.qty || 1, unit: it.unit || "",
        price: Number((Math.random() * 20 + 5).toFixed(2))
      }))
    }));
    res.json({ markets: offers });
  } catch (e) {
    console.error("/api/price-compare", e);
    res.json({ markets: [] });
  }
});

// diyet planı (her iki yol da kabul)
const dietPlanHandler = (req, res) => {
  try {
    const profile = req.body?.profile || {};
    // basit sahte çıktı (backend gerçek plan üretimini sonra bağlarız)
    const mk = (meal) => ({
      meal,
      recipes: [{
        id: "r_" + Math.random().toString(36).slice(2,8),
        title: `${meal} — pratik`,
        summary: "Kısa özet.",
        meta: { time: 15, servings: 1 },
        body: `Malzemeler:\n- yumurta\n- ekmek\n\nAdımlar:\n1) Hazırlık\n2) Pişir\n3) Ye`
      }]
    });
    res.json({ dayPlan: [mk("Kahvaltı"), mk("Öğle"), mk("Akşam")], profile });
  } catch (e) {
    console.error("/api/diet/plan", e);
    res.json({ dayPlan: [] });
  }
};
app.post("/api/diet/plan", dietPlanHandler);
app.post("/api/diet-plan", dietPlanHandler); // eski yol

// -------------------- SPA FALLBACK --------------------
// API'lerin ÜSTÜNDE OLMAMALI—doğru yerde.
app.use((_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// -------------------- START --------------------
app.listen(PORT, () => {
  console.log(`✅ Bozuk Buzdolabı ${PORT} portunda: http://localhost:${PORT}`);
});
