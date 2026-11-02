"use client";

import { Button } from "@/components/ui/Button";
import { useT } from "@/i18n/I18nProvider";
import { useApplications } from "./ApplicationsProvider";
import styles from "./MutationErrorNotice.module.css";

/** Aviso global quando salvar/remover/atualizar uma candidatura falha (a tela já foi revertida). */
export function MutationErrorNotice() {
  const { mutationError, dismissError } = useApplications();
  const t = useT();
  return (
    <div role="alert" className={styles.wrap}>
      {mutationError && (
        <div className={`container ${styles.inner}`}>
          <p>{t.applications.mutationFailed}</p>
          <Button variant="tertiary" size="sm" onClick={dismissError}>{t.common.close}</Button>
        </div>
      )}
    </div>
  );
}
