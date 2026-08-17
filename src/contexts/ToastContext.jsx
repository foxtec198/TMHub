import { createContext, useCallback, useContext, useRef } from "react";
import { Toast } from "primereact/toast";

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const toast = useRef(null);
  const lastToast = useRef({ key: "", shownAt: 0 });

  // Ignore only immediate identical emissions, preserving legitimate repeated feedback later.
  const showToast = useCallback((severity, summary, detail) => {
    const key = `${severity}|${summary}|${detail}`;
    const now = Date.now();
    if (lastToast.current.key === key && now - lastToast.current.shownAt < 750) return;

    lastToast.current = { key, shownAt: now };
    toast.current?.show({ severity, summary, detail, life: 3000 });
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      <Toast ref={toast} />
      {children}
    </ToastContext.Provider>
  );
};

// O hook compartilha o módulo do provedor para manter uma única API pública de notificações.
// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);
