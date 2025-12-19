# Forgot Password & Reset Flow — Implementation Plan

## 1. Objective
Ship a password recovery flow that relies on one-time passcodes (OTPs) only, keeps the database untouched, and guarantees that no information about account existence leaks to clients.

## 2. End-to-End Flow
1. User submits their email to `POST /api/auth/forgot-password`.
2. API validates the payload, silently returns success, and—if the user exists—generates a 6-digit OTP.
3. The OTP plus metadata (`userId`, rate-limit counters) are stored in Valkey with a 30-minute TTL and the OTP is emailed to the user.
4. User sends `email + otp + new password` to `POST /api/auth/reset-password`.
5. API validates, verifies OTP from Valkey, updates the password hash in PostgreSQL, deletes the OTP key, and rotates all existing sessions/JWTs.

## 3. Data & Storage
- **Valkey key structure**
  - `fp:otp:<email>` → `{ userId, otp, attempts }`, TTL 30 minutes.
  - `fp:rate:<email>` / `fp:rate:<ip>` for throttling (TTL 1 hour).
- **PostgreSQL**
  - No new tables; only touch `users` for password + timestamps.
- **Audit trail**
  - Use existing `audit_logs` to capture request/reset events.

## 4. API Surface
| Method | Endpoint | Auth | Payload | Response |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/forgot-password` | Public | `{ email: string }` | `{ message: 'If the email exists, instructions were sent.' }` |
| `POST` | `/api/auth/reset-password` | Public | `{ email: string, otp: string, password: string, confirmPassword: string }` | `{ message: 'Password updated successfully.' }` |

## 5. Validation & Security
- **Input validation:** Zod schemas for both endpoints, including password strength and matching confirmation.
- **OTP specification:** 6 numeric digits, random per request, expires in 30 minutes, max 3 verification attempts before invalidation.
- **Rate limiting:** Enforce per-IP and per-email caps via Valkey counters (e.g., 5 forgot requests/hour, 10 reset attempts/hour).
- **Email content:** Provide OTP, expiration time, requester IP/time, and support contact without confirming account existence.
- **Password update side effects:** bump `users.updated_at`, optionally invalidate refresh tokens or session cache entries.
- **Audit logging:** record `forgot_password_requested` and `password_reset_completed` entries with minimal metadata.

## 6. Service Responsibilities
- **Auth Controller**
  - `forgotPassword`: validate payload, check rate limits, call service to generate OTP + enqueue email job, return generic response.
  - `resetPassword`: validate payload, check rate limits, verify OTP via service, update password, emit audit log.
- **Auth Service**
  - `issueResetOtp(email)`: fetch user, generate OTP, store in Valkey, enqueue mail job payload.
  - `resetPasswordWithOtp(email, otp, password)`: verify OTP + attempts, hash password with `bcryptjs`, persist, delete OTP key.
- **Queue Worker (BullMQ)**
  - `sendForgotPasswordOtp` job renders Nodemailer template with OTP + instructions.
- **Valkey Utilities**
  - Helpers for storing OTP payloads, incrementing attempts, and purging keys.

## 7. Implementation Checklist & Status
| # | Task | Status | Notes / References |
| :- | :--- | :--- | :--- |
| 1 | Env & Config | ✅ Done | `src/config/env.js` now loads OTP TTL, rate limits, feature flag, and frontend URL. |
| 2 | Validation Schemas | ✅ Done | `src/validations/auth.validation.js` adds `forgotPasswordSchema` + `resetPasswordSchema` with OTP + password confirmation rules. |
| 3 | Valkey Helpers | ✅ Done | `src/services/auth.service.js` introduces key builders, rate-limiters, OTP persistence, and attempt tracking. |
| 4 | Auth Service Updates | ✅ Done | Same service file handles OTP issuance, emailing, verification, and password hashing via `userRepository.updatePasswordHash`. |
| 5 | Controllers & Routes | ✅ Done | `src/controllers/auth.controller.js` + `src/routes/v1/auth.routes.js` expose `/forgot-password` & `/reset-password` endpoints with neutral responses. |
| 6 | Email Template | ✅ Done | Inline text/HTML template sent via `sendMail` (see `sendOtpEmail` helper). |
| 7 | BullMQ Job | ⚠ Pending | Email currently dispatched inline; once a worker exists, move to BullMQ processor per original plan. |
| 8 | Monitoring & Alerts | ⚠ Pending | Needs metrics/alerts once observability stack is ready. |
| 9 | Tests | ⚠ Pending | No automated coverage yet; add unit/integration tests with mocked Valkey + Nodemailer. |

## 8. Testing & Verification
- **Automated:** run Jest integration suite backed by test Postgres and Valkey containers; mock Nodemailer transport to capture OTP emails.
- **Manual Smoke:** simulate forgot/reset via Postman, confirm OTP stored in Valkey, verify password updates and old credentials fail.
- **Security Review:** ensure OTP reuse is blocked, rate limits enforced, logs contain no PII, and audit entries are generated for compliance.

## 9. Next Steps
1. Offload the OTP email dispatch to BullMQ once the worker infrastructure is live, keeping the API response path fast and resilient.
2. Instrument request/reset counters plus Valkey error alerts to surface abuse or outages quickly.
3. Add automated tests (unit + integration) mocking Nodemailer and Valkey to guard against regressions.
