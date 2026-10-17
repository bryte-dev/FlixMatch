export const PRESETS = {
  "popcorn": ["🍿", "#f43f5e"], "clap": ["🎬", "#8b5cf6"], "ghost": ["👻", "#06b6d4"], "robot": ["🤖", "#22c55e"],
  "alien": ["👽", "#eab308"], "cat": ["😺", "#f97316"], "star": ["⭐", "#ec4899"], "ticket": ["🎟️", "#3b82f6"],
};

const initialOf = (name) => (name || "?").trim().charAt(0).toUpperCase() || "?";

// Avatar généré : anneau de progression (heures vues -> remplissage) autour de l'initiale
function Generated({ name, stats, size }) {
  const hue = [...(name || "x")].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);
  const pct = Math.min(1, (stats?.hoursWatched || 0) / 500);
  const r = 44;
  const circ = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`Avatar de ${name || "utilisateur"}`}>
      <circle cx="50" cy="50" r="50" fill={`hsl(${hue} 60% 30%)`} />
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="5" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${circ * pct} ${circ}`} transform="rotate(-90 50 50)" />
      <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fontSize="38" fontWeight="700" fill="#fff">{initialOf(name)}</text>
    </svg>
  );
}

export default function Avatar({ avatar, name, stats, size = 40, className = "" }) {
  let inner;
  if (avatar?.startsWith("data:image/")) {
    inner = <img src={avatar} alt={`Avatar de ${name || "utilisateur"}`} width={size} height={size} className="h-full w-full object-cover" />;
  } else if (avatar?.startsWith("preset:") && PRESETS[avatar.slice(7)]) {
    const [emoji, color] = PRESETS[avatar.slice(7)];
    inner = <span role="img" aria-label="Avatar" className="flex h-full w-full items-center justify-center" style={{ background: color, fontSize: size * 0.55 }}>{emoji}</span>;
  } else {
    inner = <Generated name={name} stats={stats} size={size} />;
  }
  return <span className={`inline-block shrink-0 overflow-hidden rounded-full ${className}`} style={{ width: size, height: size }}>{inner}</span>;
}

// Redimensionne une image en JPEG 128x128 (< ~15 Ko) avant l'envoi
export function imageToAvatar(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 128;
      const side = Math.min(img.width, img.height);
      canvas.getContext("2d").drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 128, 128);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image illisible"));
    };
    img.src = url;
  });
}
