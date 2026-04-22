# Needed APIs

Testing backend base URL: https://api-test.indealeg.com

1. **Deals module** – list deals, create deals, submit RFQ/auction requests, view/update negotiations, and close/archive deals.
2. **Company approval helpers** – support document review, approval/rejection actions, and status audit for pending companies.
3. **Email verification/resend** – resend verification link endpoint (tokens expire) and status reporting for verification attempts.
4. **OTP/password recovery audit** – endpoints to monitor OTP requests, rate-limit status, and reset history per user or IP.
5. **Deal request workflow** – surface endpoints for accepting/rejecting `deal_requests`, viewing history, and posting comments or votes.
6. **Chat fallbacks** – REST APIs for fetching chat rooms/messages and posting new messages when real-time socket fails.
7. **Ads management** – CRUD for `advertisements`, plus analytics endpoints (daily stats, click events) for campaign insights.
8. **File/document access** – list/download company documents and gallery assets beyond signed upload URLs.
9. **System health & metrics** – expanded `/system` routes for audit logs, Redis/Postgres health, and queue job summaries.
