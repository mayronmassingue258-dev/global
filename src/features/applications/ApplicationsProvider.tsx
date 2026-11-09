"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { applicationService } from "@/lib/services";
import { useSessionUser } from "@/features/auth/SessionProvider";
import type { ApplicationService } from "@/lib/api/applications";
import { applyApplicationUpdate } from "@/lib/applications/applyUpdate";
import type { Application, ApplicationStatus, ApplicationUpdate, ScholarshipSummary } from "@/types";

/** "anonymous": visitante sem login (páginas públicas); nada é buscado. */
export type LoadStatus = "loading" | "ready" | "error" | "anonymous";

type ApplicationsContextValue = {
  applications: Application[];
  status: LoadStatus;
  /** Mensagem da última alteração que falhou (já revertida na tela). */
  mutationError: string;
  isSaved: (id: string) => boolean;
  save: (scholarship: ScholarshipSummary) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setStatus: (id: string, status: ApplicationStatus) => Promise<void>;
  /** Atualização parcial (status, notas, documentos). Devolve true se o servidor aceitou. */
  update: (id: string, update: ApplicationUpdate) => Promise<boolean>;
  /** Substitui/insere um registro vindo do servidor (ex.: página de detalhe). */
  upsert: (app: Application) => void;
  reload: () => void;
  dismissError: () => void;
};

const ApplicationsContext = createContext<ApplicationsContextValue | null>(null);

/** Código do erro de alteração; o texto vem do dicionário (MutationErrorNotice). */
const FAILED = "mutation_failed";

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

  const user = useSessionUser();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) {
      setApplications([]);
      setLoadStatus("anonymous");
      return;
    }
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
  }, [service, reloadKey, userId]);

  /** Aplica a mudança otimista, chama o servidor e reverte se falhar. */
  const mutate = useCallback(async (optimistic: (current: Application[]) => Application[], request: () => Promise<Application | void>): Promise<boolean> => {
    const before = snapshot.current;
    setMutationError("");
    setApplications(optimistic);
    try {
      const result = await request();
      if (result) setApplications((current) => current.map((a) => (a.id === result.id ? result : a)));
      return true;
    } catch {
      setApplications(before);
      setMutationError(FAILED);
      return false;
    }
  }, []);

  const isSaved = useCallback((id: string) => applications.some((a) => a.id === id), [applications]);

  const save = useCallback(
    (scholarship: ScholarshipSummary) =>
      mutate(
        (current) =>
          current.some((a) => a.id === scholarship.id)
            ? current
            : [...current, { id: scholarship.id, scholarship, status: "Saved", documents: [], notes: "", timeline: [], updatedAt: new Date().toISOString() }],
        () => service.save(scholarship)
      ).then(() => undefined),
    [mutate, service]
  );

  const remove = useCallback(
    (id: string) => mutate((current) => current.filter((a) => a.id !== id), () => service.remove(id)).then(() => undefined),
    [mutate, service]
  );

  const update = useCallback(
    (id: string, change: ApplicationUpdate) =>
      mutate((current) => current.map((a) => (a.id === id ? applyApplicationUpdate(a, change) : a)), () => service.update(id, change)),
    [mutate, service]
  );

  const setStatus = useCallback((id: string, next: ApplicationStatus) => update(id, { status: next }).then(() => undefined), [update]);

  const upsert = useCallback((app: Application) => {
    setApplications((current) => (current.some((a) => a.id === app.id) ? current.map((a) => (a.id === app.id ? app : a)) : [...current, app]));
  }, []);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const dismissError = useCallback(() => setMutationError(""), []);

  const value = useMemo(
    () => ({ applications, status, mutationError, isSaved, save, remove, setStatus, update, upsert, reload, dismissError }),
    [applications, status, mutationError, isSaved, save, remove, setStatus, update, upsert, reload, dismissError]
  );
  return <ApplicationsContext.Provider value={value}>{children}</ApplicationsContext.Provider>;
}

export function useApplications(): ApplicationsContextValue {
  const value = useContext(ApplicationsContext);
  if (!value) throw new Error("useApplications deve ser usado dentro de ApplicationsProvider.");
  return value;
}
