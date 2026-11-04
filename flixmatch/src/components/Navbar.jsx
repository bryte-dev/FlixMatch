import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useContext, useEffect, useRef, useState } from "react";
import { saveSettings } from "../settings";
import { unlockThemes } from "../theme";
import { AuthContext } from "../AuthContext";
import { FiHome, FiBookmark, FiPlayCircle, FiStar, FiEye, FiTrash2, FiSliders, FiLayers, FiSettings, FiUser, FiMenu, FiX, FiLogOut, FiChevronDown, FiFolder } from "react-icons/fi";
import { useT } from "../i18n";
import SearchBar from "./SearchBar";
import Avatar from "./Avatar";
import { useToast } from "../toastContext";

const HOME = { to: "/", key: "home", icon: FiHome, end: true };
const DISCOVER = { to: "/discover", key: "discover", icon: FiLayers };
const ADVANCED = { to: "/advanced-search", key: "advancedSearch", icon: FiSliders };
const MAIN_PRIVATE = [
  { to: "/watchlist", key: "watchlist", icon: FiBookmark },
  { to: "/tracking", key: "tracking", icon: FiPlayCircle },
];
const LIBRARY = [
  { to: "/favorites", key: "favorites", icon: FiStar },
  { to: "/seen", key: "seen", icon: FiEye },
  { to: "/junk", key: "trash", icon: FiTrash2 },
];

const linkClass = ({ isActive }) =>
  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? "bg-brand-500/15 text-brand-300" : "text-zinc-300 hover:bg-white/10 hover:text-white"
  }`;

// Menu déroulant : se ferme au clic extérieur, avec Échap et à chaque navigation
function Dropdown({ label, trigger, children, align = "left" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={label} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white">
        {trigger}
      </button>
      {open && (
        <div role="menu" className={`absolute top-full z-50 mt-2 min-w-48 rounded-xl border border-white/10 bg-ink-900 p-1.5 shadow-xl ${align === "right" ? "right-0" : "left-0"}`}>
          {children}
        </div>
      )}
    </div>
  );
}

const menuItem = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-white/10";

function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const taps = useRef({ count: 0, last: 0 });
  const { pathname } = useLocation();

  // Menu mobile : fermé à chaque changement de page et avec Échap
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Easter egg mobile : 7 appuis rapides sur le logo débloquent les thèmes bonus
  const onLogoTap = () => {
    const now = Date.now();
    taps.current.count = now - taps.current.last < 600 ? taps.current.count + 1 : 1;
    taps.current.last = now;
    if (taps.current.count >= 7) {
      taps.current.count = 0;
      unlockThemes();
      saveSettings({ theme: "neon" });
      toast("🎉 Thèmes secrets débloqués ! Retrouve-les dans les paramètres.", "success");
    }
  };

  const mobileLinks = user ? [HOME, ...MAIN_PRIVATE, ...LIBRARY, DISCOVER, ADVANCED] : [HOME, DISCOVER, ADVANCED];
  const desktopLinks = user ? [HOME, DISCOVER, ...MAIN_PRIVATE] : [HOME, DISCOVER, ADVANCED];
  const profilePath = user?.username ? `/u/${encodeURIComponent(user.username)}` : "/account";
  const closeMenu = () => setMenuOpen(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      closeMenu();
      navigate("/");
      toast("Tu es déconnecté.", "success");
    } catch {
      toast("La déconnexion a échoué.", "error");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="safe-top sticky top-0 z-50 border-b border-white/10 bg-ink-950/80 backdrop-blur-lg">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-[60] focus:rounded-lg focus:bg-brand-600 focus:px-3 focus:py-2"
      >
        Aller au contenu
      </a>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" onClick={onLogoTap} className="no-select flex shrink-0 items-center gap-2" aria-label="FlixMatch, accueil">
          <img src="/FlixMatchLogo.png" alt="" className="h-9 w-9 lg:hidden" />
          <img src="/FlixMatch.png" alt="FlixMatch" className="hidden h-6 w-auto lg:block" />
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Navigation principale">
          {desktopLinks.map(({ to, key: k, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClass} title={t(k)}>
              <Icon aria-hidden="true" />
              <span className="hidden lg:inline">{t(k)}</span>
              <span className="sr-only lg:hidden">{t(k)}</span>
            </NavLink>
          ))}
          {user && (
            <Dropdown label={t("library")} trigger={<><FiFolder aria-hidden="true" /><span className="hidden lg:inline">{t("library")}</span><FiChevronDown aria-hidden="true" size={14} /></>}>
              {[...LIBRARY, ADVANCED].map(({ to, key: k, icon: Icon }) => (
                <NavLink key={to} to={to} role="menuitem" className={menuItem}><Icon aria-hidden="true" /> {t(k)}</NavLink>
              ))}
            </Dropdown>
          )}
        </nav>

        <div className="ml-auto hidden w-full min-w-0 max-w-xs md:block">
          <SearchBar />
        </div>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {user ? (
            <div className="hidden md:block">
              <Dropdown
                align="right"
                label={t("account")}
                trigger={<><Avatar avatar={user.avatar} name={user.username} size={30} /><span className="hidden max-w-28 truncate lg:inline">{user.username || t("account")}</span><FiChevronDown aria-hidden="true" size={14} /></>}
              >
                <NavLink to={profilePath} role="menuitem" className={menuItem}><FiUser aria-hidden="true" /> {t("myProfile")}</NavLink>
                <NavLink to="/account" role="menuitem" className={menuItem}><FiSettings aria-hidden="true" /> {t("account")}</NavLink>
                <NavLink to="/settings" role="menuitem" className={menuItem}><FiSliders aria-hidden="true" /> {t("settings")}</NavLink>
                <button type="button" role="menuitem" onClick={handleLogout} disabled={loggingOut} className={`${menuItem} text-red-300`}><FiLogOut aria-hidden="true" /> {t("logout")}</button>
              </Dropdown>
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <NavLink to="/settings" className={linkClass} title={t("settings")} aria-label={t("settings")}>
                <FiSettings aria-hidden="true" />
              </NavLink>
              <Link to="/login" className="btn btn-ghost btn-sm">{t("login")}</Link>
              <Link to="/register" className="btn btn-primary btn-sm">{t("signup")}</Link>
            </div>
          )}
          <button
            type="button"
            className="btn btn-ghost !px-2 md:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-controls="menu-mobile"
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
          >
            {menuOpen ? <FiX size={22} /> : <FiMenu size={22} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div id="menu-mobile" className="max-h-[calc(100dvh-4rem-env(safe-area-inset-top))] overflow-y-auto overscroll-contain border-t border-white/10 bg-ink-900/95 px-4 pb-4 pt-3 md:hidden">
          <SearchBar onNavigate={closeMenu} className="mb-3" />
          <nav className="flex flex-col gap-1" aria-label="Navigation mobile">
            {mobileLinks.map(({ to, key: k, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={linkClass} onClick={closeMenu}>
                <Icon aria-hidden="true" /> {t(k)}
              </NavLink>
            ))}
            {user ? (
              <>
                <NavLink to={profilePath} className={linkClass} onClick={closeMenu}>
                  <FiUser aria-hidden="true" /> {t("myProfile")}
                </NavLink>
                <NavLink to="/account" className={linkClass} onClick={closeMenu}>
                  <FiSettings aria-hidden="true" /> {t("account")}
                </NavLink>
                <NavLink to="/settings" className={linkClass} onClick={closeMenu}>
                  <FiSliders aria-hidden="true" /> {t("settings")}
                </NavLink>
                <button type="button" onClick={handleLogout} disabled={loggingOut} className="btn btn-secondary mt-2">
                  <FiLogOut aria-hidden="true" /> {t("logout")}
                </button>
              </>
            ) : (
              <div className="mt-2 flex gap-2">
                <Link to="/login" onClick={closeMenu} className="btn btn-secondary flex-1">{t("login")}</Link>
                <Link to="/register" onClick={closeMenu} className="btn btn-primary flex-1">{t("signup")}</Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

export default Navbar;
