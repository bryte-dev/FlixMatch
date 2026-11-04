import { useState, useContext } from "react";
import { AuthContext } from "../AuthContext";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthCard, { FormField } from "../components/AuthCard";
import { Button } from "../components/ui";
import { useToast } from "../toastContext";
import { useT } from "%s";
import { errorMessage } from "../utils";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const t = useT();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");

    try {
      await login(email, password);
      toast("Content de te revoir !", "success");
      const from = location.state?.from;
      navigate(typeof from === "string" && from.startsWith("/") && !from.startsWith("//") ? from : "/");
    } catch (err) {
      console.error("Erreur de connexion", err);
      setError(errorMessage(err, t("loginFail")));
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title={t("login")}
      subtitle={t("loginSubtitle")}
      footer={<>{t("noAccountYet")} <Link to="/register" className="font-semibold text-brand-300 hover:underline">{t("signup")}</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField id="email" label={t("emailLabel")} type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        <FormField id="password" label={t("passwordLabel")} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        <Button type="submit" variant="primary" className="w-full" pending={loading} pendingLabel={t("loggingIn")}>{t("signIn")}</Button>
      </form>
    </AuthCard>
  );
};

export default Login;
