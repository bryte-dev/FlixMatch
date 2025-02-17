import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

const Register = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    console.log("🔍 Tentative d'inscription avec :", email, password); // 🔥 Debug
    
    if (!email || !password) {
      alert("Remplis tous les champs !");
      return;
    }
  
    try {
      const response = await axios.post("http://localhost:3000/register", 
        { email, password }, 
        { withCredentials: true } // 🔥 Active les cookies si besoin
      );
      
      console.log("✅ Inscription réussie :", response.data);
      alert("Inscription réussie !");
      navigate("/login");
  
    } catch (error) {
      console.error("❌ Erreur d'inscription :", error.response?.data || error.message);
      alert(error.response?.data?.error || "Erreur serveur");
    }
  };
  
  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-center mb-4">Créer un compte</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="p-2 border rounded"/>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" className="p-2 border rounded"/>
        <button type="submit" className="bg-green-500 text-white p-2 rounded">S'inscrire</button>
      </form>
      <p className="text-center mt-4">
        Déjà un compte ? <Link to="/login" className="text-blue-500">Se connecter</Link>
      </p>
    </div>
  );
};

export default Register;
