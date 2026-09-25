// Structured JSON logging. Cloudflare's Workers Logs auto-indexes JSON
// fields, so a plain string log is readable but not filterable — this
// makes every log line searchable by requestId, route, status, etc.
// Requires [observability] enabled = true in wrangler.toml (added) or
// none of this is actually visible anywhere after the fact.

type LogFields = Record<string, unknown>;

function emit(level: "info" | "error", event: string, fields: LogFields = {}) {
  const line = { level, event, ts: new Date().toISOString(), ...fields };
  if (level === "error") {
    console.error(JSON.stringify(line));
  } else {
    console.log(JSON.stringify(line));
  }
}

export function logInfo(event: string, fields?: LogFields) {
  emit("info", event, fields);
}

export function logError(event: string, err: unknown, fields?: LogFields) {
  const errInfo =
    err instanceof Error ? { message: err.message, stack: err.stack } : { message: String(err) };
  emit("error", event, { ...fields, ...errInfo });
}
