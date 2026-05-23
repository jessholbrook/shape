import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { GalleryView } from "./gallery-view";

export const metadata = {
  title: "Gallery — Shape",
  description:
    "Public showcase of Shape artifacts. Curated and failure-museum sections coming in v1.",
};

export default function GalleryPage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[1280px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber label="Gallery">05</SectionNumber>

        <h1 className="font-display text-[64px] md:text-[88px] leading-[0.95] tracking-tight text-ink mt-8 max-w-4xl">
          The work, <span className="italic">on display</span>.
        </h1>

        <p className="font-sans text-[18px] leading-[1.55] text-ink-muted mt-8 max-w-2xl">
          Public artifacts published from Shape. Curated highlights and a
          dedicated failure museum land with v1.0; for now this is the open
          stream.
        </p>

        <GalleryView />
      </section>
    </Shell>
  );
}
