import { useState } from "react";
import axios from "axios";
import { FormField } from "./AuthCard";
import { BottomSheet, Button } from "./ui";
import { useToast } from "../toastContext";
import { errorMessage } from "../utils";

// Caches locaux liés à la bibliothèque (ex. séries abandonnées) à vider après un reset/une suppression
const LIBRARY_CACHE_KEYS = ["fm-abandoned"];
const clearLibraryCaches = () => {
  try {
    LIBRARY_CACHE_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* stockage indisponible : rien à nettoyer */
  }
};

export default function PrivacyDangerZone() {
  const toast = useToast();
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const closeReset = () => {
    setResetOpen(false);
    setResetConfirm("");
  };

  const closeDelete = () => {
    setDeleteOpen(false);
    setDeleteConfirm("");
    setPassword("");
  };

  const resetData = async (e) => {
    e.preventDefault();
    if (resetting || resetConfirm !== "RESET") return;
    setResetting(true);
    try {
      await axios.post("/account/reset-data", { confirm: "RESET" });
      clearLibraryCaches();
      toast("Tes listes, notes, avis et l'historique ont été effacés. Ton compte est conservé.", "success");
      closeReset();
    } catch (err) {
      toast(errorMessage(err, "Réinitialisation impossible"), "error");
    } finally {
      setResetting(false);
    }
  };

  const deleteAccount = async (e) => {
    e.preventDefault();
    if (deleting || deleteConfirm !== "DELETE" || !password) return;
    setDeleting(true);
    try {
      await axios.delete("/account", { data: { password, confirm: "DELETE" } });
      clearLibraryCaches();
      toast("Compte supprimé.", "success");
      window.location.assign("/");
    } catch (err) {
      toast(errorMessage(err, "Suppression impossible"), "error");
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="space-y-3">
        <p className="text-sm text-zinc-400">
          Ces actions sont définitives. Exporte tes données avant si tu veux les conserver.
        </p>
        <Button className="w-full" onClick={() => setResetOpen(true)}>
          Réinitialiser mes données
        </Button>
        <Button variant="danger" className="w-full" onClick={() => setDeleteOpen(true)}>
          Supprimer mon compte et toutes mes données
        </Button>
      </div>

      <BottomSheet open={resetOpen} onClose={closeReset} title="Réinitialiser mes données">
        <form onSubmit={resetData} className="space-y-3">
          <p className="text-sm text-zinc-300">
            Watchlist, favoris, vus, corbeille, notes, avis (avec les réponses publiées sous tes
            avis) et épisodes marqués comme vus seront effacés. Ton compte, ton email, ton mot de
            passe, ton profil et tes abonnements sont conservés.
          </p>
          <FormField
            id="reset-confirm"
            label='Tape RESET pour confirmer'
            type="text"
            autoComplete="off"
            value={resetConfirm}
            onChange={(e) => setResetConfirm(e.target.value)}
            required
          />
          <Button
            type="submit"
            variant="danger"
            className="w-full"
            pending={resetting}
            pendingLabel="Réinitialisation…"
            disabled={resetConfirm !== "RESET"}
          >
            Tout effacer (conserver mon compte)
          </Button>
        </form>
      </BottomSheet>

      <BottomSheet open={deleteOpen} onClose={closeDelete} title="Supprimer mon compte">
        <form onSubmit={deleteAccount} className="space-y-3">
          <p className="text-sm text-zinc-300">
            Cette action est définitive : ton compte, tes identifiants, ta bibliothèque, tes
            épisodes vus, tes abonnements et tes avis (avec les réponses publiées dessous) seront
            supprimés. Confirme en tapant DELETE puis ton mot de
            passe.
          </p>
          <FormField
            id="del-confirm"
            label='Tape DELETE pour confirmer'
            type="text"
            autoComplete="off"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            required
          />
          <FormField
            id="del-password"
            label="Mot de passe"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button
            type="submit"
            variant="danger"
            className="w-full"
            pending={deleting}
            pendingLabel="Suppression…"
            disabled={deleteConfirm !== "DELETE" || !password}
          >
            Supprimer définitivement
          </Button>
        </form>
      </BottomSheet>
    </>
  );
}
