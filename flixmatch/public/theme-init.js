// Applique le thème avant le premier rendu (évite le flash).
// Fichier externe (et non script inline) pour rester compatible avec la CSP script-src 'self'.
(function () {
  try {
    var pref = localStorage.getItem("fm-theme") || "dark";
    var dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = pref === "auto" ? (dark ? "dark" : "light") : pref;
  } catch (e) {
    document.documentElement.dataset.theme = "dark";
  }
})();
