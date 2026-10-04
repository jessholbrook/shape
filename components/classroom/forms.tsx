"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INPUT, LINK_BUTTON } from "@/components/lab/fields";

/** Small client forms for the /teach and /class pages. Each posts to one endpoint. */

const PRIMARY =
  "inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors";

async function post(url: string, body: unknown): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; message: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: data?.error?.message ?? "Something went wrong. Try again." };
    return { ok: true, data };
  } catch {
    return { ok: false, message: "Couldn't reach Shape. Check your connection and try again." };
  }
}

export function TeacherSignIn() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setState("sending");
    setError(null);
    const r = await post("/api/teach/sign-in", { email });
    if (r.ok) setState("sent");
    else {
      setError(r.message);
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <div className="bg-surface border border-line rounded-[16px] p-6 max-w-xl" data-testid="teach-sent">
        <p className="font-sans text-[15px] leading-[1.6] text-ink">
          If <span className="font-mono text-[14px]">{email.trim()}</span> is approved for teaching, a sign-in link is on its way.
          It works once and expires in 15 minutes.
        </p>
        <p className="font-sans text-[13px] leading-[1.5] text-ink-muted mt-3">
          Nothing arriving? Check spam, or ask for access with the Feedback button — teaching is invite-only for now.
        </p>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="bg-surface border border-line rounded-[16px] p-6 max-w-xl flex flex-col gap-3">
      <label htmlFor="teach-email" className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
        Your email
      </label>
      <input id="teach-email" type="email" required autoComplete="email" value={email} onChange={(ev) => setEmail(ev.target.value)} className={INPUT} />
      <div>
        <button type="submit" disabled={state === "sending" || !email.trim()} className={PRIMARY}>
          {state === "sending" ? "Sending…" : "Email me a sign-in link"} <span className="text-highlight">→</span>
        </button>
      </div>
      {error && (
        <p role="alert" className="font-sans text-[13px] text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

/**
 * The page a sign-in email links to. Signing in takes a click, not the page
 * load: university mail scanners open every link, and a one-time token used
 * by a scanner is a token the teacher never gets to use.
 */
export function ConfirmSignIn({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function confirm() {
    setBusy(true);
    setError(null);
    const r = await post("/api/teach/confirm", { token });
    if (r.ok) router.replace("/teach");
    else {
      setError(r.message);
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-3 items-start">
      <button type="button" onClick={confirm} disabled={busy || !token} className={PRIMARY}>
        {busy ? "Signing in…" : "Sign in to Shape"} <span className="text-highlight">→</span>
      </button>
      {error && (
        <p role="alert" className="font-sans text-[14px] text-danger">
          {error}{" "}
          <a href="/teach" className="text-ink underline decoration-highlight underline-offset-4">
            Get a new link
          </a>
        </p>
      )}
    </div>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className={LINK_BUTTON}
      onClick={async () => {
        await fetch("/api/teach/sign-out", { method: "POST" });
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}

export function JoinForm({ code }: { code: string }) {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    const r = await post(`/api/classes/${code}/join`, { nickname });
    if (r.ok) router.refresh();
    else {
      setError(r.message);
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="bg-surface border border-line rounded-[16px] p-6 max-w-xl flex flex-col gap-3" data-testid="join-form">
      <label htmlFor="join-nickname" className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
        Pick a nickname
      </label>
      <input id="join-nickname" maxLength={24} required value={nickname} onChange={(ev) => setNickname(ev.target.value)} className={INPUT} />
      <p className="font-sans text-[12px] leading-[1.5] text-ink-quiet">
        Something your teacher will recognise — it doesn&apos;t need to be your real name. Shape keeps no email or account for you;
        this browser remembers you.
      </p>
      <div>
        <button type="submit" disabled={busy || !nickname.trim()} className={PRIMARY}>
          {busy ? "Joining…" : "Join the class"} <span className="text-highlight">→</span>
        </button>
      </div>
      {error && (
        <p role="alert" className="font-sans text-[13px] text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

export function JoinCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        const c = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (c) router.push(`/class/${c}`);
      }}
      className="bg-surface border border-line rounded-[16px] p-6 max-w-md flex flex-col gap-3"
    >
      <label htmlFor="class-code" className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
        Class code
      </label>
      <input
        id="class-code"
        autoCapitalize="characters"
        autoComplete="off"
        placeholder="KQ7-M2P"
        value={code}
        onChange={(ev) => setCode(ev.target.value)}
        className={`${INPUT} font-mono text-[18px] tracking-[0.15em] uppercase`}
      />
      <div>
        <button type="submit" disabled={!code.trim()} className={PRIMARY}>
          Go to class <span className="text-highlight">→</span>
        </button>
      </div>
    </form>
  );
}
