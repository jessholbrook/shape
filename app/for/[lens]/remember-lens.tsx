"use client";

import { useEffect } from "react";
import type { LensId } from "@/lib/lenses";
import { writeLens } from "@/lib/hooks/use-lens";

/** Visiting /for/<lens> sets that lens for the rest of the site. */
export function RememberLens({ lens }: { lens: LensId }) {
  useEffect(() => {
    writeLens(lens);
  }, [lens]);
  return null;
}
