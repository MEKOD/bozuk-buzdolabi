// public/js/store.js
window.store = {
  state: {
    cart: [],
    pantry: [],
    settings: {}
  },
  save() {
    localStorage.setItem("store", JSON.stringify(this.state));
  },
  load() {
    const data = localStorage.getItem("store");
    if (data) {
      this.state = JSON.parse(data);
    }
  }
};
window.store.load();
