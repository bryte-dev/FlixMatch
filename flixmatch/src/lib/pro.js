// Architecture « FlixMatch Pro » (fake door) : aucune facturation, tout reste gratuit pendant la bêta.
// Chaque entrée Pro ouvre une modale d'information et envoie `intent_to_purchase_pro` à PostHog
// pour mesurer l'intérêt réel avant d'intégrer un paiement.

export const PRO_PRICE_USD = 3.99;

export const PRO_FEATURES = {
  night_rooms: { labelKey: "proFeatureNightRooms" },
  provider_filters: { labelKey: "proFeatureProviders" },
};

// Au-delà de ce nombre de salons créés sur 24 h, la création passe par l'entrée Pro (sans blocage)
export const FREE_NIGHT_ROOMS_PER_DAY = 3;

const env = import.meta.env || {};

// Interrupteur de la fonctionnalité : VITE_PRO_FAKE_DOOR=false désactive toutes les entrées Pro
export const proFakeDoorEnabled = () => String(env.VITE_PRO_FAKE_DOOR ?? "true").toLowerCase() !== "false";

// Pendant la bêta, tout le monde a accès à tout. Point d'extension du futur abonnement.
export const hasProAccess = () => true;

export const intentProps = (feature, source, stage) => ({ feature, source, stage, price_usd: PRO_PRICE_USD, beta: true });

// Nombre de salons créés par l'utilisateur sur les dernières 24 h
export function roomsCreatedToday(rooms, userId, now = Date.now()) {
  return (rooms || []).filter((r) => r.host?.id === userId && now - new Date(r.createdAt).getTime() < 24 * 3600 * 1000).length;
}
