import { useContext, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { AuthContext } from "../AuthContext";
import { useToast } from "../toastContext";
import Avatar from "../components/Avatar";
import MediaCard from "../components/MediaCard";
import { Button, EmptyState, ErrorState, MediaGrid, Spinner, Tabs } from "../components/ui";
import { useT } from "../i18n";
import { errorMessage, posterUrl } from "../utils";

export default function Profile() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const toast = useToast();
  const t = useT();
  const [tab, setTab] = useState(null);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setProfile(null);
    setTab(null);
    setError(false);
    axios.get(`/users/${encodeURIComponent(id)}`).then((r) => active && setProfile(r.data)).catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [id]);

  const toggleFollow = async () => {
    setBusy(true);
    try {
      if (profile.isFollowing) await axios.delete(`/users/${profile.id}/follow`);
      else await axios.post(`/users/${profile.id}/follow`);
      setProfile((p) => ({ ...p, isFollowing: !p.isFollowing, followers: p.followers + (p.isFollowing ? -1 : 1) }));
    } catch (err) {
      toast(errorMessage(err, "Action impossible"), "error");
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="page"><ErrorState message={t("profileNotFound")} /></div>;
  if (!profile) return <div className="page flex justify-center py-24 text-brand-400" role="status" aria-label="Chargement"><Spinner className="h-8 w-8" /></div>;

  const stats = profile.stats;
  const sections = profile.sections || {};
  const tabs = [
    ["seen", `${sections.seen?.visible ? "" : "🔒 "}${t("seen")}`],
    ["watchlist", `${sections.watchlist?.visible ? "" : "🔒 "}${t("watchlist")}`],
    ["tracking", `${sections.tracking?.visible ? "" : "🔒 "}${t("tracking")}`],
    ...(profile.favorites?.length > 0 ? [["favorites", t("favorites")]] : []),
  ];
  const current = tab || (sections.seen?.visible ? "seen" : sections.watchlist?.visible ? "watchlist" : sections.tracking?.visible ? "tracking" : "favorites");
  const section = sections[current];
  const items = current === "favorites" ? profile.favorites : section?.items;
  return (
    <div className="page max-w-5xl">
      <section className="surface relative mb-6 overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-brand-600/50 via-brand-500/20 to-transparent sm:h-32" aria-hidden="true" />
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3 px-5 pb-5 sm:px-8">
          <Avatar avatar={profile.avatar} name={profile.username} stats={stats} size={104} className="-mt-14 ring-4 ring-ink-950 sm:-mt-16" />
          <div className="min-w-0 flex-1 basis-48 pt-2">
            <h1 className="truncate text-2xl font-extrabold sm:text-3xl">{profile.username || `Utilisateur ${profile.id}`}</h1>
            <p className="mt-1 text-sm text-zinc-400">
              <span className="font-semibold text-zinc-200">{profile.followers}</span> {t("followersLabel")}
              <span aria-hidden="true"> · </span>
              <span className="font-semibold text-zinc-200">{profile.following}</span> {t("followingLabel")}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {profile.isSelf && <Link to="/account" className="btn btn-secondary">{t("account")}</Link>}
            {user && !profile.isSelf && (
              <Button variant={profile.isFollowing ? "secondary" : "primary"} pending={busy} onClick={toggleFollow}>{profile.isFollowing ? t("unfollow") : t("follow")}</Button>
            )}
            {!user && <Link to="/login" className="btn btn-primary">{t("loginToFollow")}</Link>}
          </div>
        </div>
      </section>

      {profile.restricted ? (
        <EmptyState icon="🔒" title={t("profilePrivateTitle")} text={t("profilePrivateText")} />
      ) : (
        <>
          {stats ? (
            <dl className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[[t("statMovies"), stats.moviesSeen], [t("statSeries"), stats.seriesFollowed], [t("statEpisodes"), stats.episodesWatched], [t("statHours"), stats.hoursWatched]].map(([label, value]) => (
                <div key={label} className="surface p-4 text-center sm:p-5"><dd className="text-2xl font-extrabold text-brand-400 sm:text-3xl">{value}</dd><dt className="mt-1 text-xs text-zinc-400">{label}</dt></div>
              ))}
            </dl>
          ) : null}
          <Tabs tabs={tabs} value={current} onChange={setTab} label={profile.username || ""} />
          {current !== "favorites" && !section?.visible ? (
            <EmptyState icon="🔒" title={t("sectionHidden")} />
          ) : !items || items.length === 0 ? (
            <EmptyState icon="🎞️" title={t("sectionEmpty")} />
          ) : (
            <MediaGrid>
              {items.map((m) => (
                <MediaCard
                  key={`${m.media_type}-${m.tmdb_id}`}
                  to={`/${m.media_type}/${m.tmdb_id}`}
                  title={m.title}
                  poster={posterUrl(m.poster_path)}
                  subtitle={m.total ? `${m.watched} / ${m.total}` : m.rating ? `★ ${m.rating}/5` : m.media_type === "tv" ? "Série" : "Film"}
                />
              ))}
            </MediaGrid>
          )}
        </>
      )}
    </div>
  );
}
