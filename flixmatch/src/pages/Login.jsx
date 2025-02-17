import { useState, useContext } from "react";
import { AuthContext } from "../AuthContext";
import { Link, useNavigate } from "react-router-dom";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate("/");
    } catch (error) {
      console.error("Erreur de connexion", error);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-center mb-4">Connexion</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="p-2 border rounded"/>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" className="p-2 border rounded"/>
        <button type="submit" className="bg-blue-500 text-white p-2 rounded">Se connecter</button>
      </form>
      <p className="text-center mt-4">
        Pas encore de compte ? <Link to="/register" className="text-green-500">Créer un compte</Link>
      </p>
    </div>
  );
};

export default Login;
