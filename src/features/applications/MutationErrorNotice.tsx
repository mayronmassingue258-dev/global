"use client";

import { Button } from "@/components/ui/Button";
import { useApplications } from "./ApplicationsProvider";
import styles from "./MutationErrorNotice.module.css";

/** Aviso global quando salvar/remover/atualizar uma candidatura falha (a tela já foi revertida). */
export function MutationErrorNotice() {
  const { mutationError, dismissError } = useApplications();
  return (
    <div role="alert" className={styles.wrap}>
      {mutationError && (
        <div className={`container ${styles.inner}`}>
          <p>{mutationError}</p>
          <Button variant="tertiary" size="sm" onClick={dismissError}>Fechar</Button>
        </div>
      )}
    </div>
  );
}
