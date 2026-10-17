import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { classifySwipe, swipeIndicators } from "../lib/swipe";

const vibrate = (ms) => {
  // Non supporté sur iOS Safari : on dégrade silencieusement
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(ms);
};

const STAMPS = {
  right: { label: "LIKE", cls: "right-4 top-6 -rotate-12 border-emerald-400 text-emerald-400" },
  left: { label: "NOPE", cls: "left-4 top-6 rotate-12 border-red-400 text-red-400" },
  up: { label: "VU", cls: "left-1/2 top-8 -translate-x-1/2 border-sky-400 text-sky-400" },
};

// Carte glissable (Pointer Events). Animations GPU : transform + opacity uniquement.
const SwipeCard = forwardRef(function SwipeCard({ onSwipe, children, disabled = false }, ref) {
  const start = useRef(null);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(null);

  const leave = (direction, dx = 0, dy = 0) => {
    vibrate(15);
    setLeaving(direction);
    // Inertie : la carte part dans la direction du geste puis on notifie le parent
    const out = { right: { x: 700, y: dy }, left: { x: -700, y: dy }, up: { x: dx, y: -900 } }[direction];
    setDrag(out);
    setTimeout(() => onSwipe(direction), 220);
  };

  // Déclenchement par bouton / clavier
  useImperativeHandle(ref, () => ({ trigger: (direction) => !leaving && leave(direction) }));

  const onPointerDown = (e) => {
    if (disabled || leaving) return;
    start.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!start.current) return;
    setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y });
  };

  const finish = (e) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    start.current = null;
    setDragging(false);
    const direction = e.type === "pointercancel" ? null : classifySwipe(dx, dy);
    if (!direction) {
      setDrag({ x: 0, y: 0 });
      return;
    }
    leave(direction, dx, dy);
  };

  const rotation = leaving === "up" ? 0 : Math.max(-20, Math.min(20, drag.x / 12));
  const indicators = swipeIndicators(drag.x, drag.y);

  return (
    <div
      className="no-select absolute inset-0"
      style={{
        touchAction: "none",
        transform: `translate3d(${drag.x}px, ${drag.y}px, 0) rotate(${rotation}deg)`,
        transition: dragging ? "none" : "transform 0.22s ease-out, opacity 0.22s ease-out",
        opacity: leaving ? 0 : 1,
        willChange: "transform",
        cursor: dragging ? "grabbing" : "grab",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
    >
      {children}
      {Object.entries(STAMPS).map(([dir, { label, cls }]) => (
        <span
          key={dir}
          aria-hidden="true"
          className={`pointer-events-none absolute rounded-lg border-4 px-3 py-1 text-2xl font-extrabold tracking-widest ${cls}`}
          style={{ opacity: indicators[dir] }}
        >
          {label}
        </span>
      ))}
    </div>
  );
});

export default SwipeCard;
