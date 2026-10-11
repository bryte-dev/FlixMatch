import { createContext, useContext } from "react";

export const ToastContext = createContext({ toast: () => {} });

export const useToast = () => useContext(ToastContext).toast;
