import { fileURLToPath } from "node:url";
import { sql as dsql } from "drizzle-orm";
import { loadConfig } from "../config.js";
import { createDb, type Database } from "./client.js";
import { eligibilityCriteria, scholarships, users } from "./schema.js";
import scholarshipData from "./seed-data/scholarships.json" with { type: "json" };
import criteriaData from "./seed-data/criteria.json" with { type: "json" };

/** Estudante usado enquanto não há contas (B1). Na B2, cada pessoa terá a sua. */
export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

type SeedScholarship = (typeof scholarshipData)[number] & { eligibleCountries?: string[]; sourceUrl?: string; deadlineTimezone?: string; applicationProcess?: string };

/** Insere/atualiza as bolsas FICTÍCIAS de demonstração e o estudante de demonstração. Idempotente. */
export async function seed(db: Database) {
  await db.insert(users).values({ id: DEMO_USER_ID, email: "demo@globalscholar.local", name: "Estudante de demonstração" }).onConflictDoNothing();

  for (const raw of scholarshipData as SeedScholarship[]) {
    const row = {
      id: raw.id,
      title: raw.title,
      institution: raw.institution,
      country: raw.country,
      level: raw.level,
      fundingType: raw.fundingType,
      funding: raw.funding,
      deadline: raw.deadline,
      deadlineTimezone: raw.deadlineTimezone ?? null,
      summary: raw.summary,
      requirements: raw.requirements,
      requiredDocuments: raw.requiredDocuments,
      applicationProcess: raw.applicationProcess ?? null,
      eligibleCountries: raw.eligibleCountries ?? null,
      sourceUrl: raw.sourceUrl ?? null,
      verificationStatus: raw.verification.status,
      verifiedAt: null
    };
    await db.insert(scholarships).values(row).onConflictDoUpdate({ target: scholarships.id, set: { ...row, updatedAt: dsql`now()` } });
  }

  for (const [scholarshipId, c] of Object.entries(criteriaData as Record<string, { acceptedLevels: string[]; needs: string[] }>)) {
    await db.insert(eligibilityCriteria).values({ scholarshipId, ...c })
      .onConflictDoUpdate({ target: eligibilityCriteria.scholarshipId, set: c });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    process.loadEnvFile(new URL("../../.env", import.meta.url));
  } catch {
    // sem .env
  }
  const config = loadConfig();
  const { db, sql } = createDb(config.DATABASE_URL, { ssl: config.DATABASE_SSL === "require", max: 1 });
  await seed(db);
  await sql.end();
  console.log("Dados de demonstração inseridos.");
}
