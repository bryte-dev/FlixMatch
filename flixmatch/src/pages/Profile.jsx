import { useContext, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { AuthContext } from "../AuthContext";
import { useToast } from "../toastContext";
import Avatar from "../components/Avatar";
import MediaCard from "../components/MediaCard";
import { Button, EmptyState, ErrorState, MediaGrid, Spinner } from "../components/ui";
import { errorMessage, posterUrl } from "../utils";

export default function Profile() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setProfile(null);
    setError(false);
    axios.get(`/users/${id}`).then((r) => active && setProfile(r.data)).catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [id]);

  const toggleFollow = async () => {
    setBusy(true);
    try {
      if (profile.isFollowing) await axios.delete(`/users/${id}/follow`);
      else await axios.post(`/users/${id}/follow`);
      setProfile((p) => ({ ...p, isFollowing: !p.isFollowing, followers: p.followers + (p.isFollowing ? -1 : 1) }));
    } catch (err) {
      toast(errorMessage(err, "Action impossible"), "error");
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="page"><ErrorState message="Profil introuvable." /></div>;
  if (!profile) return <div className="page flex justify-center py-24 text-brand-400" role="status" aria-label="Chargement"><Spinner className="h-8 w-8" /></div>;

  const stats = profile.stats;
  return (
    <div className="page max-w-3xl">
      <section className="surface mb-6 flex flex-wrap items-center gap-4 p-5">
        <Avatar avatar={profile.avatar} name={profile.username} stats={stats} size={88} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold">{profile.username || `Utilisateur ${profile.id}`}</h1>
          <p className="text-sm text-zinc-400">{profile.followers} abonnés · {profile.following} abonnements</p>
        </div>
        {user && !profile.isSelf && (
          <Button variant={profile.isFollowing ? "secondary" : "primary"} pending={busy} onClick={toggleFollow}>{profile.isFollowing ? "Se désabonner" : "Suivre"}</Button>
        )}
        {!user && <Link to="/login" className="btn btn-primary">Connexion pour suivre</Link>}
      </section>

      {profile.restricted ? (
        <EmptyState icon="🔒" title="Profil privé" text="Cette personne ne partage pas son profil avec toi." />
      ) : (
        <>
          {stats ? (
            <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[["Films vus", stats.moviesSeen], ["Séries suivies", stats.seriesFollowed], ["Épisodes vus", stats.episodesWatched], ["Heures (est.)", stats.hoursWatched]].map(([label, value]) => (
                <div key={label} className="surface p-4 text-center"><dd className="text-2xl font-extrabold text-brand-400">{value}</dd><dt className="text-xs text-zinc-400">{label}</dt></div>
              ))}
            </dl>
          ) : (
            <p className="mb-6 text-sm text-zinc-400">La bibliothèque est masquée.</p>
          )}
          {profile.favorites?.length > 0 && (
            <>
              <h2 className="mb-3 text-xl font-bold">Favoris</h2>
              <MediaGrid>
                {profile.favorites.map((f) => (
                  <MediaCard key={f.tmdb_id} to={`/${f.media_type}/${f.tmdb_id}`} title={f.title} poster={posterUrl(f.poster_path)} subtitle={f.media_type === "tv" ? "Série" : "Film"} />
                ))}
              </MediaGrid>
            </>
          )}
        </>
      )}
    </div>
  );
}
