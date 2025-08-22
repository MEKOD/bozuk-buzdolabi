// public/js/pages/fridge.js
// Buzdolabım + Serbest Mod + Kaydedilenler kutusu

(function () {
  "use strict";

  const h = (tag, attrs = {}, ...children) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") el.className = v;
      else if (k === "style") Object.assign(el.style, v);
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    children.flat().forEach((c) => {
      if (c == null) return;
      el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    });
    return el;
  };

  function chip(text) {
    const s = text.trim();
    const b = h("button", { class: "chip", type: "button" }, s);
    b.addEventListener("click", () => b.remove());
    return b;
  }

  function getChips(container) {
    return Array.from(container.querySelectorAll(".chip")).map((c) => c.textContent.trim()).filter(Boolean);
  }

  function addChipFromInput(input, wrap) {
    const val = (input.value || "").trim();
    if (!val) return;
    wrap.insertBefore(chip(val), input);
    input.value = "";
  }

  function badge(text) {
    return h("span", { class: "badge" }, text);
  }

  function recipeCard(rec) {
    const meta = rec.meta || {};
    const badges = h("div", { class: "badges" },
      meta.time ? badge(`~${meta.time} dk`) : null,
      meta.servings ? badge(`${meta.servings} p`) : null,
      meta.budget ? badge(meta.budget) : null
    );

    const actions = h("div", { class: "actions" },
      h("button", {
        class: "btn small",
        "data-recipe-json": JSON.stringify(rec),
        "data-open-recipe": JSON.stringify({ id: rec.id, title: rec.title, body: rec.body || "" }),
        onclick: () => {}
      }, "Aç"),
      h("button", {
        class: "btn small outline",
        onclick: () => window.App && window.App.toggleSave(rec)
      }, (window.App && window.App.isSaved(rec.id)) ? "Kaydı Sil" : "Kaydet")
    );

    return h("div", { class: "card" },
      h("div", { class: "card-head" },
        h("div", { class: "card-title" }, rec.title || "Tarif"),
        badges
      ),
      h("p", { class: "muted" }, rec.summary || ""),
      actions
    );
  }

  function emptyCard(text) {
    return h("div", { class: "card" }, h("p", { class: "muted" }, text));
  }

  function filterRow() {
    const dietSel = h("select", { class: "input" },
      h("option", { value: "" }, "Diğer"),
      h("option", { value: "vegan" }, "Vegan"),
      h("option", { value: "vejetaryen" }, "Vejetaryen"),
      h("option", { value: "glutensiz" }, "Glutensiz"),
      h("option", { value: "laktozsuz" }, "Laktozsuz"),
    );
    const timeSel = h("select", { class: "input" },
      h("option", { value: "" }, "Zaman"),
      h("option", { value: 10 }, "~10 dk"),
      h("option", { value: 20 }, "~20 dk"),
      h("option", { value: 30 }, "~30 dk"),
      h("option", { value: 45 }, "~45 dk"),
      h("option", { value: 60 }, "~60 dk")
    );
    const servSel = h("select", { class: "input" },
      h("option", { value: 1 }, "1 kişi"),
      h("option", { value: 2, selected: true }, "2 kişi"),
      h("option", { value: 3 }, "3 kişi"),
      h("option", { value: 4 }, "4 kişi")
    );
    const budgetSel = h("select", { class: "input" },
      h("option", { value: "" }, "orta"),
      h("option", { value: "düşük" }, "düşük"),
      h("option", { value: "orta", selected: true }, "orta"),
      h("option", { value: "yüksek" }, "yüksek"),
      h("option", { value: "esnek" }, "esnek"),
    );

    const eqWrap = h("div", { class: "equip" },
      ...["ocak", "fırın", "tava", "tencere", "mikrodalga"].map((e) => {
        const id = `eq_${e}`;
        const cb = h("input", { type: "checkbox", id });
        const lab = h("label", { htmlFor: id }, e);
        return h("span", { class: "eq-item" }, cb, lab);
      })
    );

    const row = h("div", { class: "card row gap" },
      h("div", { class: "field", style:{flex:"1 1 180px",minWidth:"180px"} }, h("label", { class: "muted" }, "Filtre"), dietSel),
      h("div", { class: "field", style:{flex:"1 1 160px",minWidth:"160px"} }, h("label", { class: "muted" }, "Zaman"), timeSel),
      h("div", { class: "field", style:{flex:"1 1 140px",minWidth:"140px"} }, h("label", { class: "muted" }, "Porsiyon"), servSel),
      h("div", { class: "field", style:{flex:"1 1 140px",minWidth:"140px"} }, h("label", { class: "muted" }, "Bütçe"), budgetSel),
      h("div", { class: "field full", style:{flex:"1 1 100%"} }, h("label", { class: "muted" }, "Ekipman"), eqWrap)
    );

    return {
      node: row,
      get() {
        const eq = Array.from(eqWrap.querySelectorAll("input:checked")).map((i) => i.id.replace(/^eq_/, ""));
        return {
          diet: dietSel.value || "",
          timeMax: timeSel.value ? Number(timeSel.value) : undefined,
          servings: Number(servSel.value || 2),
          budget: budgetSel.value || "orta",
          equipment: eq
        };
      }
    };
  }

  async function runGenerate({ mode, pantry, freeText, filters, listWrap, suggWrap }) {
    try {
      listWrap.innerHTML = "";
      suggWrap.innerHTML = "";
      const payload = { mode, pantry, freeText, filters };
      const res = await (window.api && window.api.generateRecipe ? window.api.generateRecipe(payload) : null);
      const exact = res?.exactMatches || [];
      const near  = res?.nearMatches || [];

      if (!exact.length && !near.length) {
        suggWrap.appendChild(emptyCard("Henüz öneri yok. Üstten üret!"));
        return;
      }
      exact.forEach((r) => suggWrap.appendChild(recipeCard(r)));
      near.forEach((n) => {
        const c = recipeCard(n.recipe);
        if (n.missing?.length) {
          const miss = h("p", { class: "muted" }, `Eksik: ${n.missing.join(", ")}`);
          c.appendChild(miss);
        }
        suggWrap.appendChild(c);
      });
    } catch (e) {
      console.error(e);
      showToast("Tarif üretilemedi");
    }
  }

  function pantrySection(filtersCtl, suggWrap) {
    const saved = (window.store && window.store.state && window.store.state.pantry) || [];

    const input = h("input", { class: "input", placeholder: "malzeme yaz → Enter (örn peynir)", type: "text" });
    const chips = h("div", { class: "chips input-area" }, ...saved.map(chip), input);

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); addChipFromInput(input, chips); }
    });

    const btnGen = h("button", { class: "btn" }, "Tarif üret (malzemeden)");
    const btnClear = h("button", { class: "btn outline" }, "Temizle");

    const listWrap = h("div");
    const block = h("div", { class: "card" },
      h("h3", null, "Buzdolabında ne var?"),
      chips,
      h("div", { class: "row" }, btnGen, btnClear)
    );

    btnGen.addEventListener("click", async () => {
      const items = getChips(chips);
      if (window.store) { window.store.state.pantry = items.slice(); window.store.save(); }
      await runGenerate({
        mode: "pantry",
        pantry: items,
        filters: filtersCtl.get(),
        freeText: "",
        listWrap,
        suggWrap
      });
    });

    btnClear.addEventListener("click", () => {
      chips.querySelectorAll(".chip").forEach((c) => c.remove());
      input.value = "";
      if (window.store) { window.store.state.pantry = []; window.store.save(); }
      suggWrap.innerHTML = "";
    });

    return block;
  }

  function freeSection(filtersCtl, suggWrap) {
    const ta = h("textarea", {
      class: "input",
      rows: 3,
      placeholder: "Ne istersin? (örn: fare şekilli kek, dumanlı ramen, az malzemeli dürüm...)"
    });

    const btn = h("button", { class: "btn" }, "Tarif üret (serbest)");
    const row = h("div", { class: "card" },
      h("h3", null, "Serbest Mod"),
      ta,
      h("div", { class: "row" }, btn)
    );

    const listWrap = h("div");

    btn.addEventListener("click", async () => {
      const text = (ta.value || "").trim();
      if (!text) return showToast("Önce isteğini yaz 😊");
      await runGenerate({
        mode: "free",
        pantry: [],
        freeText: text,
        filters: filtersCtl.get(),
        listWrap,
        suggWrap
      });
    });

    return row;
  }

  function savedSection() {
    const wrap   = h("div", { class: "card saved-block" });
    const title  = h("h3", null, "Kaydedilen Tarifler");
    const listEl = h("div", { class: "saved-list" });

    function render() {
      const arr = (window.store?.state?.savedRecipes) || [];
      if (!arr.length) {
        listEl.innerHTML = `<div class="muted">Henüz kaydedilen tarif yok</div>`;
        return;
      }
      listEl.innerHTML = "";
      arr.forEach((r) => {
        const row = h("div", { class: "saved-item" },
          h("div", { class: "title" }, r.title || "Tarif"),
          h("div", { class: "acts" },
            h("button", { class:"btn small", onclick:()=>window.App.openRecipeModal(r, window.store.state.pantry||[], window.App.config.staples)}, "Aç"),
            h("button", { class:"btn small outline", onclick:()=>window.App.removeSavedRecipe(r.id)}, "Sil")
          )
        );
        listEl.appendChild(row);
      });
    }

    render();
    document.addEventListener("savedRecipesChanged", render);
    wrap.append(title, listEl);
    return wrap;
  }

  function suggestionColumn() {
    const wrap = h("div", { class: "col" });
    wrap.appendChild(h("div", { class: "card" }, h("h3", null, "Önerilen Tarifler"), h("p", { class: "muted" }, "Henüz öneri yok. Üstten üret!")));
    return wrap;
  }

  window.renderFridge = function () {
    const root = h("div", { class: "container grid-2" });

    const left = h("div", { class: "col" });

    // İç mini sekmeler (Buzdolabım / Serbest)
    const tabs = h("div", { class: "fridge-free-links" });
    const tabPantry = h("a", { href: "#", class: "" }, "Buzdolabım");
    const tabFree   = h("a", { href: "#", class: "" }, "Serbest Mod");
    tabs.append(tabPantry, tabFree);

    // Filtre ve sağ sütun
    const filtersCtl = filterRow();
    const right = suggestionColumn();
    right.innerHTML = "";
    const suggestionList = h("div", { class: "stack" });
    right.appendChild(h("div", { class: "card" }, h("h3", null, "Önerilen Tarifler")));
    right.appendChild(suggestionList);

    // Bölümler
    const secPantry = pantrySection(filtersCtl, suggestionList);
    const secFree   = freeSection(filtersCtl, suggestionList);
    const secSaved  = savedSection();

    // Sekme göster/gizle
    function show(mode){
      const isFree = mode === "free";
      tabFree.classList.toggle("active", isFree);
      tabPantry.classList.toggle("active", !isFree);
      secFree.style.display   = isFree ? "" : "none";
      secPantry.style.display = isFree ? "none" : "";
    }
    tabPantry.addEventListener("click", (e)=>{ e.preventDefault(); show("pantry"); });
    tabFree.addEventListener("click",   (e)=>{ e.preventDefault(); show("free");   });

    // URL'e göre başlangıç modu (#/free geldiyse Free aç)
    show((location.hash || "").includes("/free") ? "free" : "pantry");
    addEventListener("hashchange", ()=> show((location.hash || "").includes("/free") ? "free" : "pantry"));

    // Sol sütun sırası
    left.appendChild(tabs);
    left.appendChild(secPantry);
    left.appendChild(secFree);
    left.appendChild(filtersCtl.node);
    left.appendChild(secSaved);

    root.appendChild(left);
    root.appendChild(right);
    return root;
  };

})();
