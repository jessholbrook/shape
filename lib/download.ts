/**
 * Trigger a client-side download of a blob with the given filename.
 * Browser-only — no-op on the server.
 */
export function downloadBlob(
  filename: string,
  mime: string,
  content: string | Blob,
): void {
  if (typeof window === "undefined") return;
  const blob =
    typeof content === "string" ? new Blob([content], { type: mime }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Defer revoke so the browser has time to start the download in some
  // browsers that race the URL teardown.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Make a filename-safe slug from a user title. Falls back to a default if the
 * input has no usable characters.
 */
export function slugify(title: string, fallback: string): string {
  const cleaned = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return cleaned || fallback;
}
