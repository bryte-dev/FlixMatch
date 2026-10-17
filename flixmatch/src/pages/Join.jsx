import { useContext, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { AuthContext } from "../AuthContext";
import { useToast } from "../toastContext";
import Avatar from "../components/Avatar";
import AuthCard from "../components/AuthCard";
import { Button, ErrorState } from "../components/ui";

export default function Join() {
  const { code } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const toast = useToast();
  const [inviter, setInviter] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    axios.get(`/invite/${encodeURIComponent(code)}`).then((r) => setInviter(r.data)).catch(() => setError(true));
  }, [code]);

  const accept = async () => {
    try {
      await axios.post(`/users/${inviter.id}/follow`);
      toast(`Tu suis maintenant ${inviter.username || "cette personne"}`, "success");
      navigate(`/u/${inviter.id}`);
    } catch {
      toast("Action impossible", "error");
    }
  };

  if (error) return <div className="page"><ErrorState message="Invitation introuvable ou expirée." /></div>;
  return (
    <AuthCard title="Invitation FlixMatch" subtitle={inviter ? `${inviter.username || "Un ami"} t'invite à suivre ses films et séries.` : "Chargement…"}>
      {inviter && (
        <div className="flex flex-col items-center gap-4">
          <Avatar avatar={inviter.avatar} name={inviter.username} size={80} />
          {user ? (
            user.id === inviter.id ? <p>C&apos;est ton propre lien 🙂</p> : <Button variant="primary" onClick={accept}>Suivre {inviter.username}</Button>
          ) : (
            <div className="flex gap-2"><Link to="/register" className="btn btn-primary">Créer un compte</Link><Link to="/login" className="btn btn-secondary">Connexion</Link></div>
          )}
        </div>
      )}
    </AuthCard>
  );
}
