import type { Metadata } from "next";
import { Hero } from "@/features/landing/Hero";
import { HowItWorks } from "@/features/landing/HowItWorks";
import { Closing } from "@/features/landing/Closing";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function LandingPage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Closing />
    </>
  );
}
