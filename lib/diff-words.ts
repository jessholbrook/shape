export type DiffSegment = {
  kind: "same" | "removed" | "added";
  text: string;
};

export type DiffPair = {
  /** Segments for the "A" / left side. Highlights what A has but B does not. */
  left: DiffSegment[];
  /** Segments for the "B" / right side. Highlights what B has but A does not. */
  right: DiffSegment[];
};

/**
 * Tokenize into words and whitespace runs. Keeps whitespace as standalone
 * tokens so reconstruction preserves spacing.
 */
function tokenize(s: string): string[] {
  return s.match(/\S+|\s+/g) ?? [];
}

function pushSegment(out: DiffSegment[], kind: DiffSegment["kind"], text: string) {
  if (!text) return;
  const last = out[out.length - 1];
  if (last && last.kind === kind) {
    last.text += text;
  } else {
    out.push({ kind, text });
  }
}

/**
 * Compute word-level diff between two strings. Returns per-side segment lists
 * suitable for rendering side-by-side with highlights for diverging parts.
 *
 * Pure DP over the LCS table — fine for the output sizes we deal with
 * (single-prompt completions, typically a few hundred words). No dependencies.
 */
export function diffWords(a: string, b: string): DiffPair {
  const A = tokenize(a);
  const B = tokenize(b);
  const n = A.length;
  const m = B.length;

  // dp[i][j] = LCS length of A[i..] and B[j..]
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (A[i] === B[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const left: DiffSegment[] = [];
  const right: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      pushSegment(left, "same", A[i]);
      pushSegment(right, "same", B[j]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      pushSegment(left, "removed", A[i]);
      i++;
    } else {
      pushSegment(right, "added", B[j]);
      j++;
    }
  }
  while (i < n) pushSegment(left, "removed", A[i++]);
  while (j < m) pushSegment(right, "added", B[j++]);

  return { left, right };
}
