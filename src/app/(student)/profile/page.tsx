import type { Metadata } from "next";
import { PageHeading } from "@/components/layout/PageHeading";
import { ProfileForm } from "@/features/profile/ProfileForm";
import { IS_MOCK_MODE } from "@/lib/config";

export const metadata: Metadata = { title: "Perfil acadêmico" };

export default function ProfilePage() {
  return (
    <>
      <PageHeading eyebrow="Perfil acadêmico" title="Conte sobre sua formação." description={`Estas informações apoiam a avaliação de elegibilidade.${IS_MOCK_MODE ? " Nesta demonstração, o perfil fica só nesta aba e não vai para nenhum servidor." : ""}`} />
      <ProfileForm />
    </>
  );
}
