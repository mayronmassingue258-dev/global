// Só o painel tem tela de carregamento. Em rotas com notFound() (detalhe, elegibilidade) um loading.tsx
// faria a resposta começar antes da busca e o status HTTP seria 200 em vez de 404.
import { ListSkeleton, Skeleton } from "@/components/feedback/Skeleton";
import { getT } from "@/i18n/server";
import patterns from "@/styles/patterns.module.css";

export default async function Loading() {
  const t = await getT();
  return (
    <div className={patterns.page}>
      <div className={patterns.stack}>
        <Skeleton width="20%" height={12} />
        <Skeleton width="55%" height={40} />
      </div>
      <ListSkeleton rows={3} variant="card" label={t.common.loading} />
    </div>
  );
}
