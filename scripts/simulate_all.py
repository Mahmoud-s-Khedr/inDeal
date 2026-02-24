#!/usr/bin/env python3
"""
simulate_all.py
===============
Full scenario simulation of the inDeal API.

Participants
------------
  - 4 seeded agents  : agent1-4@indeal.test  (env: SEED_TEST_AGENT_PREFIX, SEED_TEST_EMAIL_DOMAIN)
  - 1 admin          : admin@indeal.local     (env: SEED_ADMIN_EMAIL)

Coverage
--------
  Every API endpoint in the system (~145+), across 15 ordered phases.
  Realistic cross-agent flows: deals, reviews, chat, ads, support.

Scenario matrix
---------------
  agents[0] owns Deal-0  ← agents[1] requests (ACCEPTED) → review + chat
  agents[1] owns Deal-1  ← agents[2] requests (ACCEPTED) → review + chat
  agents[2] owns Deal-2  ← agents[3] requests (ACCEPTED) → review + chat
  agents[3] owns Deal-3  ← agents[0] requests (ACCEPTED) → review + chat

  Each agent also submits one withdraw request (on a different deal) that is
  retracted before the owner acts on it.

Output
------
  scripts/output/simulate_all_results.json          (all results)
  scripts/output/simulate_all_results_<family>.json (by HTTP status family)
"""

import json
import os
import time
from datetime import datetime, timezone
from urllib import request as urllib_request, parse, error as urllib_error

# ── paths ──────────────────────────────────────────────────────────────────

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "scripts", "output")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "simulate_all_results.json")

print(f"Project root: {PROJECT_ROOT}")

# ── env helpers ────────────────────────────────────────────────────────────


def load_env_file(path):
    if not os.path.exists(path):
        return {}
    env = {}
    with open(path, "r", encoding="utf-8") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip("\"'")
            env[key] = value
    return env


def load_env():
    env = {}
    for name in [".env", ".env.backup", ".env.docker", ".env.example"]:
        env.update(load_env_file(os.path.join(PROJECT_ROOT, name)))
    env.update(os.environ)
    return env


# ── HTTP helpers ───────────────────────────────────────────────────────────


def json_dumps_safe(value):
    try:
        return json.dumps(value, ensure_ascii=False)
    except TypeError:
        return json.dumps(str(value), ensure_ascii=False)


def request_json(method, url, headers=None, body=None, timeout=25):
    headers = headers or {}
    data = None
    if body is not None:
        data = json_dumps_safe(body).encode("utf-8")
        headers = {**headers, "Content-Type": "application/json"}
    req = urllib_request.Request(url, data=data, headers=headers, method=method)
    started = time.time()
    try:
        with urllib_request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            text = raw.decode("utf-8", errors="replace")
            duration_ms = int((time.time() - started) * 1000)
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError:
                parsed = None
            return {
                "ok": True,
                "status": resp.status,
                "headers": dict(resp.headers),
                "text": text,
                "json": parsed,
                "durationMs": duration_ms,
                "error": None,
            }
    except urllib_error.HTTPError as exc:
        text = exc.read().decode("utf-8", errors="replace")
        duration_ms = int((time.time() - started) * 1000)
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            parsed = None
        return {
            "ok": False,
            "status": exc.code,
            "headers": dict(exc.headers),
            "text": text,
            "json": parsed,
            "durationMs": duration_ms,
            "error": str(exc),
        }
    except Exception as exc:  # pylint: disable=broad-except
        duration_ms = int((time.time() - started) * 1000)
        return {
            "ok": False,
            "status": None,
            "headers": {},
            "text": "",
            "json": None,
            "durationMs": duration_ms,
            "error": str(exc),
        }


# ── call tracking ──────────────────────────────────────────────────────────

_call_counter = 0


def call_api(results, role, method, base_url, path, token=None, params=None, body=None):
    global _call_counter
    _call_counter += 1
    url = base_url + path
    if params:
        url += "?" + parse.urlencode(params, doseq=True)

    print(f"[{_call_counter:04d}] {role:<30} {method:<6} {path}")

    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    resp = request_json(method, url, headers=headers, body=body)

    icon = "✓" if resp["ok"] else "✗"
    print(f"       {icon} {resp['status']} ({resp['durationMs']}ms)")

    results.append(
        {
            "timestamp": now_iso(),
            "role": role,
            "method": method,
            "url": url,
            "request": {"params": params, "body": body},
            "status_code": resp["status"],
            "ok": resp["ok"],
            "durationMs": resp["durationMs"],
            "response": {
                "headers": resp["headers"],
                "text": resp["text"],
                "json": resp["json"],
            },
            "error": resp["error"],
        }
    )
    return resp


# ── extraction helpers ─────────────────────────────────────────────────────


def extract_token(resp_json):
    if not isinstance(resp_json, dict):
        return None
    data = resp_json.get("data") or {}
    for key in ["accessToken", "token", "jwt"]:
        if key in data:
            return data.get(key)
    return None


def extract_data(resp_json):
    if isinstance(resp_json, dict):
        return resp_json.get("data")
    return None


def extract_list(resp_json):
    data = extract_data(resp_json)
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("items", "companies", "results", "tickets", "chats", "rooms", "updates"):
            if isinstance(data.get(key), list):
                return data.get(key)
    return []


def extract_data_id(data, candidates=None):
    if not isinstance(data, dict):
        return None
    candidates = candidates or ["id", "roomId", "fileId", "documentId", "dealId", "requestId"]
    for key in candidates:
        if key in data and isinstance(data[key], int):
            return data[key]
    return None


def now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def status_family(status_code):
    if isinstance(status_code, int):
        return f"{status_code // 100}xxV10"
    return "unknown"


def ensure_output_dir():
    os.makedirs(OUTPUT_DIR, exist_ok=True)


# ── display helpers ────────────────────────────────────────────────────────


def phase_header(num, title):
    print(f"\n{'═' * 64}")
    print(f"  PHASE {num}: {title}")
    print(f"{'═' * 64}")


# ── login with email-change fallback ──────────────────────────────────────


def login_with_fallback(results, base_url, email, password):
    """Try original email first, then updated_{email} if changed by admin."""
    for candidate in [email, f"updated_{email}"]:
        resp = call_api(
            results,
            f"agent:{email}",
            "POST",
            base_url,
            "/auth/login",
            body={"email": candidate, "password": password},
        )
        token = extract_token(resp.get("json"))
        if token:
            return {"email": candidate, "token": token}
    return {"email": email, "token": None}


# ══════════════════════════════════════════════════════════════════════════
# PHASE 0 — Admin Login
# ══════════════════════════════════════════════════════════════════════════


def phase0_admin_login(results, base_url, admin_email, admin_password):
    phase_header(0, "Admin Login")
    resp = call_api(
        results,
        "admin",
        "POST",
        base_url,
        "/auth/admin/login",
        body={"email": admin_email, "password": admin_password},
    )
    token = extract_token(resp.get("json"))
    if not token:
        print("  ⚠  Admin login failed — admin endpoints will be skipped")
    return token


# ══════════════════════════════════════════════════════════════════════════
# PHASE 1 — Resolve Agent Entities via Admin API
# ══════════════════════════════════════════════════════════════════════════


def phase1_resolve_agents(results, base_url, admin_token, seeded_emails):
    phase_header(1, "Resolve Agent Emails via Admin API")
    if not admin_token:
        print("  ⚠  No admin token — using seeded emails as-is")
        return seeded_emails

    resp = call_api(results, "admin", "GET", base_url, "/admin/companies", token=admin_token)
    companies = extract_list(resp.get("json"))

    resolved = []
    for company in companies[: len(seeded_emails)]:
        cid = company.get("id") if isinstance(company, dict) else None
        if not cid:
            continue
        detail = call_api(
            results, "admin", "GET", base_url, f"/admin/companies/{cid}", token=admin_token
        )
        detail_data = extract_data(detail.get("json"))
        if isinstance(detail_data, dict):
            agent = detail_data.get("agent")
            if isinstance(agent, dict) and agent.get("email"):
                resolved.append(agent["email"])

    if len(resolved) >= 4:
        print(f"  → Resolved {len(resolved)} agent emails from admin API")
        return resolved

    print(f"  → Only resolved {len(resolved)} emails — falling back to seeded list")
    return seeded_emails


# ══════════════════════════════════════════════════════════════════════════
# PHASE 2 — Agent Logins + Fetch Profile IDs
# ══════════════════════════════════════════════════════════════════════════


def phase2_agent_logins(results, base_url, agent_emails, agent_password):
    phase_header(2, "Agent Logins + Fetch Profile IDs")
    agents = []
    for email in agent_emails[:4]:
        ctx = {
            "email": email,
            "token": None,
            "company_id": None,
            "user_id": None,
            "file_id": 1,
            "deal_id": 1,
            # deal flow fields
            "main_request_id": None,
            "main_deal_id": None,
            "main_deal_owner_idx": None,
            "withdraw_request_id": None,
            "accepted_deal_id": None,
            "review_target_company_id": None,
            # other
            "room_id": None,
            "ad_id": 1,
            "ticket_id": 1,
            "support_chat_id": 1,
        }

        login_result = login_with_fallback(results, base_url, email, agent_password)
        token = login_result.get("token")
        if not token:
            print(f"  ⚠  Login failed for {email}")
            agents.append(ctx)
            continue

        ctx["token"] = token
        ctx["email"] = login_result["email"]  # might be updated_{email}

        # company profile
        resp_c = call_api(
            results, f"agent:{ctx['email']}", "GET", base_url, "/companies/me", token=token
        )
        company_data = extract_data(resp_c.get("json"))
        if isinstance(company_data, dict):
            ctx["company_id"] = company_data.get("id")

        # user profile
        resp_u = call_api(
            results, f"agent:{ctx['email']}", "GET", base_url, "/users/me", token=token
        )
        user_data = extract_data(resp_u.get("json"))
        if isinstance(user_data, dict):
            ctx["user_id"] = user_data.get("id")

        agents.append(ctx)

    logged_in = sum(1 for a in agents if a.get("token"))
    print(f"\n  → {logged_in}/{len(agents)} agents logged in")
    return agents


# ══════════════════════════════════════════════════════════════════════════
# PHASE 3 — Unknown User (Public + 401/403 Auth Tests)
# ══════════════════════════════════════════════════════════════════════════


def phase3_unknown_user(results, base_url, admin_email, admin_password):
    phase_header(3, "Unknown User — Public Endpoints + 401/403 Auth Tests")
    role = "unknown"
    ts = int(time.time())

    # ── public read endpoints ──────────────────────────────────────────────
    call_api(results, role, "GET", base_url, "/health")
    call_api(results, role, "GET", base_url, "/system/stats")
    call_api(results, role, "GET", base_url, "/system/config")
    call_api(results, role, "GET", base_url, "/companies/search", params={"q": "test", "limit": 5})
    call_api(results, role, "GET", base_url, "/companies/1")
    call_api(results, role, "GET", base_url, "/companies/1/gallery")
    call_api(results, role, "GET", base_url, "/companies/1/reviews")
    call_api(results, role, "GET", base_url, "/companies/1/documents")
    call_api(results, role, "GET", base_url, "/deals", params={"limit": 5})
    call_api(results, role, "GET", base_url, "/deals/1")
    call_api(results, role, "GET", base_url, "/ads/active")
    call_api(results, role, "GET", base_url, "/ads/1/click")
    call_api(results, role, "GET", base_url, "/support/info")

    # ── auth public flows ──────────────────────────────────────────────────
    call_api(
        results,
        role,
        "POST",
        base_url,
        "/auth/register/upload-url",
        body={"fileName": "id.pdf", "fileType": "application/pdf", "fileSize": 512000},
    )

    unknown_email = f"unknown_{ts}@example.com"
    call_api(
        results,
        role,
        "POST",
        base_url,
        "/auth/register",
        body={
            "user": {
                "username": f"u_{ts}",
                "email": unknown_email,
                "password": "Password123!",
                "firstName": "Unknown",
                "lastName": "User",
            },
            "company": {"name": "Unknown Co Test", "description": "Temporary test company"},
        },
    )

    call_api(
        results, role, "POST", base_url, "/auth/login",
        body={"email": unknown_email, "password": "Password123!"}
    )
    call_api(
        results, role, "POST", base_url, "/auth/admin/login",
        body={"email": admin_email, "password": admin_password}
    )
    call_api(
        results, role, "POST", base_url, "/auth/forgot-password",
        body={"email": admin_email}
    )
    call_api(
        results, role, "POST", base_url, "/auth/resend-forgot-password-otp",
        body={"email": admin_email}
    )
    call_api(
        results, role, "POST", base_url, "/auth/verify-otp",
        body={"email": admin_email, "otp": "000000"}
    )
    call_api(
        results, role, "POST", base_url, "/auth/reset-password",
        body={
            "email": admin_email,
            "otp": "000000",
            "password": "Password123!",
            "confirmPassword": "Password123!",
        },
    )
    call_api(
        results, role, "POST", base_url, "/auth/resend-verification",
        body={"email": admin_email}
    )
    call_api(
        results, role, "GET", base_url, "/auth/verify-email",
        params={"email": admin_email, "token": "invalid_test_token"}
    )

    # guest support ticket (optionalAuth)
    call_api(
        results, role, "POST", base_url, "/support/tickets",
        body={
            "subject": "Guest inquiry",
            "message": "Testing guest ticket submission without auth.",
            "email": f"guest_{ts}@example.com",
            "priority": "low",
        },
    )

    # ── 401/403 on protected endpoints (no auth) ──────────────────────────
    protected_paths = [
        ("POST", "/files/upload-url"),
        ("GET", "/files/1"),
        ("GET", "/users/me"),
        ("PUT", "/users/me"),
        ("PUT", "/users/me/password"),
        ("PUT", "/users/me/profile-image"),
        ("DELETE", "/users/me/profile-image"),
        ("GET", "/users/me/devices"),
        ("POST", "/users/me/devices"),
        ("DELETE", "/users/me/devices"),
        ("GET", "/companies/me"),
        ("PUT", "/companies/me"),
        ("POST", "/companies/me/resend-for-review"),
        ("POST", "/auth/resubmit"),
        ("POST", "/auth/logout"),
        ("GET", "/companies/me/gallery"),
        ("POST", "/companies/me/gallery"),
        ("PUT", "/companies/me/gallery/1"),
        ("DELETE", "/companies/me/gallery/1"),
        ("GET", "/companies/me/documents"),
        ("POST", "/companies/me/documents"),
        ("PUT", "/companies/me/documents/1"),
        ("DELETE", "/companies/me/documents/1"),
        ("GET", "/companies/me/registration-documents"),
        ("PUT", "/companies/me/registration-documents/1"),
        ("DELETE", "/companies/me/registration-documents/1"),
        ("GET", "/companies/me/contributions"),
        ("POST", "/companies/me/contributions"),
        ("PUT", "/companies/me/contributions/1"),
        ("DELETE", "/companies/me/contributions/1"),
        ("GET", "/companies/me/contributions/1/media"),
        ("POST", "/companies/me/contributions/1/media"),
        ("PUT", "/companies/me/contributions/1/media/1"),
        ("DELETE", "/companies/me/contributions/1/media/1"),
        ("PUT", "/companies/me/contributions/1/media/reorder"),
        ("POST", "/companies/1/reviews"),
        ("GET", "/deals/me/deals"),
        ("POST", "/deals"),
        ("PUT", "/deals/1"),
        ("DELETE", "/deals/1"),
        ("GET", "/deals/me/requests"),
        ("POST", "/deals/1/requests"),
        ("GET", "/deals/1/requests"),
        ("PATCH", "/deals/1/requests/1/status"),
        ("DELETE", "/deals/requests/1"),
        ("GET", "/chats"),
        ("POST", "/chats"),
        ("GET", "/chats/1"),
        ("PATCH", "/chats/1/archive"),
        ("GET", "/chats/1/messages"),
        ("POST", "/chats/1/messages"),
        ("POST", "/chats/1/read"),
        ("GET", "/ads/me"),
        ("POST", "/ads"),
        ("GET", "/ads/1"),
        ("PUT", "/ads/1"),
        ("DELETE", "/ads/1"),
        ("GET", "/ads/1/analytics"),
        ("GET", "/support/tickets"),
        ("GET", "/support/tickets/1"),
        ("POST", "/support/chat"),
        ("GET", "/support/chat"),
        ("GET", "/support/chat/1/messages"),
        ("POST", "/support/chat/1/messages"),
        ("GET", "/notifications"),
        ("PUT", "/notifications/read-all"),
        ("DELETE", "/notifications/read"),
        ("PUT", "/notifications/1/read"),
        ("DELETE", "/notifications/1"),
        # admin (requires both auth AND admin role)
        ("GET", "/admin/dashboard/cards"),
        ("GET", "/admin/companies"),
        ("GET", "/admin/companies/pending"),
        ("GET", "/admin/companies/1"),
        ("PUT", "/admin/companies/1"),
        ("PUT", "/admin/companies/1/summary"),
        ("PATCH", "/admin/companies/1/status"),
        ("POST", "/admin/companies/1/approve"),
        ("POST", "/admin/companies/1/reject"),
        ("POST", "/admin/companies/1/agent"),
        ("PATCH", "/admin/agents/1/email"),
        ("GET", "/admin/companies/1/reviews"),
        ("GET", "/admin/companies/1/gallery"),
        ("POST", "/admin/companies/1/gallery"),
        ("PUT", "/admin/companies/1/gallery/1"),
        ("DELETE", "/admin/companies/1/gallery/1"),
        ("GET", "/admin/companies/1/documents"),
        ("POST", "/admin/companies/1/documents"),
        ("PUT", "/admin/companies/1/documents/1"),
        ("DELETE", "/admin/companies/1/documents/1"),
        ("GET", "/admin/companies/1/registration-documents"),
        ("PUT", "/admin/companies/1/registration-documents/1"),
        ("DELETE", "/admin/companies/1/registration-documents/1"),
        ("GET", "/admin/companies/1/contributions"),
        ("POST", "/admin/companies/1/contributions"),
        ("PUT", "/admin/companies/1/contributions/1"),
        ("DELETE", "/admin/companies/1/contributions/1"),
        ("GET", "/admin/companies/pending-updates"),
        ("GET", "/admin/companies/pending-updates/1"),
        ("POST", "/admin/companies/pending-updates/1/approve"),
        ("POST", "/admin/companies/pending-updates/1/reject"),
        ("GET", "/admin/deals"),
        ("GET", "/admin/deals/1"),
        ("PATCH", "/admin/deals/1/status"),
        ("GET", "/admin/ads"),
        ("GET", "/admin/ads/1"),
        ("PATCH", "/admin/ads/1/status"),
        ("GET", "/admin/tickets"),
        ("GET", "/admin/tickets/1"),
        ("PATCH", "/admin/tickets/1"),
        ("POST", "/admin/tickets/1/responses"),
        ("GET", "/admin/support/chats"),
        ("GET", "/admin/support/chats/waiting"),
        ("GET", "/admin/support/chats/1"),
        ("POST", "/admin/support/chats/1/assign"),
        ("POST", "/admin/support/chats/1/close"),
    ]

    for method, path in protected_paths:
        call_api(results, role, method, base_url, path)


# ══════════════════════════════════════════════════════════════════════════
# PHASE 4 — File Upload URL Setup
# ══════════════════════════════════════════════════════════════════════════


def phase4_file_setup(results, base_url, agents):
    phase_header(4, "File Upload URL + File Retrieval")
    for ctx in agents:
        if not ctx.get("token"):
            continue
        role = f"agent:{ctx['email']}"
        token = ctx["token"]

        resp = call_api(
            results, role, "POST", base_url, "/files/upload-url", token=token,
            body={"fileName": "profile.png", "fileType": "image/png", "fileSize": 204800},
        )
        file_data = extract_data(resp.get("json"))
        file_id = None
        if isinstance(file_data, dict) and isinstance(file_data.get("file"), dict):
            file_id = file_data["file"].get("id")
        ctx["file_id"] = file_id or 1

        # retrieve file metadata
        call_api(results, role, "GET", base_url, f"/files/{ctx['file_id']}", token=token)


# ══════════════════════════════════════════════════════════════════════════
# PHASE 5 — Company Setup
# ══════════════════════════════════════════════════════════════════════════


def phase5_company_setup(results, base_url, agents):
    phase_header(5, "Company Setup (Profile · Gallery · Docs · Contributions)")
    for ctx in agents:
        if not ctx.get("token"):
            continue
        role = f"agent:{ctx['email']}"
        token = ctx["token"]
        file_id = ctx.get("file_id") or 1
        company_id = ctx.get("company_id") or 1

        print(f"\n  [{ctx['email']}]")

        # ── profile ───────────────────────────────────────────────────────
        call_api(results, role, "GET", base_url, "/companies/me", token=token)
        call_api(
            results, role, "PUT", base_url, "/companies/me", token=token,
            body={"description": f"Updated by simulate_all — {ctx['email']}"},
        )
        call_api(results, role, "POST", base_url, "/companies/me/resend-for-review", token=token)
        call_api(results, role, "POST", base_url, "/auth/resubmit", token=token)

        # ── gallery CRUD ──────────────────────────────────────────────────
        resp = call_api(
            results, role, "POST", base_url, "/companies/me/gallery", token=token,
            body={"imageFileId": file_id, "description": "Gallery item (simulate_all)"},
        )
        gallery_id = extract_data_id(extract_data(resp.get("json"))) or 1
        call_api(
            results, role, "PUT", base_url, f"/companies/me/gallery/{gallery_id}", token=token,
            body={"description": "Updated gallery item"},
        )
        call_api(results, role, "GET", base_url, "/companies/me/gallery", token=token)
        call_api(results, role, "DELETE", base_url, f"/companies/me/gallery/{gallery_id}",
                 token=token)

        # ── documents CRUD ────────────────────────────────────────────────
        resp = call_api(
            results, role, "POST", base_url, "/companies/me/documents", token=token,
            body={"fileId": file_id, "description": "Test document (simulate_all)"},
        )
        doc_id = extract_data_id(extract_data(resp.get("json"))) or 1
        call_api(
            results, role, "PUT", base_url, f"/companies/me/documents/{doc_id}", token=token,
            body={"description": "Updated document"},
        )
        call_api(results, role, "GET", base_url, "/companies/me/documents", token=token)
        call_api(results, role, "DELETE", base_url, f"/companies/me/documents/{doc_id}",
                 token=token)

        # ── registration documents (read + update/delete if seeded) ───────
        resp_reg = call_api(
            results, role, "GET", base_url, "/companies/me/registration-documents", token=token
        )
        reg_docs = extract_list(resp_reg.get("json"))
        reg_doc_id = None
        if reg_docs and isinstance(reg_docs[0], dict):
            reg_doc_id = reg_docs[0].get("id")
        if reg_doc_id:
            call_api(
                results, role, "PUT", base_url,
                f"/companies/me/registration-documents/{reg_doc_id}", token=token,
                body={"description": "Updated registration doc"},
            )
            call_api(
                results, role, "DELETE", base_url,
                f"/companies/me/registration-documents/{reg_doc_id}", token=token,
            )

        # ── contributions CRUD + media CRUD + reorder ─────────────────────
        resp = call_api(
            results, role, "POST", base_url, "/companies/me/contributions", token=token,
            body={
                "type": "project",
                "title": "Simulate All Contribution",
                "description": "Created by simulate_all.py",
                "mediaType": "url",
                "mediaUrl": "https://example.com/portfolio",
            },
        )
        contrib_id = extract_data_id(extract_data(resp.get("json"))) or 1
        call_api(
            results, role, "PUT", base_url, f"/companies/me/contributions/{contrib_id}",
            token=token, body={"description": "Updated contribution"},
        )
        call_api(results, role, "GET", base_url, "/companies/me/contributions", token=token)

        # contribution media
        resp = call_api(
            results, role, "POST", base_url,
            f"/companies/me/contributions/{contrib_id}/media", token=token,
            body={"mediaType": "url", "mediaUrl": "https://example.com/asset",
                  "caption": "Asset caption"},
        )
        media_id = extract_data_id(extract_data(resp.get("json"))) or 1
        call_api(
            results, role, "PUT", base_url,
            f"/companies/me/contributions/{contrib_id}/media/{media_id}",
            token=token, body={"caption": "Updated caption"},
        )
        call_api(
            results, role, "GET", base_url,
            f"/companies/me/contributions/{contrib_id}/media", token=token,
        )
        call_api(
            results, role, "PUT", base_url,
            f"/companies/me/contributions/{contrib_id}/media/reorder",
            token=token, body={"orderedIds": [media_id]},
        )
        call_api(
            results, role, "DELETE", base_url,
            f"/companies/me/contributions/{contrib_id}/media/{media_id}", token=token,
        )
        call_api(
            results, role, "DELETE", base_url, f"/companies/me/contributions/{contrib_id}",
            token=token,
        )

        # ── public company profile ─────────────────────────────────────────
        call_api(results, role, "GET", base_url, f"/companies/{company_id}", token=token)
        call_api(results, role, "GET", base_url, f"/companies/{company_id}/gallery", token=token)
        call_api(results, role, "GET", base_url, f"/companies/{company_id}/reviews", token=token)
        call_api(results, role, "GET", base_url, f"/companies/{company_id}/documents", token=token)


# ══════════════════════════════════════════════════════════════════════════
# PHASE 6 — Deals & Requests (Cross-Agent Flow)
# ══════════════════════════════════════════════════════════════════════════


def phase6_deals_flow(results, base_url, agents):
    """
    Scenario (n=4 agents, indices 0–3):
      Owner  = agents[i]         → owns Deal[i]
      Main applicant  = agents[(i+1)%n] → accepted request
      Withdraw applicant = agents[(i+2)%n] → request that is then withdrawn

    After completion each agent will have:
      accepted_deal_id         — deal ID they were accepted on
      review_target_company_id — company of the deal owner
    """
    phase_header(6, "Deals & Requests (Cross-Agent)")
    n = len(agents)

    # 6a — Create one deal per agent ────────────────────────────────────────
    print("\n  6a  Creating deals")
    for ctx in agents:
        if not ctx.get("token"):
            ctx.setdefault("deal_id", 1)
            continue
        role = f"agent:{ctx['email']}"
        resp = call_api(
            results, role, "POST", base_url, "/deals", token=ctx["token"],
            body={
                "dealName": f"Deal by {ctx['email']}",
                "dealDescription": "Created by simulate_all.py for cross-agent testing",
                "dealValue": 100000,
                "dealType": "rfq",
            },
        )
        ctx["deal_id"] = extract_data_id(extract_data(resp.get("json"))) or 1

    # 6b — Submit MAIN requests  agents[(i+1)%n] → deal[i] ─────────────────
    print("\n  6b  Submitting main requests")
    for i in range(n):
        requester = agents[(i + 1) % n]
        owner = agents[i]
        if not requester.get("token"):
            continue
        role = f"agent:{requester['email']}"
        resp = call_api(
            results, role, "POST", base_url, f"/deals/{owner['deal_id']}/requests",
            token=requester["token"],
            body={"note": "Interested in this deal", "offerValue": 95000},
        )
        rdata = extract_data(resp.get("json"))
        req_id = extract_data_id(rdata, ["id", "requestId"])
        requester["main_request_id"] = req_id
        requester["main_deal_id"] = owner["deal_id"]
        requester["main_deal_owner_idx"] = i

    # 6c — Submit WITHDRAW requests  agents[(i+2)%n] → deal[i] ─────────────
    print("\n  6c  Submitting withdraw requests")
    for i in range(n):
        withdrawer = agents[(i + 2) % n]
        owner = agents[i]
        if not withdrawer.get("token"):
            continue
        # Guard: skip if this is the same deal as their main request
        if withdrawer.get("main_deal_id") == owner["deal_id"]:
            continue
        role = f"agent:{withdrawer['email']}"
        resp = call_api(
            results, role, "POST", base_url, f"/deals/{owner['deal_id']}/requests",
            token=withdrawer["token"],
            body={"note": "Will withdraw this request", "offerValue": 80000},
        )
        wdata = extract_data(resp.get("json"))
        withdrawer["withdraw_request_id"] = extract_data_id(wdata, ["id", "requestId"])

    # 6d — Owners accept their main request + list requests ─────────────────
    print("\n  6d  Owners accepting main requests")
    for i in range(n):
        owner = agents[i]
        requester = agents[(i + 1) % n]
        if not owner.get("token") or not requester.get("main_request_id"):
            continue
        deal_id = owner["deal_id"]
        req_id = requester["main_request_id"]
        role = f"agent:{owner['email']}"
        resp = call_api(
            results, role, "PATCH", base_url,
            f"/deals/{deal_id}/requests/{req_id}/status",
            token=owner["token"],
            body={"status": "accepted"},
        )
        if resp.get("ok"):
            requester["accepted_deal_id"] = deal_id
            requester["review_target_company_id"] = owner.get("company_id")

        # owner reads requests list
        call_api(
            results, role, "GET", base_url, f"/deals/{deal_id}/requests",
            token=owner["token"],
        )

    # 6e — Withdrawers retract their requests ───────────────────────────────
    print("\n  6e  Withdrawing requests")
    for ctx in agents:
        if not ctx.get("token") or not ctx.get("withdraw_request_id"):
            continue
        role = f"agent:{ctx['email']}"
        call_api(
            results, role, "DELETE", base_url,
            f"/deals/requests/{ctx['withdraw_request_id']}", token=ctx["token"],
        )

    # 6f — Read-only deal endpoints ─────────────────────────────────────────
    print("\n  6f  Read deal endpoints")
    for ctx in agents:
        if not ctx.get("token"):
            continue
        role = f"agent:{ctx['email']}"
        token = ctx["token"]
        deal_id = ctx.get("deal_id") or 1
        call_api(results, role, "GET", base_url, "/deals", params={"limit": 10}, token=token)
        call_api(results, role, "GET", base_url, f"/deals/{deal_id}", token=token)
        call_api(results, role, "GET", base_url, "/deals/me/deals", token=token)
        call_api(results, role, "GET", base_url, "/deals/me/requests", token=token)
        call_api(
            results, role, "PUT", base_url, f"/deals/{deal_id}", token=token,
            body={"dealDescription": "Updated by simulate_all.py"},
        )


# ══════════════════════════════════════════════════════════════════════════
# PHASE 6g — Archive Deals (called AFTER reviews so accepted_deal_id is still valid)
# ══════════════════════════════════════════════════════════════════════════


def phase6g_archive_deals(results, base_url, agents):
    phase_header("6g", "Archive Deals")
    for ctx in agents:
        if not ctx.get("token"):
            continue
        call_api(
            results, f"agent:{ctx['email']}", "DELETE", base_url,
            f"/deals/{ctx.get('deal_id') or 1}", token=ctx["token"],
        )


# ══════════════════════════════════════════════════════════════════════════
# PHASE 7 — Reviews (Post-Accepted Deal)
# ══════════════════════════════════════════════════════════════════════════


def phase7_reviews(results, base_url, agents):
    phase_header(7, "Reviews (Post-Accepted Deal)")
    for ctx in agents:
        if not ctx.get("token"):
            continue
        target_id = ctx.get("review_target_company_id")
        deal_id = ctx.get("accepted_deal_id")
        if not target_id or not deal_id:
            print(f"  ⚠  {ctx['email']} — no accepted deal to review")
            continue
        role = f"agent:{ctx['email']}"
        call_api(
            results, role, "POST", base_url, f"/companies/{target_id}/reviews",
            token=ctx["token"],
            body={
                "dealId": deal_id,
                "rating": 5,
                "reviewText": "Excellent collaboration. Highly recommended.",
            },
        )
        call_api(
            results, role, "GET", base_url, f"/companies/{target_id}/reviews",
            token=ctx["token"],
        )


# ══════════════════════════════════════════════════════════════════════════
# PHASE 8 — Chat (Company-to-Company Rooms + Messages)
# ══════════════════════════════════════════════════════════════════════════


def phase8_chat(results, base_url, agents):
    phase_header(8, "Chat (Rooms · Messages · Read · Archive)")
    n = len(agents)
    for i, ctx in enumerate(agents):
        if not ctx.get("token"):
            continue
        # Chat with our accepted-deal partner (review target)
        target_company_id = ctx.get("review_target_company_id")
        if not target_company_id:
            # Fallback: adjacent agent
            partner = agents[(i + 1) % n]
            target_company_id = partner.get("company_id") or 1

        role = f"agent:{ctx['email']}"
        token = ctx["token"]

        resp = call_api(
            results, role, "POST", base_url, "/chats", token=token,
            body={"targetCompanyId": target_company_id},
        )
        room_id = extract_data_id(extract_data(resp.get("json"))) or 1
        ctx["room_id"] = room_id

        call_api(results, role, "GET", base_url, "/chats", token=token)
        call_api(results, role, "GET", base_url, f"/chats/{room_id}", token=token)

        for msg_n in range(1, 4):
            call_api(
                results, role, "POST", base_url, f"/chats/{room_id}/messages", token=token,
                body={"messageText": f"Hello from {ctx['email']} — message {msg_n}"},
            )

        call_api(results, role, "GET", base_url, f"/chats/{room_id}/messages", token=token)
        call_api(
            results, role, "POST", base_url, f"/chats/{room_id}/read", token=token,
            body={"messageId": None},
        )
        call_api(results, role, "PATCH", base_url, f"/chats/{room_id}/archive", token=token)


# ══════════════════════════════════════════════════════════════════════════
# PHASE 9 — Advertisements
# ══════════════════════════════════════════════════════════════════════════


def phase9_ads(results, base_url, agents):
    phase_header(9, "Advertisements (CRUD · Analytics · Public)")
    for ctx in agents:
        if not ctx.get("token"):
            continue
        role = f"agent:{ctx['email']}"
        token = ctx["token"]

        resp = call_api(
            results, role, "POST", base_url, "/ads", token=token,
            body={
                "title": f"Ad by {ctx['email']}",
                "content": "Simulate all ad content",
                "targetUrl": "https://example.com",
                "location": "sidebar",
                "type": "banner",
            },
        )
        ad_id = extract_data_id(extract_data(resp.get("json"))) or 1
        ctx["ad_id"] = ad_id

        call_api(results, role, "GET", base_url, "/ads/me", token=token)
        call_api(results, role, "GET", base_url, f"/ads/{ad_id}", token=token)
        call_api(
            results, role, "PUT", base_url, f"/ads/{ad_id}", token=token,
            body={"content": "Updated ad content by simulate_all"},
        )
        call_api(results, role, "GET", base_url, f"/ads/{ad_id}/analytics", token=token)

        # public ad endpoints (also callable authenticated)
        call_api(results, role, "GET", base_url, "/ads/active", token=token)
        call_api(results, role, "GET", base_url, f"/ads/{ad_id}/click", token=token)


# ══════════════════════════════════════════════════════════════════════════
# PHASE 10 — Support (Tickets + Live Chat)
# ══════════════════════════════════════════════════════════════════════════


def phase10_support(results, base_url, agents):
    phase_header(10, "Support (Tickets · Live Chat)")
    for ctx in agents:
        if not ctx.get("token"):
            continue
        role = f"agent:{ctx['email']}"
        token = ctx["token"]

        # tickets
        resp = call_api(
            results, role, "POST", base_url, "/support/tickets", token=token,
            body={
                "subject": f"Support request from {ctx['email']}",
                "message": "I need help with my account configuration.",
                "email": ctx["email"],
                "priority": "medium",
            },
        )
        ticket_id = extract_data_id(extract_data(resp.get("json"))) or 1
        ctx["ticket_id"] = ticket_id

        call_api(results, role, "GET", base_url, "/support/tickets", token=token)
        call_api(results, role, "GET", base_url, f"/support/tickets/{ticket_id}", token=token)
        call_api(results, role, "GET", base_url, "/support/info", token=token)

        # live support chat
        resp = call_api(results, role, "POST", base_url, "/support/chat", token=token)
        support_chat_id = extract_data_id(extract_data(resp.get("json"))) or 1
        ctx["support_chat_id"] = support_chat_id

        call_api(results, role, "GET", base_url, "/support/chat", token=token)
        call_api(
            results, role, "POST", base_url, f"/support/chat/{support_chat_id}/messages",
            token=token, body={"message": "Hello, I need assistance please."},
        )
        call_api(
            results, role, "GET", base_url, f"/support/chat/{support_chat_id}/messages",
            token=token,
        )


# ══════════════════════════════════════════════════════════════════════════
# PHASE 11 — Notifications
# ══════════════════════════════════════════════════════════════════════════


def phase11_notifications(results, base_url, agents):
    phase_header(11, "Notifications (List · Mark · Delete)")
    for ctx in agents:
        if not ctx.get("token"):
            continue
        role = f"agent:{ctx['email']}"
        token = ctx["token"]

        resp = call_api(results, role, "GET", base_url, "/notifications", token=token)
        notif_data = extract_data(resp.get("json"))
        notif_id = None
        if isinstance(notif_data, dict) and isinstance(notif_data.get("items"), list):
            items = notif_data["items"]
            if items and isinstance(items[0], dict):
                notif_id = items[0].get("id")
        notif_id = notif_id or 1

        call_api(results, role, "PUT", base_url, f"/notifications/{notif_id}/read", token=token)
        call_api(results, role, "PUT", base_url, "/notifications/read-all", token=token)
        call_api(results, role, "DELETE", base_url, f"/notifications/{notif_id}", token=token)
        call_api(results, role, "DELETE", base_url, "/notifications/read", token=token)


# ══════════════════════════════════════════════════════════════════════════
# PHASE 12 — User Profile, Password, Profile Image, Devices
# ══════════════════════════════════════════════════════════════════════════


def phase12_user_profile(results, base_url, agents):
    phase_header(12, "User Profile · Password · Profile Image · Devices")
    for ctx in agents:
        if not ctx.get("token"):
            continue
        role = f"agent:{ctx['email']}"
        token = ctx["token"]
        file_id = ctx.get("file_id") or 1

        call_api(results, role, "GET", base_url, "/users/me", token=token)
        call_api(
            results, role, "PUT", base_url, "/users/me", token=token,
            body={"jobTitle": "QA Agent (simulate_all)"},
        )
        # Intentionally wrong password → expect 400/401
        call_api(
            results, role, "PUT", base_url, "/users/me/password", token=token,
            body={"currentPassword": "WrongPassword999!", "newPassword": "Password123!"},
        )
        call_api(
            results, role, "PUT", base_url, "/users/me/profile-image", token=token,
            body={"profileImageFileId": file_id},
        )
        call_api(results, role, "DELETE", base_url, "/users/me/profile-image", token=token)
        call_api(results, role, "GET", base_url, "/users/me/devices", token=token)
        call_api(
            results, role, "POST", base_url, "/users/me/devices", token=token,
            body={"token": f"simulate-device-{ctx['email']}", "deviceType": "web"},
        )
        call_api(
            results, role, "DELETE", base_url, "/users/me/devices", token=token,
            body={"token": f"simulate-device-{ctx['email']}"},
        )


# ══════════════════════════════════════════════════════════════════════════
# PHASE 13 — Auth Special (Logout)
# ══════════════════════════════════════════════════════════════════════════


def phase13_auth_special(results, base_url, agents):
    phase_header(13, "Auth Special — Logout")
    for ctx in agents:
        if not ctx.get("token"):
            continue
        role = f"agent:{ctx['email']}"
        call_api(results, role, "POST", base_url, "/auth/logout", token=ctx["token"])
        ctx["token"] = None  # token is now invalid


# ══════════════════════════════════════════════════════════════════════════
# PHASE 14 — Admin Endpoints (Full Coverage)
# ══════════════════════════════════════════════════════════════════════════


def phase14_admin(results, base_url, admin_token, agents):
    phase_header(14, "Admin Endpoints (Full Coverage)")
    if not admin_token:
        print("  ⚠  No admin token — skipping admin phase")
        return

    # Use agent[0] as reference for IDs
    ref = agents[0] if agents else {}
    company_id = ref.get("company_id") or 1
    deal_id = ref.get("deal_id") or 1
    ad_id = ref.get("ad_id") or 1
    ticket_id = ref.get("ticket_id") or 1
    support_chat_id = ref.get("support_chat_id") or 1
    agent_user_id = ref.get("user_id") or 1
    file_id = ref.get("file_id") or 1
    agent_email = ref.get("email") or (agents[1]["email"] if len(agents) > 1 else "agent1@indeal.test")

    role = "admin"

    # ── dashboard ─────────────────────────────────────────────────────────
    call_api(results, role, "GET", base_url, "/admin/dashboard/cards", token=admin_token)

    # ── company management ────────────────────────────────────────────────
    call_api(results, role, "GET", base_url, "/admin/companies", token=admin_token)
    call_api(results, role, "GET", base_url, "/admin/companies/pending", token=admin_token)
    call_api(results, role, "GET", base_url, f"/admin/companies/{company_id}", token=admin_token)
    call_api(
        results, role, "PUT", base_url, f"/admin/companies/{company_id}", token=admin_token,
        body={"description": "Admin updated via simulate_all"},
    )
    call_api(
        results, role, "PUT", base_url, f"/admin/companies/{company_id}/summary", token=admin_token,
        body={"summary": "Admin summary update via simulate_all"},
    )
    call_api(
        results, role, "PATCH", base_url, f"/admin/companies/{company_id}/status", token=admin_token,
        body={"status": "active"},
    )
    call_api(
        results, role, "POST", base_url, f"/admin/companies/{company_id}/approve", token=admin_token
    )
    call_api(
        results, role, "POST", base_url, f"/admin/companies/{company_id}/reject", token=admin_token
    )
    call_api(
        results, role, "POST", base_url, f"/admin/companies/{company_id}/agent", token=admin_token,
        body={"agentId": agent_user_id},
    )
    call_api(
        results, role, "PATCH", base_url, f"/admin/agents/{agent_user_id}/email", token=admin_token,
        body={"email": agent_email},
    )
    call_api(
        results, role, "GET", base_url, f"/admin/companies/{company_id}/reviews", token=admin_token
    )

    # ── admin gallery ─────────────────────────────────────────────────────
    call_api(
        results, role, "GET", base_url, f"/admin/companies/{company_id}/gallery", token=admin_token
    )
    resp = call_api(
        results, role, "POST", base_url, f"/admin/companies/{company_id}/gallery", token=admin_token,
        body={"imageFileId": file_id, "description": "Admin gallery item (simulate_all)"},
    )
    admin_gallery_id = extract_data_id(extract_data(resp.get("json"))) or 1
    call_api(
        results, role, "PUT", base_url,
        f"/admin/companies/{company_id}/gallery/{admin_gallery_id}", token=admin_token,
        body={"description": "Admin gallery item updated"},
    )
    call_api(
        results, role, "DELETE", base_url,
        f"/admin/companies/{company_id}/gallery/{admin_gallery_id}", token=admin_token,
    )

    # ── admin documents ───────────────────────────────────────────────────
    call_api(
        results, role, "GET", base_url, f"/admin/companies/{company_id}/documents",
        token=admin_token,
    )
    resp = call_api(
        results, role, "POST", base_url, f"/admin/companies/{company_id}/documents",
        token=admin_token,
        body={"fileId": file_id, "description": "Admin doc (simulate_all)"},
    )
    admin_doc_id = extract_data_id(extract_data(resp.get("json"))) or 1
    call_api(
        results, role, "PUT", base_url,
        f"/admin/companies/{company_id}/documents/{admin_doc_id}", token=admin_token,
        body={"description": "Admin doc updated"},
    )
    call_api(
        results, role, "DELETE", base_url,
        f"/admin/companies/{company_id}/documents/{admin_doc_id}", token=admin_token,
    )

    # ── admin registration documents ──────────────────────────────────────
    resp_reg = call_api(
        results, role, "GET", base_url,
        f"/admin/companies/{company_id}/registration-documents", token=admin_token,
    )
    reg_docs = extract_list(resp_reg.get("json"))
    admin_reg_doc_id = None
    if reg_docs and isinstance(reg_docs[0], dict):
        admin_reg_doc_id = reg_docs[0].get("id")
    if admin_reg_doc_id:
        call_api(
            results, role, "PUT", base_url,
            f"/admin/companies/{company_id}/registration-documents/{admin_reg_doc_id}",
            token=admin_token, body={"description": "Admin reg doc updated"},
        )
        call_api(
            results, role, "DELETE", base_url,
            f"/admin/companies/{company_id}/registration-documents/{admin_reg_doc_id}",
            token=admin_token,
        )

    # ── admin contributions ───────────────────────────────────────────────
    call_api(
        results, role, "GET", base_url, f"/admin/companies/{company_id}/contributions",
        token=admin_token,
    )
    resp = call_api(
        results, role, "POST", base_url, f"/admin/companies/{company_id}/contributions",
        token=admin_token,
        body={
            "type": "project",
            "title": "Admin contribution (simulate_all)",
            "description": "Created by admin via simulate_all",
            "mediaType": "url",
            "mediaUrl": "https://example.com/admin-contrib",
        },
    )
    admin_contrib_id = extract_data_id(extract_data(resp.get("json"))) or 1
    call_api(
        results, role, "PUT", base_url,
        f"/admin/companies/{company_id}/contributions/{admin_contrib_id}", token=admin_token,
        body={"description": "Admin contribution updated"},
    )
    call_api(
        results, role, "DELETE", base_url,
        f"/admin/companies/{company_id}/contributions/{admin_contrib_id}", token=admin_token,
    )

    # ── pending updates ───────────────────────────────────────────────────
    pending_resp = call_api(
        results, role, "GET", base_url, "/admin/companies/pending-updates", token=admin_token
    )
    pending_list = extract_list(pending_resp.get("json"))
    pending_id = None
    if pending_list and isinstance(pending_list[0], dict):
        pending_id = pending_list[0].get("id")
    pending_id = pending_id or 1

    call_api(
        results, role, "GET", base_url, f"/admin/companies/pending-updates/{pending_id}",
        token=admin_token,
    )
    call_api(
        results, role, "POST", base_url,
        f"/admin/companies/pending-updates/{pending_id}/approve", token=admin_token,
    )
    call_api(
        results, role, "POST", base_url,
        f"/admin/companies/pending-updates/{pending_id}/reject", token=admin_token,
        body={"reason": "Rejected by simulate_all test run"},
    )

    # ── deals ─────────────────────────────────────────────────────────────
    call_api(results, role, "GET", base_url, "/admin/deals", token=admin_token)
    call_api(results, role, "GET", base_url, f"/admin/deals/{deal_id}", token=admin_token)
    call_api(
        results, role, "PATCH", base_url, f"/admin/deals/{deal_id}/status", token=admin_token,
        body={"status": "open"},
    )

    # ── ads ───────────────────────────────────────────────────────────────
    call_api(results, role, "GET", base_url, "/admin/ads", token=admin_token)
    call_api(results, role, "GET", base_url, f"/admin/ads/{ad_id}", token=admin_token)
    call_api(
        results, role, "PATCH", base_url, f"/admin/ads/{ad_id}/status", token=admin_token,
        body={"status": "active"},
    )

    # ── tickets ───────────────────────────────────────────────────────────
    call_api(results, role, "GET", base_url, "/admin/tickets", token=admin_token)
    call_api(results, role, "GET", base_url, f"/admin/tickets/{ticket_id}", token=admin_token)
    call_api(
        results, role, "PATCH", base_url, f"/admin/tickets/{ticket_id}", token=admin_token,
        body={"status": "in_progress"},
    )
    call_api(
        results, role, "POST", base_url, f"/admin/tickets/{ticket_id}/responses", token=admin_token,
        body={"message": "Admin reply via simulate_all"},
    )

    # ── support chats ─────────────────────────────────────────────────────
    call_api(results, role, "GET", base_url, "/admin/support/chats", token=admin_token)
    call_api(results, role, "GET", base_url, "/admin/support/chats/waiting", token=admin_token)
    call_api(
        results, role, "GET", base_url, f"/admin/support/chats/{support_chat_id}", token=admin_token
    )
    call_api(
        results, role, "POST", base_url, f"/admin/support/chats/{support_chat_id}/assign",
        token=admin_token,
    )
    call_api(
        results, role, "POST", base_url, f"/admin/support/chats/{support_chat_id}/close",
        token=admin_token,
    )

    # ── ad cleanup (delete after admin has operated on them) ──────────────
    for ctx in agents:
        if ctx.get("token") and ctx.get("ad_id"):
            call_api(
                results, f"agent:{ctx['email']}", "DELETE", base_url,
                f"/ads/{ctx['ad_id']}", token=ctx["token"],
            )


# ══════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════


def main():
    print("=" * 64)
    print("  inDeal — simulate_all.py")
    print("  4 agents + admin · all ~145+ endpoints · 15 phases")
    print("=" * 64)

    env = load_env()
    base_url = env.get("API_BASE_URL", "http://localhost:3000/api/v1").rstrip("/")
    print(f"\nBase URL  : {base_url}")

    admin_email = env.get("SEED_ADMIN_EMAIL", "admin@indeal.local")
    admin_password = env.get("SEED_ADMIN_PASSWORD", "Password123!")
    agent_password = env.get("SEED_TEST_PASSWORD", "Password123!")
    agent_prefix = env.get("SEED_TEST_AGENT_PREFIX", "agent")
    agent_domain = env.get("SEED_TEST_EMAIL_DOMAIN", "indeal.test")

    seeded_emails = [f"{agent_prefix}{i}@{agent_domain}" for i in range(1, 5)]
    print(f"Agents    : {', '.join(seeded_emails)}")
    print(f"Admin     : {admin_email}")

    results = []

    admin_token = phase0_admin_login(results, base_url, admin_email, admin_password)
    agent_emails = phase1_resolve_agents(results, base_url, admin_token, seeded_emails)
    agents = phase2_agent_logins(results, base_url, agent_emails, agent_password)

    phase3_unknown_user(results, base_url, admin_email, admin_password)
    phase4_file_setup(results, base_url, agents)
    phase5_company_setup(results, base_url, agents)
    phase6_deals_flow(results, base_url, agents)
    phase7_reviews(results, base_url, agents)
    phase6g_archive_deals(results, base_url, agents)  # after reviews so deal IDs remain valid
    phase8_chat(results, base_url, agents)
    phase9_ads(results, base_url, agents)
    phase10_support(results, base_url, agents)
    phase11_notifications(results, base_url, agents)
    phase12_user_profile(results, base_url, agents)
    phase13_auth_special(results, base_url, agents)
    phase14_admin(results, base_url, admin_token, agents)

    # ── save results ───────────────────────────────────────────────────────
    print(f"\n{'═' * 64}")
    print("  SAVING RESULTS")
    print(f"{'═' * 64}")
    ensure_output_dir()

    output = {"generatedAt": now_iso(), "results": results}
    with open(OUTPUT_FILE, "w", encoding="utf-8") as fh:
        json.dump(output, fh, ensure_ascii=False, indent=2)
    print(f"\n  → {OUTPUT_FILE}")

    # per-status-family files
    families: dict = {}
    for entry in results:
        fam = status_family(entry.get("status_code"))
        families.setdefault(fam, []).append(entry)

    for fam in sorted(families.keys()):
        items = families[fam]
        fam_file = os.path.join(OUTPUT_DIR, f"simulate_all_results_{fam}.json")
        with open(fam_file, "w", encoding="utf-8") as fh:
            json.dump({"generatedAt": now_iso(), "results": items}, fh, ensure_ascii=False, indent=2)
        print(f"  → {fam_file}  ({len(items)} entries)")

    # ── summary ────────────────────────────────────────────────────────────
    total = len(results)
    ok_count = sum(1 for r in results if r["ok"])
    fail_count = total - ok_count

    print(f"\n{'═' * 64}")
    print(f"  COMPLETE — {total} calls | ✓ {ok_count} ok | ✗ {fail_count} non-2xx")
    print(f"{'═' * 64}")
    print("\n  Status breakdown:")
    for fam in sorted(families.keys()):
        count = len(families[fam])
        bar = "█" * min(count, 50)
        print(f"    {fam:<14} {count:>5}  {bar}")

    print()


if __name__ == "__main__":
    main()
