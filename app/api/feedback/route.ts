/**
 * In-product feedback endpoint. Forwards submissions to Linear as new issues.
 *
 * Required env:
 *   LINEAR_API_KEY   — personal API key from Linear settings → API
 *   LINEAR_TEAM_ID   — UUID of the team that should receive feedback tickets
 *
 * Without either, returns 503 and the feedback modal surfaces a friendly
 * "not configured" message.
 */

import {
  clientIp,
  forbidden,
  isSameOrigin,
  rateLimit,
  tooManyRequests,
} from "@/lib/api-guard";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const LINEAR_URL = "https://api.linear.app/graphql";

// Feedback is low-frequency by nature; a public endpoint that files Linear
// tickets should be tight. 5 submissions per 10 minutes per IP.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;

type FeedbackBody = {
  body?: string;
  kind?: "feedback" | "bug" | "idea";
  url?: string;
  userAgent?: string;
  viewport?: string;
  /** Honeypot — real UIs leave this empty; bots that fill every field trip it. */
  website?: string;
};

export async function POST(req: Request) {
  // Only our own pages should be filing tickets. Blocks header-less bots and
  // cross-origin abuse before we touch Linear.
  if (!isSameOrigin(req)) return forbidden();

  const apiKey = process.env.LINEAR_API_KEY;
  const teamId = process.env.LINEAR_TEAM_ID;
  if (!apiKey || !teamId) {
    return jsonError(503, "Feedback backend is not configured.");
  }

  const gate = rateLimit(
    `feedback:${clientIp(req)}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
    Date.now(),
  );
  if (!gate.ok) return tooManyRequests(gate.retryAfter);

  let body: FeedbackBody;
  try {
    body = (await req.json()) as FeedbackBody;
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  // Honeypot: pretend success so bots don't learn to adapt, but file nothing.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return new Response(JSON.stringify({ ok: true, identifier: null, url: null }), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  const text = (body.body ?? "").trim();
  if (!text) return jsonError(400, "Feedback body is required.");
  if (text.length > 2000) {
    return jsonError(400, "Feedback is capped at 2000 characters.");
  }

  const kindLabel =
    body.kind === "bug"
      ? "Bug"
      : body.kind === "idea"
      ? "Idea"
      : "Feedback";

  const firstLine = text.split("\n")[0] ?? "";
  const titleSeed = firstLine.slice(0, 80);
  const title = `[${kindLabel}] ${titleSeed}${
    titleSeed.length < firstLine.length ? "…" : ""
  }`;

  const description = [
    text,
    "",
    "---",
    `**URL:** ${body.url ?? "unknown"}`,
    `**User-Agent:** ${body.userAgent ?? "unknown"}`,
    `**Viewport:** ${body.viewport ?? "unknown"}`,
    `**Submitted:** ${new Date().toISOString()}`,
  ].join("\n");

  const query = `
    mutation CreateFeedback($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id identifier url }
      }
    }
  `;

  const variables = {
    input: { teamId, title, description },
  };

  let upstream: Response;
  try {
    upstream = await fetch(LINEAR_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    return jsonError(502, `Linear request failed: ${m}`);
  }

  if (!upstream.ok) {
    const errText = await safeReadError(upstream);
    return jsonError(502, `Linear ${upstream.status}: ${errText}`);
  }

  const json = (await upstream.json()) as {
    data?: {
      issueCreate?: {
        success?: boolean;
        issue?: { identifier?: string; url?: string };
      };
    };
    errors?: { message: string }[];
  };

  if (json.errors?.length) {
    return jsonError(502, `Linear error: ${json.errors[0].message}`);
  }
  if (!json.data?.issueCreate?.success) {
    return jsonError(502, "Linear returned an unsuccessful response.");
  }

  return new Response(
    JSON.stringify({
      ok: true,
      identifier: json.data.issueCreate.issue?.identifier ?? null,
      url: json.data.issueCreate.issue?.url ?? null,
    }),
    {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    },
  );
}

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function safeReadError(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 200);
  } catch {
    return res.statusText;
  }
}
