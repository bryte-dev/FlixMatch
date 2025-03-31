import { useState, useContext, useEffect } from "react";
import { AuthContext } from "../AuthContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { 
  Container, 
  Typography, 
  TextField, 
  Button, 
  Paper, 
  Box, 
  Avatar, 
  Snackbar, 
  Alert,
  CircularProgress
} from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import SaveIcon from '@mui/icons-material/Save';
import LogoutIcon from '@mui/icons-material/Logout';

const Account = () => {
  const { user, logout } = useContext(AuthContext); // 🔥 Ajout de setUser pour gérer la déconnexion
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false); // 🔥 Pour gérer l'état du bouton de déconnexion
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success"
  });
  
  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    const fetchUserData = async () => {
      try {
        const response = await axios.get("${process.env.VITE_API_URL}/me", { withCredentials: true });
        setEmail(response.data.email || "");
        setUsername(response.data.username || "");
        setLoading(false);
      } catch (error) {
        console.error("Erreur lors de la récupération des données utilisateur:", error);
        setSnackbar({
          open: true,
          message: "Impossible de récupérer vos informations",
          severity: "error"
        });
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await axios.put(
        "${process.env.VITE_API_URL}/account/update",
        { username },
        { withCredentials: true }
      );
      
      setSnackbar({
        open: true,
        message: "Profil mis à jour avec succès !",
        severity: "success"
      });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du profil:", error);
      setSnackbar({
        open: true,
        message: "Erreur lors de la mise à jour du profil",
        severity: "error"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ mt: 12, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 12 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
          <Avatar sx={{ m: 1, bgcolor: 'primary.main', width: 56, height: 56 }}>
            <AccountCircleIcon fontSize="large" />
          </Avatar>
          <Typography component="h1" variant="h5" sx={{ mt: 2 }}>
            Mon Profil
          </Typography>
        </Box>

        <form onSubmit={handleSubmit}>
          <TextField
            margin="normal"
            fullWidth
            label="Email"
            value={email}
            disabled
            variant="outlined"
            sx={{ mb: 2 }}
          />
          
          <TextField
            margin="normal"
            required
            fullWidth
            label="Nom d'utilisateur"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            variant="outlined"
            sx={{ mb: 3 }}
          />
          
          <Button
            type="submit"
            fullWidth
            variant="contained"
            color="primary"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={24} /> : <SaveIcon />}
            sx={{ py: 1.5, mb: 2 }} // 🔥 Ajout d'un margin-bottom
          >
            {saving ? "Enregistrement..." : "Enregistrer les modifications"}
          </Button>
        </form>

        {/* 🔥 Bouton de déconnexion */}
        <Button
          onClick={handleLogout}
          fullWidth
          variant="contained"
          color="error"
          disabled={loggingOut}
          startIcon={loggingOut ? <CircularProgress size={24} /> : <LogoutIcon />}
          sx={{ py: 1.5 }}
        >
          {loggingOut ? "Déconnexion..." : "Se déconnecter"}
        </Button>

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

export default Account;
