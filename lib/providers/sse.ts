/**
 * Minimal SSE reader for the fetch streaming body.
 * Yields parsed { event, data } records, one per `\n\n`-delimited block.
 */

export type SseEvent = {
  event?: string;
  data: string;
};

export async function* readSse(
  response: Response,
): AsyncIterable<SseEvent> {
  if (!response.body) {
    throw new Error("Response has no body to stream.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let split = buffer.indexOf("\n\n");
    while (split !== -1) {
      const block = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      const ev = parseBlock(block);
      if (ev) yield ev;
      split = buffer.indexOf("\n\n");
    }
  }

  if (buffer.trim()) {
    const ev = parseBlock(buffer);
    if (ev) yield ev;
  }
}

function parseBlock(block: string): SseEvent | null {
  let event: string | undefined;
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}
