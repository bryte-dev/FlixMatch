import { useState, useContext } from "react";
import { AuthContext } from "../AuthContext";
import { useNavigate } from "react-router-dom";
import { FiLogOut } from "react-icons/fi";
import AuthCard, { FormField } from "../components/AuthCard";
import { Button } from "../components/ui";
import { useToast } from "../toastContext";

const Account = () => {
  const { user, logout, updateProfile } = useContext(AuthContext);
  const navigate = useNavigate();
  const toast = useToast();
  const [username, setUsername] = useState(user?.username || "");
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const ok = await updateProfile({ username });
    setSaving(false);
    toast(ok ? "Profil mis à jour" : "Impossible de mettre à jour le profil", ok ? "success" : "error");
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
    <AuthCard title="Mon compte" subtitle="Gère ton profil public.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField id="email" label="Email" type="email" value={user?.email || ""} disabled readOnly hint="Visible uniquement par toi." />
        <FormField id="username" label="Nom d'utilisateur" type="text" maxLength={50} value={username} onChange={(e) => setUsername(e.target.value)} hint="Affiché à côté de tes avis." />
        <Button type="submit" variant="primary" className="w-full" pending={saving} pendingLabel="Enregistrement…">Enregistrer</Button>
      </form>
      <Button className="mt-3 w-full" pending={loggingOut} pendingLabel="Déconnexion…" onClick={handleLogout}>
        <FiLogOut aria-hidden="true" /> Se déconnecter
      </Button>
    </AuthCard>
  );
};

export default Account;
