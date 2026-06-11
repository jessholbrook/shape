import { Suspense } from "react";
import { PrintDraft } from "./print-draft";

export const metadata = {
  title: "Print draft",
  robots: { index: false },
};

export default function PrintDraftPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-[760px] px-6 py-16">
          <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-quiet">
            Loading…
          </p>
        </main>
      }
    >
      <PrintDraft />
    </Suspense>
  );
}
