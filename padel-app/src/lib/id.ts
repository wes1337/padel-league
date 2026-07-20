import { nanoid } from 'nanoid'

/**
 * Generate an unguessable token. Prefers crypto.randomUUID, but that only exists
 * in secure contexts (HTTPS / localhost) — over plain-http (e.g. LAN testing on a
 * phone, or some native webview schemes) it's undefined. Fall back to nanoid so
 * token generation never throws.
 */
export function genToken(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return nanoid(21)
}
