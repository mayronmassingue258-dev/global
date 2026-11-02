"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { applicationService } from "@/lib/services";
import type { ApplicationService } from "@/lib/api/applications";
import type { Application, ApplicationStatus, ScholarshipSummary } from "@/types";

export type LoadStatus = "loading" | "ready" | "error";

type ApplicationsContextValue = {
  applications: Application[];
  status: LoadStatus;
  /** Mensagem da última alteração que falhou (já revertida na tela). */
  mutationError: string;
  isSaved: (id: string) => boolean;
  save: (scholarship: ScholarshipSummary) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setStatus: (id: string, status: ApplicationStatus) => Promise<void>;
  reload: () => void;
  dismissError: () => void;
};

const ApplicationsContext = createContext<ApplicationsContextValue | null>(null);

const FAILED = "Não foi possível salvar a alteração. Tente novamente.";

/**
 * Candidaturas do estudante. A tela atualiza na hora (otimista) e volta ao estado anterior se o servidor recusar.
 * No modo demonstração o serviço guarda tudo em memória; no modo API, quem guarda é o servidor.
 * Nada é gravado no navegador e nada é submetido ao provedor da bolsa.
 */
export function ApplicationsProvider({ children, service = applicationService }: { children: ReactNode; service?: ApplicationService }) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [status, setLoadStatus] = useState<LoadStatus>("loading");
  const [mutationError, setMutationError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const snapshot = useRef<Application[]>([]);
  snapshot.current = applications;

  useEffect(() => {
    const controller = new AbortController();
    setLoadStatus("loading");
    service
      .list(controller.signal)
      .then((items) => {
        setApplications(items);
        setLoadStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadStatus("error");
      });
    return () => controller.abort();
  }, [service, reloadKey]);

  /** Aplica a mudança otimista, chama o servidor e reverte se falhar. */
  const mutate = useCallback(async (optimistic: (current: Application[]) => Application[], request: () => Promise<Application | void>) => {
    const before = snapshot.current;
    setMutationError("");
    setApplications(optimistic);
    try {
      const result = await request();
      if (result) setApplications((current) => current.map((a) => (a.id === result.id ? result : a)));
    } catch {
      setApplications(before);
      setMutationError(FAILED);
    }
  }, []);

  const isSaved = useCallback((id: string) => applications.some((a) => a.id === id), [applications]);

  const save = useCallback(
    (scholarship: ScholarshipSummary) =>
      mutate(
        (current) =>
          current.some((a) => a.id === scholarship.id)
            ? current
            : [...current, { id: scholarship.id, scholarship, status: "Saved", updatedAt: new Date().toISOString() }],
        () => service.save(scholarship)
      ),
    [mutate, service]
  );

  const remove = useCallback(
    (id: string) => mutate((current) => current.filter((a) => a.id !== id), () => service.remove(id)),
    [mutate, service]
  );

  const setStatus = useCallback(
    (id: string, next: ApplicationStatus) =>
      mutate(
        (current) => current.map((a) => (a.id === id ? { ...a, status: next, updatedAt: new Date().toISOString() } : a)),
        () => service.update(id, { status: next })
      ),
    [mutate, service]
  );

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const dismissError = useCallback(() => setMutationError(""), []);

  const value = useMemo(
    () => ({ applications, status, mutationError, isSaved, save, remove, setStatus, reload, dismissError }),
    [applications, status, mutationError, isSaved, save, remove, setStatus, reload, dismissError]
  );
  return <ApplicationsContext.Provider value={value}>{children}</ApplicationsContext.Provider>;
}

export function useApplications(): ApplicationsContextValue {
  const value = useContext(ApplicationsContext);
  if (!value) throw new Error("useApplications deve ser usado dentro de ApplicationsProvider.");
  return value;
}
