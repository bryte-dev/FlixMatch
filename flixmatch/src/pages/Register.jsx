import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { 
  Container, 
  Typography, 
  TextField, 
  Button, 
  Paper, 
  Box, 
  Avatar,
  CircularProgress,
  Alert,
  Snackbar
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';

const Register = () => {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success"
  });
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
  
    console.log("🔍 Tentative d'inscription avec :", email, username, password); // 🔥 Debug
    
    if (!email || !password) {
      setSnackbar({
        open: true,
        message: "Veuillez remplir tous les champs obligatoires",
        severity: "error"
      });
      setLoading(false);
      return;
    }
  
    try {
      const response = await axios.post(`${import.meta.env.VITE_BACK_API_URL}/register`, 
        { email, password, username }, 
        { withCredentials: true } // 🔥 Active les cookies si besoin
      );
      
      console.log("✅ Inscription réussie :", response.data);
      setSnackbar({
        open: true,
        message: "Inscription réussie ! Redirection vers la page de connexion...",
        severity: "success"
      });
      
      setTimeout(() => {
        navigate("/login");
      }, 2000);
  
    } catch (error) {
      console.error("❌ Erreur d'inscription :", error.response?.data || error.message);
      setSnackbar({
        open: true,
        message: error.response?.data?.error || "Erreur lors de l'inscription",
        severity: "error"
      });
      setLoading(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };
  
  return (
    <Container maxWidth="sm" sx={{ mt: 12 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
          <Avatar sx={{ m: 1, bgcolor: 'success.main', width: 56, height: 56 }}>
            <PersonAddIcon fontSize="large" />
          </Avatar>
          <Typography component="h1" variant="h5" sx={{ mt: 2 }}>
            Créer un compte
          </Typography>
        </Box>

        <form onSubmit={handleSubmit}>
          <TextField
            margin="normal"
            required
            fullWidth
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            variant="outlined"
            sx={{ mb: 2 }}
          />
          
          <TextField
            margin="normal"
            fullWidth
            label="Nom d'utilisateur (optionnel)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            variant="outlined"
            sx={{ mb: 2 }}
          />
          
          <TextField
            margin="normal"
            required
            fullWidth
            label="Mot de passe"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            variant="outlined"
            sx={{ mb: 3 }}
          />
          
          <Button
            type="submit"
            fullWidth
            variant="contained"
            color="success"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={24} color="inherit" /> : null}
            sx={{ py: 1.5 }}
          >
            {loading ? "Inscription en cours..." : "S'inscrire"}
          </Button>
          
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="body2">
              Déjà un compte ? <Link to="/login" style={{ color: '#3f51b5', textDecoration: 'none' }}>Se connecter</Link>
            </Typography>
          </Box>
        </form>
      </Paper>

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Register;
