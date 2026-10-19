// Filet de sécurité global : une image TMDB qui ne charge pas (404, réseau, hors ligne)
// est remplacée par l'image par défaut, sur tous les écrans, sans code par composant.
// data-fallback="/default-actor.png" permet de choisir une autre image de repli.
const DEFAULT_FALLBACK = "/default-movie.png";

export function installImageFallback(root = document) {
  const onError = (event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || img.dataset.fallbackApplied) return;
    if (!/image\.tmdb\.org/.test(img.currentSrc || img.src)) return;
    img.dataset.fallbackApplied = "1";
    img.src = img.dataset.fallback || DEFAULT_FALLBACK;
    img.classList.add("img-fallback");
  };
  // Les erreurs d'image ne remontent pas : écoute en phase de capture
  root.addEventListener("error", onError, true);
  return () => root.removeEventListener("error", onError, true);
}
