import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Avatar from "../components/Avatar";
import { EmptyState, ErrorState, PageHeader, Spinner } from "../components/ui";
import { formatDate } from "../utils";

const VERBS = { seen: "a vu", watchlist: "a ajouté à sa liste", review: "a noté", episode: "a regardé" };

export default function Activity() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [found, setFound] = useState([]);

  useEffect(() => {
    axios.get("/feed").then((r) => setItems(r.data)).catch(() => setError(true));
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setFound([]);
      return undefined;
    }
    const timer = setTimeout(() => axios.get("/users/search", { params: { q } }).then((r) => setFound(r.data)).catch(() => setFound([])), 350);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <div className="page max-w-2xl">
      <PageHeader title="Activité des amis" subtitle="Ce que regardent les personnes que tu suis." />
      <section className="surface mb-6 p-4">
        <label className="block text-sm font-medium"><span className="mb-1 block">Chercher des utilisateurs</span>
          <input type="search" className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom d'utilisateur" />
        </label>
        {found.length > 0 && (
          <ul className="mt-3 space-y-2">
            {found.map((u) => (
              <li key={u.id}><Link to={`/u/${u.id}`} className="flex items-center gap-3 rounded-lg p-1 hover:bg-white/5"><Avatar avatar={u.avatar} name={u.username} size={36} />{u.username}</Link></li>
            ))}
          </ul>
        )}
      </section>
      {error ? <ErrorState message="Impossible de charger le fil." /> : !items ? (
        <div className="flex justify-center text-brand-400" role="status" aria-label="Chargement"><Spinner className="h-7 w-7" /></div>
      ) : items.length === 0 ? (
        <EmptyState icon="👥" title="Rien pour l'instant" text="Suis des amis (recherche ou lien d'invitation) pour voir leur activité." />
      ) : (
        <ul className="space-y-3">
          {items.map((it, i) => (
            <li key={`${it.type}-${it.user?.id}-${it.media.tmdb_id}-${i}`} className="surface flex items-center gap-3 p-3">
              <Avatar avatar={it.user?.avatar} name={it.user?.username} size={40} />
              <p className="min-w-0 flex-1 text-sm">
                <Link to={`/u/${it.user?.id}`} className="font-semibold hover:underline">{it.user?.username || "Quelqu'un"}</Link> {VERBS[it.type]}{" "}
                <Link to={`/${it.media.media_type}/${it.media.tmdb_id}`} className="font-semibold text-brand-300 hover:underline">
                  {it.media.title || "une série"}{it.type === "episode" ? ` S${it.season}·E${it.episode}` : ""}
                </Link>
                {it.type === "review" && it.rating ? ` (${it.rating}/5)` : ""}
                <span className="block text-xs text-zinc-500">{formatDate(it.at)}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
