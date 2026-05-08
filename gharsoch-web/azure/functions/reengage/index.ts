import { AzureFunction, Context } from "@azure/functions";

const ROUTE = "/api/cron/re-engage";

const timer: AzureFunction = async (context: Context): Promise<void> => {
  const base = process.env.GHARSOCH_API_BASE!;
  const secret = process.env.CRON_SECRET!;

  if (!base || !secret) {
    context.log.error("[reengage] Missing GHARSOCH_API_BASE or CRON_SECRET");
    throw new Error("Missing required environment variables");
  }

  const url = `${base}${ROUTE}`;
  const startedAt = new Date().toISOString();

  context.log(`[reengage] Firing POST ${url} at ${startedAt}`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "x-cron-secret": secret,
        "content-type": "application/json",
        "x-azure-function": context.executionContext.functionName,
        "x-trigger-time": startedAt,
      },
      signal: AbortSignal.timeout(60_000),
    });

    const body = await res.text();
    context.log(`[reengage] POST ${url} → ${res.status} ${body.slice(0, 500)}`);

    if (!res.ok) {
      throw new Error(`Non-2xx response: ${res.status} — ${body.slice(0, 200)}`);
    }
  } catch (err: any) {
    context.log.error(`[reengage] Failed to call ${url}: ${err.message}`);
    throw err;
  }
};

export default timer;
