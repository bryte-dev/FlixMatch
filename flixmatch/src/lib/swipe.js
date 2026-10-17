export const SWIPE_THRESHOLD = 90;
export const SWIPE_UP_THRESHOLD = 110;

// Direction retenue à partir du déplacement (px). Le haut n'est pris que s'il domine nettement l'horizontal.
export function classifySwipe(dx, dy, { x = SWIPE_THRESHOLD, y = SWIPE_UP_THRESHOLD } = {}) {
  if (-dy >= y && Math.abs(dy) > Math.abs(dx) * 1.2) return "up";
  if (dx >= x) return "right";
  if (dx <= -x) return "left";
  return null;
}

// Opacité (0..1) des indicateurs LIKE / NOPE / VU pendant le glissement
export function swipeIndicators(dx, dy) {
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const upDominant = -dy > Math.abs(dx);
  return {
    right: upDominant ? 0 : clamp(dx / SWIPE_THRESHOLD),
    left: upDominant ? 0 : clamp(-dx / SWIPE_THRESHOLD),
    up: upDominant ? clamp(-dy / SWIPE_UP_THRESHOLD) : 0,
  };
}
