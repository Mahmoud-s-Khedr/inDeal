# Email Verification Performance Notes

## Observation
- Registration response now hovers around ~3s because `sendVerificationEmail` is awaited during the same transaction that also responds with the JWT. The delay is dominated by outbound SMTP/ Nodemailer latency.

## Suggestions
1. **Fire-and-forget email** – remove the `await` when calling `sendVerificationEmail`; instead call it after `sendResponse` (or inside `process.nextTick`) so the HTTP response is not blocked by mail delivery.
2. **Use a background queue** – enqueue a job (e.g., BullMQ/Valkey) with payload `{ userId, email }`; workers send the email independently, keeping the register API fast and adding retry/circuit controls.
3. **Cache SMTP latency** – if mail provider is marginal, consider warming a reusable transporter or batch-sending (less impact than serial waits).
4. **Expose status endpoint** – let clients poll `/auth/email-verification-status` that reports whether Redis already has a pending token so UI doesn’t rely on the delayed response.

Applying (1) or (2) will cut registration latency down to sub-500ms while still delivering verification links within seconds.
