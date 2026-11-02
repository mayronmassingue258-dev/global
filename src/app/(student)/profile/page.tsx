import type { Metadata } from "next";
import { PageHeading } from "@/components/layout/PageHeading";
import { ProfileForm } from "@/features/profile/ProfileForm";

export const metadata: Metadata = { title: "Perfil acadêmico" };

export default function ProfilePage() {
  return (
    <>
      <PageHeading eyebrow="Perfil acadêmico" title="Conte sobre sua formação." description="Estas informações apoiarão a avaliação de elegibilidade. Nesta demonstração, o formulário não envia nem armazena dados." />
      <ProfileForm />
    </>
  );
}
