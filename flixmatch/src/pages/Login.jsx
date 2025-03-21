import { useState, useContext } from "react";
import { AuthContext } from "../AuthContext";
import { Link, useNavigate } from "react-router-dom";
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
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "error"
  });
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await login(email, password);
      navigate("/");
    } catch (error) {
      console.error("Erreur de connexion", error);
      setSnackbar({
        open: true,
        message: "Échec de la connexion. Vérifiez vos identifiants.",
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
          <Avatar sx={{ m: 1, bgcolor: 'primary.main', width: 56, height: 56 }}>
            <LockOutlinedIcon fontSize="large" />
          </Avatar>
          <Typography component="h1" variant="h5" sx={{ mt: 2 }}>
            Connexion
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
            color="primary"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={24} color="inherit" /> : null}
            sx={{ py: 1.5 }}
          >
            {loading ? "Connexion en cours..." : "Se connecter"}
          </Button>
          
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="body2">
              Pas encore de compte ? <Link to="/register" style={{ color: '#4caf50', textDecoration: 'none' }}>Créer un compte</Link>
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

export default Login;
