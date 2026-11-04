import { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useToast } from "../toastContext";
import { useT } from "../i18n";
import { normalizeCode } from "../lib/night";
import { track } from "../lib/analytics";
import { FREE_NIGHT_ROOMS_PER_DAY, roomsCreatedToday } from "../lib/pro";
import { usePro } from "../proContext";
import { AuthContext } from "../AuthContext";
import ProBadge from "../components/ProBadge";
import { Button, PageHeader, Tabs } from "../components/ui";
import { errorMessage } from "../utils";

const STATUS_KEYS = { LOBBY: "nightStatusLobby", ACTIVE: "nightStatusActive", ENDED: "nightStatusEnded" };

export default function MovieNight() {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { openPro } = usePro();
  const [mediaType, setMediaType] = useState("movie");
  const [codeInput, setCodeInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    axios.get("/night").then((r) => setRecent(r.data)).catch(() => {});
  }, []);

  const overFreeLimit = roomsCreatedToday(recent, user?.id) >= FREE_NIGHT_ROOMS_PER_DAY;

  const doCreate = async () => {
    setBusy(true);
    try {
      const { data } = await axios.post("/night", { mediaType });
      track("movie_night_created", { media_type: mediaType, rooms_today: roomsCreatedToday(recent, user?.id) + 1 });
      navigate(`/movie-night/${data.code}`);
    } catch (err) {
      toast(errorMessage(err, t("nightNotFound")), "error");
      setBusy(false);
    }
  };

  // Au-delà du quota gratuit « théorique », la création reste possible : l'entrée Pro mesure l'intérêt
  const create = () => (overFreeLimit ? openPro("night_rooms", { source: "movie_night_create", onContinue: doCreate }) : doCreate());

  const join = (e) => {
    e.preventDefault();
    const code = normalizeCode(codeInput);
    if (!code) return toast(t("nightCodeInvalid"), "error");
    navigate(`/movie-night/${code}`);
  };

  return (
    <div className="page max-w-3xl">
      <PageHeader title={`🍿 ${t("nightTitle")}`} subtitle={t("nightIntro")} />
      <div className="grid gap-4 md:grid-cols-2">
        <section className="surface p-5">
          <h2 className="mb-3 text-lg font-bold">{t("nightCreate")}</h2>
          <Tabs tabs={[["movie", t("nightMovies")], ["tv", t("nightSeries")]]} value={mediaType} onChange={setMediaType} label={t("nightCreate")} />
          <Button variant="primary" pending={busy} onClick={create} className="w-full">{t("nightCreate")}{overFreeLimit && <ProBadge feature="night_rooms" source="movie_night_create" className="ml-2" />}</Button>
        </section>
        <form className="surface p-5" onSubmit={join}>
          <h2 className="mb-3 text-lg font-bold">{t("nightJoinTitle")}</h2>
          <label htmlFor="night-code" className="sr-only">{t("nightCodeLabel")}</label>
          <input id="night-code" className="input mb-3 w-full uppercase tracking-widest" placeholder={t("nightCodeLabel")} value={codeInput} onChange={(e) => setCodeInput(e.target.value)} autoComplete="off" autoCapitalize="characters" />
          <Button type="submit" className="w-full">{t("nightJoin")}</Button>
        </form>
      </div>
      {recent.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold">{t("nightRecent")}</h2>
          <ul className="grid gap-2">
            {recent.map((r) => (
              <li key={r.code}>
                <Link to={`/movie-night/${r.code}`} className="surface flex items-center justify-between gap-3 p-3 transition hover:border-brand-400/40">
                  <span className="font-mono text-lg tracking-widest">{r.code}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-zinc-400">{t("nightHostedBy")} {r.host?.username || "?"} · {r.members} {t("nightPlayersCount")}</span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs">{t(STATUS_KEYS[r.status])}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
