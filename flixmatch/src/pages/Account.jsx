import { useState, useContext } from "react";
import axios from "axios";
import { AuthContext } from "../AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { FiLogOut } from "react-icons/fi";
import AuthCard, { FormField } from "../components/AuthCard";
import Avatar, { PRESETS, imageToAvatar } from "../components/Avatar";
import { Button } from "../components/ui";
import PrivacyDangerZone from "../components/PrivacyDangerZone";
import { useToast } from "../toastContext";

const LEVELS = { public: "Public", friends: "Amis (abonnement mutuel)", private: "Privé" };
const SECTIONS = [["privacyProfile", "Profil"], ["privacyLibrary", "Bibliothèque et stats"], ["privacyActivity", "Activité"]];

const Account = () => {
  const { user, logout, updateProfile } = useContext(AuthContext);
  const navigate = useNavigate();
  const toast = useToast();
  const [username, setUsername] = useState(user?.username || "");
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [invite, setInvite] = useState("");

  const save = async (patch, message = "Profil mis à jour") => {
    const ok = await updateProfile(patch);
    toast(ok ? message : "Impossible de mettre à jour le profil", ok ? "success" : "error");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    await save({ username });
    setSaving(false);
  };

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await save({ avatar: await imageToAvatar(file) });
    } catch {
      toast("Image illisible", "error");
    }
  };

  const getInvite = async () => {
    try {
      const { data } = await axios.get("/invite");
      const link = `${window.location.origin}/join/${data.code}`;
      setInvite(link);
      await navigator.clipboard?.writeText(link).catch(() => {});
      toast("Lien d'invitation copié", "success");
    } catch {
      toast("Impossible de créer le lien", "error");
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      toast("Tu es déconnecté.", "success");
      navigate("/");
    } catch {
      toast("La déconnexion a échoué.", "error");
      setLoggingOut(false);
    }
  };

  return (
    <AuthCard title="Mon compte" subtitle="Gère ton profil, ton avatar et ta confidentialité.">
      <div className="mb-5 flex flex-col items-center gap-3">
        <Avatar avatar={user?.avatar} name={user?.username || user?.email} size={80} />
        <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Avatars prédéfinis">
          {Object.entries(PRESETS).map(([id, [emoji]]) => (
            <button key={id} type="button" className="btn btn-sm btn-secondary !px-2" aria-label={`Avatar ${id}`} onClick={() => save({ avatar: `preset:${id}` })}>{emoji}</button>
          ))}
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => save({ avatar: null })}>Généré (stats)</button>
        </div>
        <label className="btn btn-sm btn-secondary cursor-pointer">
          Téléverser une photo
          <input type="file" accept="image/*" className="sr-only" onChange={onUpload} />
        </label>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField id="email" label="Email" type="email" value={user?.email || ""} disabled readOnly hint="Visible uniquement par toi." />
        <FormField id="username" label="Nom d'utilisateur" type="text" maxLength={50} value={username} onChange={(e) => setUsername(e.target.value)} hint="Affiché à côté de tes avis." />
        <Button type="submit" variant="primary" className="w-full" pending={saving} pendingLabel="Enregistrement…">Enregistrer</Button>
      </form>

      <h2 className="mb-2 mt-6 font-bold">Confidentialité</h2>
      <div className="space-y-3">
        {SECTIONS.map(([field, label]) => (
          <label key={field} className="block text-sm font-medium">
            <span className="mb-1 block">{label}</span>
            <select className="field" value={user?.[field] || "public"} onChange={(e) => save({ [field]: e.target.value }, "Confidentialité mise à jour")}>
              {Object.entries(LEVELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        ))}
      </div>

      <h2 className="mb-2 mt-6 font-bold">Amis</h2>
      <div className="flex flex-wrap gap-2">
        <Link to={`/u/${user?.id}`} className="btn btn-secondary">Mon profil public</Link>
        <Link to="/activity" className="btn btn-secondary">Activité des amis</Link>
        <Button onClick={getInvite}>Lien d&apos;invitation</Button>
      </div>
      {invite && <p className="mt-2 break-all text-xs text-zinc-400">{invite}</p>}

      <Button className="mt-6 w-full" pending={loggingOut} pendingLabel="Déconnexion…" onClick={handleLogout}>
        <FiLogOut aria-hidden="true" /> Se déconnecter
      </Button>

      <h2 className="mb-2 mt-8 font-bold">Données et confidentialité</h2>
      <PrivacyDangerZone />
    </AuthCard>
  );
};

export default Account;
