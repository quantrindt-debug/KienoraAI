if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .then(reg => console.log("KienoraAI Service Worker:", reg.scope))
      .catch(err => console.error("Service Worker lỗi:", err));
  });
}
