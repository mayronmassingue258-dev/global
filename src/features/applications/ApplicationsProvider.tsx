"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Application, ApplicationStatus, ScholarshipSummary } from "@/types";

type ApplicationsContextValue = {
  applications: Application[];
  isSaved: (id: string) => boolean;
  save: (scholarship: ScholarshipSummary) => void;
  remove: (id: string) => void;
  setStatus: (id: string, status: ApplicationStatus) => void;
};

const ApplicationsContext = createContext<ApplicationsContextValue | null>(null);

/**
 * DEMONSTRAÇÃO: estado apenas em memória (some ao recarregar). Nada é enviado a servidor,
 * nada é gravado no navegador e nada é submetido ao provedor da bolsa.
 */
export function ApplicationsProvider({ children }: { children: ReactNode }) {
  const [applications, setApplications] = useState<Application[]>([]);

  const isSaved = useCallback((id: string) => applications.some((a) => a.id === id), [applications]);

  const save = useCallback((scholarship: ScholarshipSummary) => {
    setApplications((current) =>
      current.some((a) => a.id === scholarship.id)
        ? current
        : [...current, { id: scholarship.id, scholarship, status: "Saved", updatedAt: new Date().toISOString() }]
    );
  }, []);

  const remove = useCallback((id: string) => setApplications((current) => current.filter((a) => a.id !== id)), []);

  const setStatus = useCallback((id: string, status: ApplicationStatus) => {
    setApplications((current) => current.map((a) => (a.id === id ? { ...a, status, updatedAt: new Date().toISOString() } : a)));
  }, []);

  const value = useMemo(() => ({ applications, isSaved, save, remove, setStatus }), [applications, isSaved, save, remove, setStatus]);
  return <ApplicationsContext.Provider value={value}>{children}</ApplicationsContext.Provider>;
}

export function useApplications(): ApplicationsContextValue {
  const value = useContext(ApplicationsContext);
  if (!value) throw new Error("useApplications deve ser usado dentro de ApplicationsProvider.");
  return value;
}
