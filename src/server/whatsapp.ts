/**
 * Messaging provider port. The assignment asks for mocked WhatsApp delivery;
 * swapping in Meta's Cloud API (or Gupshup / Interakt) means implementing
 * `send` against their endpoint. Nothing else in the app changes.
 */
export interface MessagingProvider {
  readonly name: string;
  send(to: string, body: string): Promise<{ ok: true; providerMessageId: string } | { ok: false; error: string }>;
}

export class MockWhatsAppProvider implements MessagingProvider {
  readonly name = "mock-whatsapp";

  async send(to: string, body: string) {
    // Reserved test range: numbers ending in 0000 simulate an undeliverable
    // handset, so the "failed" state can be demonstrated end to end.
    if (to.endsWith("0000")) return { ok: false as const, error: "Recipient is not a WhatsApp user (simulated)." };
    const providerMessageId = `wamid.MOCK${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    if (process.env.NODE_ENV !== "test") {
      console.log(`[whatsapp:mock] -> ${to} (${providerMessageId})\n${body.replace(/^/gm, "  │ ")}`);
    }
    return { ok: true as const, providerMessageId };
  }
}

export const whatsapp: MessagingProvider = new MockWhatsAppProvider();
