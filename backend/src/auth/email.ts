/**
 * Envio de e-mail. "log" escreve no log do servidor (desenvolvimento e testes); "resend" usa a API do Resend (produção).
 * Os testes de ponta a ponta leem os e-mails enviados pela rota de teste (só com ALLOW_TEST_RESET=1).
 */
export type Email = { to: string; subject: string; text: string };
export interface EmailSender {
  send(email: Email): Promise<void>;
}

/** Últimos e-mails do modo "log" (memória do processo; só para desenvolvimento e testes). */
export const sentEmails: Email[] = [];

export function createEmailSender(options: { provider: "log" | "resend"; apiKey?: string; from: string; log: (msg: string) => void }): EmailSender {
  if (options.provider === "resend") {
    if (!options.apiKey) throw new Error("EMAIL_PROVIDER=resend exige RESEND_API_KEY.");
    const apiKey = options.apiKey;
    return {
      async send(email) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: options.from, to: email.to, subject: email.subject, text: email.text })
        });
        if (!res.ok) throw new Error(`Falha ao enviar e-mail (Resend ${res.status}).`);
      }
    };
  }
  return {
    async send(email) {
      sentEmails.push(email);
      if (sentEmails.length > 20) sentEmails.shift();
      // Modo de desenvolvimento: o link (ex.: redefinição de senha) aparece no log para você poder usá-lo.
      // Em produção use "resend": o log do servidor não deve guardar links de acesso.
      options.log(`[e-mail] para ${email.to}: ${email.subject}\n${email.text}`);
    }
  };
}
