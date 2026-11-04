import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { API_URL } from "../api";

// État d'un salon Movie Night : lecture initiale + flux SSE (les événements déclenchent une relecture)
// + relecture lente de secours si le flux est coupé (proxy, mise en veille mobile).
export default function useNightRoom(code, onMatch) {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const matchRef = useRef(onMatch);
  useEffect(() => {
    matchRef.current = onMatch;
  });

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/night/${encodeURIComponent(code)}`);
      setState(data);
      setError(null);
      return data;
    } catch (err) {
      setError(err.response?.data?.reason || "error");
      return null;
    }
  }, [code]);

  useEffect(() => {
    setState(null);
    setError(null);
    load();
  }, [load]);

  const isMember = Boolean(state?.member);
  const status = state?.room?.status;
  useEffect(() => {
    if (!isMember || status === "ENDED" || typeof EventSource === "undefined") return undefined;
    const source = new EventSource(`${API_URL}/night/${encodeURIComponent(code)}/events`, { withCredentials: true });
    const refresh = () => load();
    source.addEventListener("update", refresh);
    source.addEventListener("ended", refresh);
    source.addEventListener("match", (e) => {
      try {
        matchRef.current?.(JSON.parse(e.data));
      } catch {
        /* événement illisible : la relecture suffit */
      }
      load();
    });
    source.onopen = refresh;
    const poll = setInterval(refresh, 15000);
    return () => {
      source.close();
      clearInterval(poll);
    };
  }, [code, isMember, status, load]);

  return { state, error, reload: load };
}
