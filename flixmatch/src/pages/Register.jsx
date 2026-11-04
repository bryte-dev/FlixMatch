import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { track } from "../lib/analytics";
import { API_URL } from "../api";
import AuthCard, { FormField } from "../components/AuthCard";
import UsernameField from "../components/UsernameField";
import { Button } from "../components/ui";
import { useToast } from "../toastContext";
import { useT } from "%s";
import { errorMessage } from "../utils";

const Register = () => {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [usernameOk, setUsernameOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const toast = useToast();
  const t = useT();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError("");

    if (!email || !password || !username) {
      setError(t("registerFillAll"));
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/register`, { email, password, username });
      track("user_signed_up");
      toast("Compte créé ! Tu peux te connecter.", "success");
      navigate("/login");
    } catch (err) {
      console.error("Erreur d'inscription :", err.response?.data || err.message);
      setError(errorMessage(err, t("registerFail")));
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title={t("createAccount")}
      subtitle={t("registerSubtitle")}
      footer={<>{t("alreadyRegistered")} <Link to="/login" className="font-semibold text-brand-300 hover:underline">{t("signIn")}</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField id="email" label={t("emailLabel")} type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} hint={t("emailPrivateHint")} />
        <UsernameField value={username} onChange={setUsername} onValidity={setUsernameOk} />
        <FormField id="password" label={t("passwordLabel")} type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} hint={t("password8Hint")} />
        {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        <Button type="submit" variant="primary" className="w-full" disabled={!usernameOk} pending={loading} pendingLabel={t("creating")}>{t("createMyAccount")}</Button>
      </form>
    </AuthCard>
  );
};

export default Register;
