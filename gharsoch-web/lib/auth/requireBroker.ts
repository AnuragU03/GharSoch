import type { Session } from "next-auth";

export class BrokerScopeMissingError extends Error {
  code = "BROKER_SCOPE_MISSING" as const;
  constructor() {
    super("No broker_id on session and no DEFAULT_BROKER_ID env var set.");
    this.name = "BrokerScopeMissingError";
  }
}

/**
 * Returns the broker_id for the current request.
 * Priority: session.user.broker_id > process.env.DEFAULT_BROKER_ID > throw.
 *
 * Single-broker company today; will become per-broker scoping in Phase 7E.
 */
export function requireBrokerId(session: Session | null | undefined): string {
  const fromSession = (session?.user as any)?.broker_id;
  const fromEnv = process.env.DEFAULT_BROKER_ID;
  const id = fromSession || fromEnv;
  if (!id) throw new BrokerScopeMissingError();
  return id;
}