import crypto from 'node:crypto'

/**
 * Verify the HMAC-SHA256 signature Meta attaches to webhook POSTs.
 *
 * Meta signs the raw request body with your App Secret and sends the
 * result in the `x-hub-signature-256: sha256=<hex>` header. Without
 * verification, anyone who knows our webhook URL can POST fabricated
 * status updates and drift broadcast counts arbitrarily.
 *
 * Reference:
 *   https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verify-payloads
 *
 * Contract:
 *   `META_APP_SECRET` is required. If it's missing we fail closed -
 *   every request is rejected until the operator configures the
 *   secret. A previous version fell open with a warning log, which is
 *   unsafe for a public template: anyone who forgets the env var would
 *   be running a fully spoofable webhook.
 */
export function getMetaWebhookSignatureError(
  rawBody: string,
  signatureHeader: string | null,
): string | null {
  const secret = process.env.META_APP_SECRET
  if (!secret) {
    return (
      'META_APP_SECRET is not set. Configure the Meta App Secret in this deployment ' +
      'before retrying webhook delivery.'
    )
  }

  if (!signatureHeader) return 'Missing x-hub-signature-256 header.'
  if (!signatureHeader.startsWith('sha256=')) {
    return 'Malformed x-hub-signature-256 header. Expected sha256=<hex>.'
  }

  const expected =
    'sha256=' +
    crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

  const a = Buffer.from(signatureHeader)
  const b = Buffer.from(expected)

  // Bail if lengths differ - timingSafeEqual throws otherwise.
  if (a.length !== b.length) {
    return 'Signature length mismatch. This usually means the App Secret is wrong.'
  }
  if (!crypto.timingSafeEqual(a, b)) {
    return 'Signature mismatch. Check META_APP_SECRET and confirm Meta is posting to the current deployment.'
  }

  return null
}

export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const error = getMetaWebhookSignatureError(rawBody, signatureHeader)
  if (error) {
    console.error('[webhook] signature verification failed:', error)
    return false
  }
  return true
}
