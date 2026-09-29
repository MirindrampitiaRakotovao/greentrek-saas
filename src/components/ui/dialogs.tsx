"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";

/*
 * Boîtes de confirmation et notifications de l'application (à la place de `window.confirm`,
 * demande de l'étudiant). Un seul fournisseur, placé à la racine :
 * - `const confirm = useConfirm(); if (await confirm({...})) …` ouvre une modale et renvoie
 *   une promesse (vrai si l'utilisateur confirme) ;
 * - `const notify = useNotify(); notify("Enregistré.")` affiche une notification discrète,
 *   annoncée aux lecteurs d'écran (`role="status"`).
 */

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** « danger » pour une action irréversible (annulation, suppression). */
  tone?: "default" | "danger";
  icon?: IconName;
};

type Pending = ConfirmOptions & { resolve: (value: boolean) => void };
type Toast = { id: number; message: string; tone: "success" | "error" };

const DialogsContext = createContext<{
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  notify: (message: string, tone?: Toast["tone"]) => void;
} | null>(null);

function useDialogs() {
  const context = useContext(DialogsContext);
  if (!context) throw new Error("DialogsProvider manquant.");
  return context;
}

export function useConfirm() {
  return useDialogs().confirm;
}

export function useNotify() {
  return useDialogs().notify;
}

export function DialogsProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );
  const settle = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
  };

  const removeToast = useCallback(
    (id: number) => setToasts((list) => list.filter((t) => t.id !== id)),
    [],
  );

  const notify = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = (nextId.current += 1);
    setToasts((list) => [...list, { id, message, tone }]);
  }, []);

  return (
    <DialogsContext.Provider value={{ confirm, notify }}>
      {children}

      <Modal
        open={pending !== null}
        onClose={() => settle(false)}
        title={pending?.title ?? ""}
        icon={pending?.icon ?? (pending?.tone === "danger" ? "xCircle" : "check")}
        tone={pending?.tone ?? "default"}
        size="sm"
      >
        <p className="text-sm leading-relaxed text-gt-teal-900/80">{pending?.message}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => settle(false)}
            className="rounded-full border border-gt-mist px-5 py-2.5 text-sm font-medium text-gt-teal-900 hover:bg-gt-teal-50"
          >
            {pending?.cancelLabel ?? "Annuler"}
          </button>
          <button
            type="button"
            // Le bouton de confirmation n'a pas le focus par défaut : une touche Entrée
            // accidentelle ne déclenche pas une action irréversible.
            onClick={() => settle(true)}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold text-white ${
              pending?.tone === "danger"
                ? "bg-red-700 hover:bg-red-800"
                : "bg-gt-teal-700 hover:bg-gt-teal-800"
            }`}
          >
            {pending?.confirmLabel ?? "Confirmer"}
          </button>
        </div>
      </Modal>

      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-[3000] flex w-[min(24rem,calc(100%-2rem))] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDone={removeToast} />
        ))}
      </div>
    </DialogsContext.Provider>
  );
}

function ToastItem({ toast, onDone }: { toast: Toast; onDone: (id: number) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDone(toast.id), 4500);
    return () => window.clearTimeout(timer);
  }, [onDone, toast.id]);
  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      className={`gt-toast pointer-events-auto flex items-start gap-3 rounded-2xl px-4 py-3 text-sm shadow-xl ring-1 ${
        toast.tone === "error"
          ? "bg-red-50 text-red-900 ring-red-200"
          : "bg-gt-teal-900 text-white ring-gt-teal-800"
      }`}
    >
      <Icon name={toast.tone === "error" ? "xCircle" : "check"} className="mt-0.5 size-4" />
      <p className="flex-1">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDone(toast.id)}
        className="opacity-70 hover:opacity-100"
      >
        <Icon name="close" className="size-4" />
        <span className="sr-only">Fermer la notification</span>
      </button>
    </div>
  );
}
