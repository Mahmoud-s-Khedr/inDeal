# inDeal API (Bruno collection)

This folder contains the Bruno/Bruno-format API documentation used by the inDeal backend. Every endpoint listed in `AI_DOCS/api_reference.md` should be represented under this folder via `.bru` request definitions and any shared collection-level metadata.

## What changed

- Auth, company, user, file, and admin routes now use a single JWT session with `jti`/`aexp`, new `logout`, and refreshed validation requirements (see `AI_DOCS/api_reference.md`).
- Company resend-for-review now emails both the admin inbox and the agent, and admin approval/rejection email the agent as well.
- Password resets now block reuse of the last two passwords.
- New environment values exist for session TTLs and company review notifications; these may require updates in your collection variables if you use them during manual tests.

## Updating the Bruno requests

1. Install Bruno CLI (`npm install -g @withbruno/cli`) if not already installed.
2. From this folder, run `bruno pull` to sync the collection with `collection.bru` (optional: install future requests via `bruno push`).
3. For each request under the `/api/v1` routes, ensure:
   - Request URL matches the paths documented in `AI_DOCS/api_reference.md`.
   - The `Authorization: Bearer {{auth_token}}` header is present where `Auth` is required.
   - Body schemas follow the validation rules for each endpoint (extracted from the `*.validation.js` files).
4. Add any missing endpoints (logout, user settings, admin operations) as `.bru` files using `bruno add <name>` or by cloning the existing folder structure.
5. Update the `docs` sections (especially `Auth` and `Company Portfolio`) with the new behavior (e.g., `resend-for-review` now also triggers a confirmation email to the agent). The `bruno.json` metadata can keep `api_host`/`base_url` as-is (or switch to the test URL if preferred).

## Next steps

- Once the Bruno collection is updated, run `bruno validate` and `bruno push` to regenerate the workspace. Any `response.json` fixtures can be refreshed by hitting the endpoints via `bruno run` or Postman.
- If you prefer to keep the `.bru` files in sync programmatically, consider writing a script that reads `AI_DOCS/api_reference.md` and regenerates the Bruno requests automatically.

Let me know if you want me to script the `bruno` regeneration or if you’d like a summary of which endpoints are still missing from the collection.
