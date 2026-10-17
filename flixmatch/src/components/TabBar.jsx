import { NavLink } from "react-router-dom";
import { useContext } from "react";
import { FiHome, FiLayers, FiSearch, FiBookmark, FiUser } from "react-icons/fi";
import { AuthContext } from "../AuthContext";

const TABS = [
  { to: "/", label: "Accueil", icon: FiHome, end: true },
  { to: "/discover", label: "Découverte", icon: FiLayers },
  { to: "/advanced-search", label: "Recherche", icon: FiSearch },
  { to: "/watchlist", label: "À voir", icon: FiBookmark, private: true },
  { to: "/account", label: "Profil", icon: FiUser, private: true },
];

// Barre d'onglets en bas (pouce) pour les petits écrans, avec safe area iOS
export default function TabBar() {
  const { user } = useContext(AuthContext);
  const tabs = TABS.map((t) => (t.private && !user ? { ...t, to: "/login" } : t));
  return (
    <nav
      aria-label="Navigation par onglets"
      className="safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-ink-950/90 backdrop-blur-lg md:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {tabs.map(({ to, label, icon: Icon, end }, i) => (
          <li key={`${label}-${i}`} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition ${
                  isActive && to !== "/login" ? "text-brand-400" : "text-zinc-400"
                }`
              }
            >
              <Icon size={22} aria-hidden="true" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
