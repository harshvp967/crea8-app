# Post webhooks

When a post finishes publishing, the orchestrator POSTs the post JSON to each webhook URL saved for that organization. The request is the same body as before. When `POST_WEBHOOK_SECRET` is set, two headers are added.

| Header | Value |
| --- | --- |
| `X-Crea8-Signature` | `sha256=` plus a hex HMAC-SHA256 |
| `X-Crea8-Timestamp` | Unix time in seconds |

Link-in-Bio lead webhooks use the same `X-Crea8-Signature: sha256=<hex>` header. Post webhooks also bind the timestamp into the MAC so a captured body cannot be replayed with a new time.

The root secret stays on the server. Each webhook has its own key, `HMAC-SHA256(POST_WEBHOOK_SECRET, webhookId)`. `GET /webhooks` returns that key as `signingSecret` for the signed-in organization. Receivers use their own key. They never see the root secret.

Until `POST_WEBHOOK_SECRET` is set on the Railway orchestrator, deliveries stay unsigned and the field is null. Set the same value on the Railway backend so the settings page can show the derived key.

## Verify a delivery

1. Read the raw body bytes. Do not re-serialize JSON.
2. Read `X-Crea8-Timestamp`. Reject the request if it is more than 5 minutes off your clock.
3. Compute `HMAC-SHA256(signingSecret, timestamp + "." + rawBody)` and hex-encode it.
4. Compare that hex to the value after `sha256=` with a constant-time compare.

Example (Node):

```js
const crypto = require('crypto');

function verify(rawBody, secret, timestamp, signature) {
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const sent = (signature || '').replace(/^sha256=/, '');
  const left = Buffer.from(sent);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
```

A receiver that ignores unknown headers keeps working. A receiver that requires the signature should refuse deliveries with a missing or bad header.
