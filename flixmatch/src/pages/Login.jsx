import { useState, useContext } from "react";
import { AuthContext } from "../AuthContext";
import { Link, useNavigate } from "react-router-dom";
import AuthCard, { FormField } from "../components/AuthCard";
import { Button } from "../components/ui";
import { useToast } from "../toastContext";
import { errorMessage } from "../utils";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");

    try {
      await login(email, password);
      toast("Content de te revoir !", "success");
      navigate("/");
    } catch (err) {
      console.error("Erreur de connexion", err);
      setError(errorMessage(err, "Échec de la connexion. Vérifie tes identifiants."));
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Connexion"
      subtitle="Retrouve ta watchlist et tes séries en cours."
      footer={<>Pas encore de compte ? <Link to="/register" className="font-semibold text-brand-300 hover:underline">S&apos;inscrire</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField id="email" label="Email" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        <FormField id="password" label="Mot de passe" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        <Button type="submit" variant="primary" className="w-full" pending={loading} pendingLabel="Connexion…">Se connecter</Button>
      </form>
    </AuthCard>
  );
};

export default Login;
