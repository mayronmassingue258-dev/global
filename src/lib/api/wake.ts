/**
 * No plano gratuito do Render, a API "dorme" depois de ~15 min sem uso. Enquanto ela acorda, o Render responde por
 * conta própria (o pedido NEM CHEGA à API) com 429/503 e o cabeçalho `x-render-routing` (ex.: `hibernate-rate-limited`).
 * Como o pedido não chegou, repetir é seguro mesmo em cadastro ou gravação: esperamos e tentamos de novo.
 */
export function isRenderWaking(response: Response): boolean {
  const routing = response.headers.get("x-render-routing") ?? "";
  if (!routing) return false;
  return /hibernat|spin|wak|starting/i.test(routing) || response.status === 503;
}

type WakeOptions = { maxWaitMs?: number; sleep?: (ms: number) => Promise<void>; now?: () => number };

/** Chama `attempt` e, enquanto o Render disser que a API está acordando, espera (1 s, 2 s, 4 s, até 8 s) e repete. */
export async function fetchWaitingForWake(attempt: () => Promise<Response>, { maxWaitMs = 45_000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = Date.now }: WakeOptions = {}): Promise<Response> {
  const deadline = now() + maxWaitMs;
  let delay = 1_000;
  for (;;) {
    const response = await attempt();
    if (!isRenderWaking(response) || now() + delay > deadline) return response;
    await response.body?.cancel().catch(() => {});
    await sleep(delay);
    delay = Math.min(delay * 2, 8_000);
  }
}
