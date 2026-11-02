import { ImageResponse } from "next/og";
import { BrandCard, OG_SIZE } from "@/lib/brand/BrandCard";

export const alt = "GlobalScholar — Plataforma global de bolsas";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(<BrandCard title="Plataforma Global de Bolsas" subtitle="Descubra. Prepare. Candidate-se. Conquiste." />, size);
}
