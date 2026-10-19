import { useCallback, useState } from "react";

// Affichage progressif d'une longue liste (bibliothèques importées de plusieurs centaines de titres)
export default function useIncremental(items, step = 60) {
  const [count, setCount] = useState(step);
  const more = useCallback(() => setCount((c) => c + step), [step]);
  return { visible: items.slice(0, count), hasMore: items.length > count, more, count, remaining: Math.max(0, items.length - count) };
}
