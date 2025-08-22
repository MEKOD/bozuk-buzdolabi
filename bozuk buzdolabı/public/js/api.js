// Sunucu destekli generate
window.api = {
  async generateRecipe(payload = {}) {
    const body = {
      mode: payload.mode || "pantry",
      items: payload.pantry || payload.items || [],
      prompt: payload.freeText || payload.prompt || "",
      filters: payload.filters || {}
    };
    const res = await fetch("/api/generate", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(body)
    });
    return await res.json(); // { suggestions:[...] }
  }
};
