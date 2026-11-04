import { useState } from "react";
import axios from "axios";
import { FormField } from "./AuthCard";
import { BottomSheet, Button } from "./ui";
import { useToast } from "../toastContext";
import { useT } from "../i18n";
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
  const t = useT();
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
      toast(t("resetDone"), "success");
      closeReset();
    } catch (err) {
      toast(errorMessage(err, t("resetFail")), "error");
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
      toast(t("accountDeleted"), "success");
      window.location.assign("/");
    } catch (err) {
      toast(errorMessage(err, t("deleteFail")), "error");
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="space-y-3">
        <p className="text-sm text-zinc-400">
          {t("dangerIntro")}
        </p>
        <Button className="w-full" onClick={() => setResetOpen(true)}>
          {t("resetDataBtn")}
        </Button>
        <Button variant="danger" className="w-full" onClick={() => setDeleteOpen(true)}>
          {t("deleteAllBtn")}
        </Button>
      </div>

      <BottomSheet open={resetOpen} onClose={closeReset} title={t("resetDataBtn")}>
        <form onSubmit={resetData} className="space-y-3">
          <p className="text-sm text-zinc-300">
            {t("resetBody")}
          </p>
          <FormField
            id="reset-confirm"
            label={t("typeReset")}
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
            pendingLabel={t("resetting")}
            disabled={resetConfirm !== "RESET"}
          >
            {t("resetAllKeepAccount")}
          </Button>
        </form>
      </BottomSheet>

      <BottomSheet open={deleteOpen} onClose={closeDelete} title={t("deleteTitle")}>
        <form onSubmit={deleteAccount} className="space-y-3">
          <p className="text-sm text-zinc-300">
            {t("deleteBody")}
          </p>
          <FormField
            id="del-confirm"
            label={t("typeDelete")}
            type="text"
            autoComplete="off"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            required
          />
          <FormField
            id="del-password"
            label={t("passwordLabel")}
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
            pendingLabel={t("deleting")}
            disabled={deleteConfirm !== "DELETE" || !password}
          >
            {t("deleteForever")}
          </Button>
        </form>
      </BottomSheet>
    </>
  );
}
