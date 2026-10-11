import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_URL } from "../api";
import AuthCard, { FormField } from "../components/AuthCard";
import { Button } from "../components/ui";
import { useToast } from "../toastContext";
import { errorMessage } from "../utils";

const Register = () => {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError("");

    if (!email || !password) {
      setError("Remplis tous les champs obligatoires.");
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/register`, { email, password, username });
      toast("Compte créé ! Tu peux te connecter.", "success");
      navigate("/login");
    } catch (err) {
      console.error("Erreur d'inscription :", err.response?.data || err.message);
      setError(errorMessage(err, "Erreur lors de l'inscription"));
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Créer un compte"
      subtitle="Gratuit, pour suivre tes films et séries."
      footer={<>Déjà inscrit ? <Link to="/login" className="font-semibold text-brand-300 hover:underline">Se connecter</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField id="email" label="Email" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} hint="Ton email n'est jamais affiché publiquement." />
        <FormField id="username" label="Nom d'utilisateur (optionnel)" type="text" autoComplete="nickname" maxLength={50} value={username} onChange={(e) => setUsername(e.target.value)} hint="Affiché à côté de tes avis." />
        <FormField id="password" label="Mot de passe" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} hint="8 caractères minimum." />
        {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        <Button type="submit" variant="primary" className="w-full" pending={loading} pendingLabel="Création…">Créer mon compte</Button>
      </form>
    </AuthCard>
  );
};

export default Register;
