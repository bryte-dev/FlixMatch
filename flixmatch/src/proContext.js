import { createContext, useContext } from "react";

export const ProContext = createContext({ openPro: (_feature, opts) => opts?.onContinue?.() });

export const usePro = () => useContext(ProContext);
