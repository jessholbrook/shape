/**
 * Sending email through Resend's HTTP API. Server-only. One function, so the
 * handlers take a SendEmail and tests pass a fake.
 */
export type Email = { to: string; subject: string; text: string; html: string };
export type SendEmail = (email: Email) => Promise<void>;

export function resendSender(apiKey: string, from: string, fetcher: typeof fetch = fetch): SendEmail {
  return async ({ to, subject, text, html }) => {
    const res = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      throw new Error(`Resend ${res.status}: ${detail}`);
    }
  };
}
