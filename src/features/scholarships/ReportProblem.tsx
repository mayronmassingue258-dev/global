"use client";

import { useId, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { RadioGroup } from "@/components/ui/Choice";
import { TextAreaField } from "@/components/ui/Field";
import { Notice } from "@/components/feedback/States";
import { useT } from "@/i18n/I18nProvider";
import type { RecommendationService } from "@/lib/api/recommendations";
import { recommendationService } from "@/lib/services";
import type { ReportReason } from "@/types";
import styles from "./ReportProblem.module.css";

const REASONS: ReportReason[] = ["broken_link", "wrong_deadline", "closed", "wrong_info", "scam", "other"];

/**
 * "Reportar erro": como as bolsas novas entram no ar sem revisão prévia, os estudantes ajudam a manter a base correta.
 * Três relatos graves de pessoas diferentes tiram a bolsa do ar até um administrador conferir.
 */
export function ReportProblem({ scholarshipId, signedIn, service = recommendationService }: { scholarshipId: string; signedIn: boolean; service?: RecommendationService }) {
  const t = useT();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed" | "invalid">("idle");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!reason) {
      setState("invalid");
      return;
    }
    setState("sending");
    try {
      await service.report(scholarshipId, reason, message.trim());
      setState("sent");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.toggle} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
        <Flag size={14} aria-hidden="true" /> {t.report.open}
      </button>
      <div id={panelId} hidden={!open} className={styles.panel}>
        {!signedIn ? (
          <p className="t-meta"><Link href={`/login?next=${encodeURIComponent(`/scholarships/${scholarshipId}`)}`}>{t.report.signIn}</Link></p>
        ) : state === "sent" ? (
          <p role="status" className={styles.sent}>{t.report.sent}</p>
        ) : (
          <form onSubmit={submit} className={styles.form} noValidate>
            <RadioGroup
              name="reason" legend={t.report.title} value={reason}
              error={state === "invalid" ? t.profile.errors.required : undefined}
              options={REASONS.map((r) => ({ value: r, label: t.report.reasons[r] }))}
              onChange={(r) => { setReason(r); if (state === "invalid") setState("idle"); }}
            />
            <TextAreaField label={t.report.message} placeholder={t.report.messagePlaceholder} value={message} maxLength={1000} rows={3} onChange={(e) => setMessage(e.target.value)} />
            {state === "failed" && <Notice role="alert">{t.report.failed}</Notice>}
            <div><Button type="submit" variant="secondary" size="sm" loading={state === "sending"}>{t.report.send}</Button></div>
          </form>
        )}
      </div>
    </div>
  );
}
