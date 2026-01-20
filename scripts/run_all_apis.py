#!/usr/bin/env python3
"""
Run all API endpoints as:
- unknown (no auth)
- 3 agents (seeded)
- admin (seeded)
Saves all responses to scripts/output/all_api_results.json
"""

import json
import os
import time
from datetime import datetime, timezone
from urllib import request, parse, error

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "scripts", "output")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "all_api_results.json")


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
    req = request.Request(url, data=data, headers=headers, method=method)
    started = time.time()
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            text = raw.decode("utf-8", errors="replace")
            duration_ms = int((time.time() - started) * 1000)
            parsed = None
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
    except error.HTTPError as exc:
        text = exc.read().decode("utf-8", errors="replace")
        duration_ms = int((time.time() - started) * 1000)
        parsed = None
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


def call_api(results, role, method, base_url, path, token=None, params=None, body=None):
    url = base_url + path
    if params:
        url += "?" + parse.urlencode(params, doseq=True)
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    resp = request_json(method, url, headers=headers, body=body)
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
        for key in ("items", "companies", "results"):
            if isinstance(data.get(key), list):
                return data.get(key)
    return []


def login_with_fallback(results, base_url, email, password):
    candidates = [email, f"updated_{email}"]
    for candidate in candidates:
        resp = call_api(
            results,
            f"agent:{candidate}",
            "POST",
            base_url,
            "/auth/login",
            body={"email": candidate, "password": password},
        )
        token = extract_token(resp.get("json"))
        if token:
            return {"email": candidate, "token": token}
    return {"email": email, "token": None}


def resolve_agent_emails(results, base_url, admin_token, count):
    if not admin_token:
        return []
    resp = call_api(results, "admin", "GET", base_url, "/admin/companies", token=admin_token)
    companies = extract_list(resp.get("json"))
    ids = [c.get("id") for c in companies if isinstance(c, dict) and c.get("id")][:count]
    emails = []
    for company_id in ids:
        detail = call_api(
            results,
            "admin",
            "GET",
            base_url,
            f"/admin/companies/{company_id}",
            token=admin_token,
        )
        detail_data = extract_data(detail.get("json"))
        if isinstance(detail_data, dict):
            agent = detail_data.get("agent")
            if isinstance(agent, dict) and agent.get("email"):
                emails.append(agent.get("email"))
    return emails


def ensure_output_dir():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR, exist_ok=True)


def status_family(status_code):
    if isinstance(status_code, int):
        return f"{status_code // 100}xxV10"
    return "unknown"


def main():
    env = load_env()
    base_url = env.get("API_BASE_URL", "http://localhost:3000/api/v1").rstrip("/")

    admin_email = env.get("SEED_ADMIN_EMAIL", "admin@indeal.local")
    admin_password = env.get("SEED_ADMIN_PASSWORD", "Password123!")
    agent_password = env.get("SEED_TEST_PASSWORD", "Password123!")
    agent_prefix = env.get("SEED_TEST_AGENT_PREFIX", "agent")
    agent_domain = env.get("SEED_TEST_EMAIL_DOMAIN", "indeal.test")

    seeded_agents = [f"{agent_prefix}{i}@{agent_domain}" for i in range(1, 8)]

    results = []

    # Login admin early to resolve agent emails if needed.
    admin_resp = call_api(
        results,
        "admin",
        "POST",
        base_url,
        "/auth/admin/login",
        body={"email": admin_email, "password": admin_password},
    )
    admin_token = extract_token(admin_resp.get("json"))

    agents = resolve_agent_emails(results, base_url, admin_token, 7) or seeded_agents
    unknown_email = f"unknown_{int(time.time())}@example.com"

    # Unknown user: call public endpoints (and attempt protected/admin too).
    def call_unknown():
        role = "unknown"
        call_api(results, role, "GET", base_url, "/health")
        call_api(results, role, "GET", base_url, "/system/stats")
        call_api(results, role, "GET", base_url, "/system/config")
        call_api(
            results,
            role,
            "POST",
            base_url,
            "/auth/register/upload-url",
            body={"fileName": "doc.pdf", "fileType": "application/pdf", "fileSize": 1024},
        )
        call_api(
            results,
            role,
            "POST",
            base_url,
            "/auth/register",
            body={
                "user": {
                    "username": f"temp_{int(time.time())}",
                    "email": unknown_email,
                    "password": "Password123!",
                    "firstName": "Unknown",
                    "lastName": "User",
                },
                "company": {
                    "name": "Unknown Co",
                    "description": "Temporary",
                },
            },
        )
        call_api(
            results,
            role,
            "POST",
            base_url,
            "/auth/login",
            body={"email": unknown_email, "password": "Password123!"},
        )
        call_api(
            results,
            role,
            "POST",
            base_url,
            "/auth/admin/login",
            body={"email": admin_email, "password": admin_password},
        )
        call_api(results, role, "POST", base_url, "/auth/forgot-password", body={"email": admin_email})
        call_api(
            results,
            role,
            "POST",
            base_url,
            "/auth/resend-forgot-password-otp",
            body={"email": admin_email},
        )
        call_api(
            results,
            role,
            "POST",
            base_url,
            "/auth/verify-otp",
            body={"email": admin_email, "otp": "000000"},
        )
        call_api(
            results,
            role,
            "POST",
            base_url,
            "/auth/reset-password",
            body={
                "email": admin_email,
                "otp": "000000",
                "password": "Password123!",
                "confirmPassword": "Password123!",
            },
        )
        call_api(
            results,
            role,
            "POST",
            base_url,
            "/auth/resend-verification",
            body={"email": admin_email},
        )
        call_api(
            results,
            role,
            "GET",
            base_url,
            "/auth/verify-email",
            params={"email": admin_email, "token": "invalid"},
        )
        call_api(results, role, "GET", base_url, "/companies/search", params={"limit": 2})
        call_api(results, role, "GET", base_url, "/companies/1")
        call_api(results, role, "GET", base_url, "/companies/1/gallery")
        call_api(results, role, "GET", base_url, "/companies/1/reviews")
        call_api(results, role, "GET", base_url, "/deals", params={"limit": 2})
        call_api(results, role, "GET", base_url, "/deals/1")
        call_api(results, role, "GET", base_url, "/ads/active")
        call_api(results, role, "GET", base_url, "/ads/1/click")
        call_api(results, role, "GET", base_url, "/support/info")
        call_api(
            results,
            role,
            "POST",
            base_url,
            "/support/tickets",
            body={
                "subject": "Guest ticket",
                "message": "This is a guest ticket.",
                "email": "guest@indeal.test",
                "priority": "low",
            },
        )

        # Attempt protected/admin endpoints without auth
        protected_paths = [
            ("POST", "/files/upload-url"),
            ("GET", "/users/me"),
            ("PUT", "/users/me"),
            ("PUT", "/users/me/password"),
            ("PUT", "/users/me/profile-image"),
            ("GET", "/users/me/devices"),
            ("POST", "/users/me/devices"),
            ("DELETE", "/users/me/devices"),
            ("GET", "/companies/me"),
            ("PUT", "/companies/me"),
            ("POST", "/companies/me/resend-for-review"),
            ("GET", "/companies/me/gallery"),
            ("POST", "/companies/me/gallery"),
            ("PUT", "/companies/me/gallery/1"),
            ("DELETE", "/companies/me/gallery/1"),
            ("GET", "/companies/me/documents"),
            ("POST", "/companies/me/documents"),
            ("PUT", "/companies/me/documents/1"),
            ("DELETE", "/companies/me/documents/1"),
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
            ("GET", "/admin/companies/1/contributions"),
            ("POST", "/admin/companies/1/contributions"),
            ("PUT", "/admin/companies/1/contributions/1"),
            ("DELETE", "/admin/companies/1/contributions/1"),
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
            ("GET", "/admin/companies/pending-updates"),
            ("GET", "/admin/companies/pending-updates/1"),
            ("POST", "/admin/companies/pending-updates/1/approve"),
            ("POST", "/admin/companies/pending-updates/1/reject"),
            ("GET", "/admin/support/chats"),
            ("GET", "/admin/support/chats/waiting"),
            ("GET", "/admin/support/chats/1"),
            ("POST", "/admin/support/chats/1/assign"),
            ("POST", "/admin/support/chats/1/close"),
        ]

        for method, path in protected_paths:
            call_api(results, role, method, base_url, path)

    # Login agents
    agent_contexts = []
    for email in agents:
        ctx = login_with_fallback(results, base_url, email, agent_password)
        if ctx.get("token"):
            agent_contexts.append(ctx)

    # Fetch each agent's company
    for ctx in agent_contexts:
        resp = call_api(results, f"agent:{ctx['email']}", "GET", base_url, "/companies/me", token=ctx["token"])
        data = extract_data(resp.get("json"))
        if isinstance(data, dict) and "id" in data:
            ctx["company_id"] = data.get("id")
        resp_user = call_api(results, f"agent:{ctx['email']}", "GET", base_url, "/users/me", token=ctx["token"])
        user_data = extract_data(resp_user.get("json"))
        if isinstance(user_data, dict) and "id" in user_data:
            ctx["user_id"] = user_data.get("id")

    # Pre-create a deal per agent
    for ctx in agent_contexts:
        resp = call_api(
            results,
            f"agent:{ctx['email']}",
            "POST",
            base_url,
            "/deals",
            token=ctx["token"],
            body={
                "dealName": f"Seed Deal {ctx['email']}",
                "dealDescription": "Seeded for API tests",
                "dealValue": 1000,
                "dealType": "rfq",
            },
        )
        data = extract_data(resp.get("json"))
        ctx["deal_id"] = extract_data_id(data)

    # Create requests for acceptance and withdrawal
    deal_requests_accept = []
    deal_requests_withdraw = []
    count = len(agent_contexts)
    if count > 1:
        for idx, ctx in enumerate(agent_contexts):
            accept_target = agent_contexts[(idx + 1) % count]
            withdraw_target = agent_contexts[(idx + 2) % count] if count > 2 else accept_target

            # Request to be accepted
            accept_deal_id = accept_target.get("deal_id") or 1
            accept_resp = call_api(
                results,
                f"agent:{ctx['email']}",
                "POST",
                base_url,
                f"/deals/{accept_deal_id}/requests",
                token=ctx["token"],
                body={"note": "Interested", "offerValue": 900},
            )
            accept_data = extract_data(accept_resp.get("json"))
            accept_request_id = extract_data_id(accept_data, ["id", "requestId"])
            deal_requests_accept.append(
                {
                    "owner": accept_target,
                    "requester": ctx,
                    "deal_id": accept_deal_id,
                    "request_id": accept_request_id,
                }
            )

            # Request to be withdrawn
            withdraw_deal_id = withdraw_target.get("deal_id") or 1
            withdraw_resp = call_api(
                results,
                f"agent:{ctx['email']}",
                "POST",
                base_url,
                f"/deals/{withdraw_deal_id}/requests",
                token=ctx["token"],
                body={"note": "Will withdraw", "offerValue": 800},
            )
            withdraw_data = extract_data(withdraw_resp.get("json"))
            withdraw_request_id = extract_data_id(withdraw_data, ["id", "requestId"])
            deal_requests_withdraw.append(
                {
                    "requester": ctx,
                    "deal_id": withdraw_deal_id,
                    "request_id": withdraw_request_id,
                }
            )

    # Accept requests (owner flow)
    for item in deal_requests_accept:
        owner = item.get("owner")
        requester = item.get("requester")
        if not owner or not requester:
            continue
        if not owner.get("token") or not item.get("request_id"):
            continue
        resp = call_api(
            results,
            f"agent:{owner['email']}",
            "PATCH",
            base_url,
            f"/deals/{item['deal_id']}/requests/{item['request_id']}/status",
            token=owner["token"],
            body={"status": "accepted"},
        )
        if resp.get("ok"):
            requester["accepted_deal_id"] = item["deal_id"]
            requester["review_target_company_id"] = owner.get("company_id")

    # Store withdrawal request ids
    for item in deal_requests_withdraw:
        requester = item.get("requester")
        if requester and item.get("request_id"):
            requester["withdraw_request_id"] = item["request_id"]

    # Main agent flow
    for idx, ctx in enumerate(agent_contexts):
        role = f"agent:{ctx['email']}"
        token = ctx["token"]

        # Files
        resp = call_api(
            results,
            role,
            "POST",
            base_url,
            "/files/upload-url",
            token=token,
            body={"fileName": "seed.png", "fileType": "image/png", "fileSize": 2048},
        )
        file_data = extract_data(resp.get("json"))
        file_id = None
        if isinstance(file_data, dict) and isinstance(file_data.get("file"), dict):
            file_id = file_data["file"].get("id")
        ctx["file_id"] = file_id or 1

        # Company update
        call_api(
            results,
            role,
            "PUT",
            base_url,
            "/companies/me",
            token=token,
            body={"description": "Updated by API runner"},
        )
        call_api(results, role, "POST", base_url, "/companies/me/resend-for-review", token=token)

        # Gallery
        resp = call_api(
            results,
            role,
            "POST",
            base_url,
            "/companies/me/gallery",
            token=token,
            body={"imageFileId": ctx["file_id"], "description": "Gallery item"},
        )
        gallery_data = extract_data(resp.get("json"))
        ctx["gallery_id"] = extract_data_id(gallery_data) or 1
        call_api(
            results,
            role,
            "PUT",
            base_url,
            f"/companies/me/gallery/{ctx['gallery_id']}",
            token=token,
            body={"description": "Updated gallery item"},
        )
        call_api(results, role, "GET", base_url, "/companies/me/gallery", token=token)
        call_api(
            results,
            role,
            "DELETE",
            base_url,
            f"/companies/me/gallery/{ctx['gallery_id']}",
            token=token,
        )

        # Documents
        resp = call_api(
            results,
            role,
            "POST",
            base_url,
            "/companies/me/documents",
            token=token,
            body={"fileId": ctx["file_id"], "description": "Doc"},
        )
        doc_data = extract_data(resp.get("json"))
        ctx["document_id"] = extract_data_id(doc_data) or 1
        call_api(
            results,
            role,
            "PUT",
            base_url,
            f"/companies/me/documents/{ctx['document_id']}",
            token=token,
            body={"description": "Updated doc"},
        )
        call_api(results, role, "GET", base_url, "/companies/me/documents", token=token)
        call_api(
            results,
            role,
            "DELETE",
            base_url,
            f"/companies/me/documents/{ctx['document_id']}",
            token=token,
        )

        # Contributions
        resp = call_api(
            results,
            role,
            "POST",
            base_url,
            "/companies/me/contributions",
            token=token,
            body={
                "type": "project",
                "title": "Seed Contribution",
                "description": "Contribution from API runner",
                "mediaType": "url",
                "mediaUrl": "https://example.com/media",
            },
        )
        contrib_data = extract_data(resp.get("json"))
        ctx["contribution_id"] = extract_data_id(contrib_data) or 1
        call_api(
            results,
            role,
            "PUT",
            base_url,
            f"/companies/me/contributions/{ctx['contribution_id']}",
            token=token,
            body={"description": "Updated contribution"},
        )
        call_api(results, role, "GET", base_url, "/companies/me/contributions", token=token)

        # Contribution Media
        resp = call_api(
            results,
            role,
            "POST",
            base_url,
            f"/companies/me/contributions/{ctx['contribution_id']}/media",
            token=token,
            body={"mediaType": "url", "mediaUrl": "https://example.com/asset", "caption": "Asset"},
        )
        media_data = extract_data(resp.get("json"))
        ctx["media_id"] = extract_data_id(media_data) or 1
        call_api(
            results,
            role,
            "PUT",
            base_url,
            f"/companies/me/contributions/{ctx['contribution_id']}/media/{ctx['media_id']}",
            token=token,
            body={"caption": "Updated caption"},
        )
        call_api(
            results,
            role,
            "GET",
            base_url,
            f"/companies/me/contributions/{ctx['contribution_id']}/media",
            token=token,
        )
        call_api(
            results,
            role,
            "PUT",
            base_url,
            f"/companies/me/contributions/{ctx['contribution_id']}/media/reorder",
            token=token,
            body={"orderedIds": [ctx["media_id"]]},
        )
        call_api(
            results,
            role,
            "DELETE",
            base_url,
            f"/companies/me/contributions/{ctx['contribution_id']}/media/{ctx['media_id']}",
            token=token,
        )

        call_api(
            results,
            role,
            "DELETE",
            base_url,
            f"/companies/me/contributions/{ctx['contribution_id']}",
            token=token,
        )

        # Public company endpoints with auth
        company_id = ctx.get("company_id") or 1
        call_api(results, role, "GET", base_url, f"/companies/{company_id}", token=token)
        call_api(results, role, "GET", base_url, f"/companies/{company_id}/gallery", token=token)
        call_api(results, role, "GET", base_url, f"/companies/{company_id}/reviews", token=token)
        review_company_id = ctx.get("review_target_company_id") or company_id
        review_deal_id = ctx.get("accepted_deal_id") or ctx.get("deal_id") or 1
        call_api(
            results,
            role,
            "POST",
            base_url,
            f"/companies/{review_company_id}/reviews",
            token=token,
            body={"dealId": review_deal_id, "rating": 5, "reviewText": "Great"},
        )

        # Deals
        deal_id = ctx.get("deal_id") or 1
        call_api(results, role, "GET", base_url, "/deals", params={"limit": 2}, token=token)
        call_api(results, role, "GET", base_url, f"/deals/{deal_id}", token=token)
        call_api(results, role, "GET", base_url, "/deals/me/deals", token=token)
        call_api(
            results,
            role,
            "PUT",
            base_url,
            f"/deals/{deal_id}",
            token=token,
            body={"dealDescription": "Updated by API runner"},
        )
        call_api(results, role, "GET", base_url, "/deals/me/requests", token=token)
        call_api(results, role, "GET", base_url, f"/deals/{deal_id}/requests", token=token)

        # Withdraw my request
        call_api(
            results,
            role,
            "DELETE",
            base_url,
            f"/deals/requests/{ctx.get('withdraw_request_id') or 1}",
            token=token,
        )

        # Archive deal
        call_api(results, role, "DELETE", base_url, f"/deals/{deal_id}", token=token)

        # Chat
        target_company = ctx.get("review_target_company_id")
        if not target_company:
            for other in agent_contexts:
                if other is ctx:
                    continue
                if other.get("company_id"):
                    target_company = other.get("company_id")
                    break
        target_company = target_company or 1
        resp = call_api(
            results,
            role,
            "POST",
            base_url,
            "/chats",
            token=token,
            body={"targetCompanyId": target_company},
        )
        room_data = extract_data(resp.get("json"))
        ctx["room_id"] = extract_data_id(room_data) or 1
        call_api(results, role, "GET", base_url, "/chats", token=token)
        call_api(results, role, "GET", base_url, f"/chats/{ctx['room_id']}", token=token)
        call_api(
            results,
            role,
            "POST",
            base_url,
            f"/chats/{ctx['room_id']}/messages",
            token=token,
            body={"messageText": "Hello from API runner"},
        )
        call_api(results, role, "GET", base_url, f"/chats/{ctx['room_id']}/messages", token=token)
        call_api(results, role, "PATCH", base_url, f"/chats/{ctx['room_id']}/archive", token=token)

        # Ads
        resp = call_api(
            results,
            role,
            "POST",
            base_url,
            "/ads",
            token=token,
            body={
                "title": "Seed Ad",
                "content": "Ad content",
                "targetUrl": "https://example.com",
                "location": "sidebar",
                "type": "banner",
            },
        )
        ad_data = extract_data(resp.get("json"))
        ctx["ad_id"] = extract_data_id(ad_data) or 1
        call_api(results, role, "GET", base_url, "/ads/me", token=token)
        call_api(results, role, "GET", base_url, f"/ads/{ctx['ad_id']}", token=token)
        call_api(
            results,
            role,
            "PUT",
            base_url,
            f"/ads/{ctx['ad_id']}",
            token=token,
            body={"content": "Updated ad"},
        )
        call_api(results, role, "GET", base_url, f"/ads/{ctx['ad_id']}/analytics", token=token)
        call_api(results, role, "DELETE", base_url, f"/ads/{ctx['ad_id']}", token=token)

        # Public ads endpoints with auth
        call_api(results, role, "GET", base_url, "/ads/active", token=token)
        call_api(results, role, "GET", base_url, f"/ads/{ctx['ad_id']}/click", token=token)

        # Support
        resp = call_api(
            results,
            role,
            "POST",
            base_url,
            "/support/tickets",
            token=token,
            body={
                "subject": "Agent ticket",
                "message": "Ticket from agent",
                "email": ctx["email"],
                "priority": "medium",
            },
        )
        ticket_data = extract_data(resp.get("json"))
        ctx["ticket_id"] = extract_data_id(ticket_data) or 1
        call_api(results, role, "GET", base_url, "/support/tickets", token=token)
        call_api(results, role, "GET", base_url, f"/support/tickets/{ctx['ticket_id']}", token=token)
        call_api(results, role, "GET", base_url, "/support/info", token=token)

        # Support chat
        resp = call_api(results, role, "POST", base_url, "/support/chat", token=token)
        chat_data = extract_data(resp.get("json"))
        ctx["support_chat_id"] = extract_data_id(chat_data) or 1
        call_api(results, role, "GET", base_url, "/support/chat", token=token)
        call_api(
            results,
            role,
            "POST",
            base_url,
            f"/support/chat/{ctx['support_chat_id']}/messages",
            token=token,
            body={"message": "Need help"},
        )
        call_api(
            results,
            role,
            "GET",
            base_url,
            f"/support/chat/{ctx['support_chat_id']}/messages",
            token=token,
        )

        # Notifications
        resp = call_api(results, role, "GET", base_url, "/notifications", token=token)
        notif_data = extract_data(resp.get("json"))
        notif_id = None
        if isinstance(notif_data, dict) and isinstance(notif_data.get("items"), list):
            if notif_data["items"]:
                notif_id = notif_data["items"][0].get("id")
        call_api(results, role, "PUT", base_url, "/notifications/read-all", token=token)
        call_api(results, role, "DELETE", base_url, "/notifications/read", token=token)
        call_api(results, role, "PUT", base_url, f"/notifications/{notif_id or 1}/read", token=token)
        call_api(results, role, "DELETE", base_url, f"/notifications/{notif_id or 1}", token=token)

        # Users & devices
        call_api(
            results,
            role,
            "PUT",
            base_url,
            "/users/me",
            token=token,
            body={"jobTitle": "QA Agent"},
        )
        call_api(
            results,
            role,
            "PUT",
            base_url,
            "/users/me/password",
            token=token,
            body={"currentPassword": "WrongPassword!", "newPassword": "Password123!"},
        )
        call_api(
            results,
            role,
            "PUT",
            base_url,
            "/users/me/profile-image",
            token=token,
            body={"profileImageFileId": ctx["file_id"]},
        )
        call_api(results, role, "GET", base_url, "/users/me/devices", token=token)
        call_api(
            results,
            role,
            "POST",
            base_url,
            "/users/me/devices",
            token=token,
            body={"token": f"agent-device-{ctx['email']}", "deviceType": "web"},
        )
        call_api(
            results,
            role,
            "DELETE",
            base_url,
            "/users/me/devices",
            token=token,
            body={"token": f"agent-device-{ctx['email']}"},
        )

    # Admin calls
    admin_role = "admin"
    admin_ctx = agent_contexts[0] if agent_contexts else {}
    company_id = admin_ctx.get("company_id") or 1
    deal_id = admin_ctx.get("deal_id") or 1
    ad_id = admin_ctx.get("ad_id") or 1
    ticket_id = admin_ctx.get("ticket_id") or 1
    support_chat_id = admin_ctx.get("support_chat_id") or 1
    agent_user_id = admin_ctx.get("user_id") or 1

    call_api(results, admin_role, "GET", base_url, "/admin/companies", token=admin_token)
    call_api(results, admin_role, "GET", base_url, "/admin/companies/pending", token=admin_token)
    call_api(results, admin_role, "GET", base_url, f"/admin/companies/{company_id}", token=admin_token)
    call_api(
        results,
        admin_role,
        "PUT",
        base_url,
        f"/admin/companies/{company_id}",
        token=admin_token,
        body={"description": "Admin updated"},
    )
    call_api(
        results,
        admin_role,
        "PUT",
        base_url,
        f"/admin/companies/{company_id}/summary",
        token=admin_token,
        body={"summary": "Summary updated by admin"},
    )
    call_api(
        results,
        admin_role,
        "PATCH",
        base_url,
        f"/admin/companies/{company_id}/status",
        token=admin_token,
        body={"status": "active"},
    )
    call_api(results, admin_role, "POST", base_url, f"/admin/companies/{company_id}/approve", token=admin_token)
    call_api(results, admin_role, "POST", base_url, f"/admin/companies/{company_id}/reject", token=admin_token)
    call_api(
        results,
        admin_role,
        "POST",
        base_url,
        f"/admin/companies/{company_id}/agent",
        token=admin_token,
        body={"agentId": agent_user_id},
    )
    call_api(
        results,
        admin_role,
        "PATCH",
        base_url,
        f"/admin/agents/{agent_user_id}/email",
        token=admin_token,
        body={"email": admin_ctx.get("email") or agents[0]},
    )
    call_api(results, admin_role, "GET", base_url, f"/admin/companies/{company_id}/reviews", token=admin_token)

    # Admin gallery/docs/contributions
    call_api(results, admin_role, "GET", base_url, f"/admin/companies/{company_id}/gallery", token=admin_token)
    admin_gallery_id = None
    gallery_resp = call_api(
        results,
        admin_role,
        "POST",
        base_url,
        f"/admin/companies/{company_id}/gallery",
        token=admin_token,
        body={"imageFileId": admin_ctx.get("file_id") or 1, "description": "Admin gallery"},
    )
    gallery_data = extract_data(gallery_resp.get("json"))
    admin_gallery_id = extract_data_id(gallery_data) or admin_gallery_id
    call_api(
        results,
        admin_role,
        "PUT",
        base_url,
        f"/admin/companies/{company_id}/gallery/{admin_gallery_id or 1}",
        token=admin_token,
        body={"description": "Admin gallery updated"},
    )
    call_api(
        results,
        admin_role,
        "DELETE",
        base_url,
        f"/admin/companies/{company_id}/gallery/{admin_gallery_id or 1}",
        token=admin_token,
    )

    call_api(results, admin_role, "GET", base_url, f"/admin/companies/{company_id}/documents", token=admin_token)
    admin_document_id = None
    doc_resp = call_api(
        results,
        admin_role,
        "POST",
        base_url,
        f"/admin/companies/{company_id}/documents",
        token=admin_token,
        body={"fileId": admin_ctx.get("file_id") or 1, "description": "Admin doc"},
    )
    doc_data = extract_data(doc_resp.get("json"))
    admin_document_id = extract_data_id(doc_data) or admin_document_id
    call_api(
        results,
        admin_role,
        "PUT",
        base_url,
        f"/admin/companies/{company_id}/documents/{admin_document_id or 1}",
        token=admin_token,
        body={"description": "Admin doc updated"},
    )
    call_api(
        results,
        admin_role,
        "DELETE",
        base_url,
        f"/admin/companies/{company_id}/documents/{admin_document_id or 1}",
        token=admin_token,
    )

    call_api(results, admin_role, "GET", base_url, f"/admin/companies/{company_id}/contributions", token=admin_token)
    admin_contribution_id = None
    contrib_resp = call_api(
        results,
        admin_role,
        "POST",
        base_url,
        f"/admin/companies/{company_id}/contributions",
        token=admin_token,
        body={
            "type": "project",
            "title": "Admin contribution",
            "description": "Admin created",
            "mediaType": "url",
            "mediaUrl": "https://example.com/admin",
        },
    )
    contrib_data = extract_data(contrib_resp.get("json"))
    admin_contribution_id = extract_data_id(contrib_data) or admin_contribution_id
    call_api(
        results,
        admin_role,
        "PUT",
        base_url,
        f"/admin/companies/{company_id}/contributions/{admin_contribution_id or 1}",
        token=admin_token,
        body={"description": "Admin updated"},
    )
    call_api(
        results,
        admin_role,
        "DELETE",
        base_url,
        f"/admin/companies/{company_id}/contributions/{admin_contribution_id or 1}",
        token=admin_token,
    )

    # Admin deals
    call_api(results, admin_role, "GET", base_url, "/admin/deals", token=admin_token)
    call_api(results, admin_role, "GET", base_url, f"/admin/deals/{deal_id}", token=admin_token)
    call_api(
        results,
        admin_role,
        "PATCH",
        base_url,
        f"/admin/deals/{deal_id}/status",
        token=admin_token,
        body={"status": "open"},
    )

    # Admin ads
    call_api(results, admin_role, "GET", base_url, "/admin/ads", token=admin_token)
    call_api(results, admin_role, "GET", base_url, f"/admin/ads/{ad_id}", token=admin_token)
    call_api(
        results,
        admin_role,
        "PATCH",
        base_url,
        f"/admin/ads/{ad_id}/status",
        token=admin_token,
        body={"status": "active"},
    )

    # Admin tickets
    call_api(results, admin_role, "GET", base_url, "/admin/tickets", token=admin_token)
    call_api(results, admin_role, "GET", base_url, f"/admin/tickets/{ticket_id}", token=admin_token)
    call_api(
        results,
        admin_role,
        "PATCH",
        base_url,
        f"/admin/tickets/{ticket_id}",
        token=admin_token,
        body={"status": "in_progress"},
    )
    call_api(
        results,
        admin_role,
        "POST",
        base_url,
        f"/admin/tickets/{ticket_id}/responses",
        token=admin_token,
        body={"message": "Admin response"},
    )

    # Admin pending updates
    call_api(results, admin_role, "GET", base_url, "/admin/companies/pending-updates", token=admin_token)
    call_api(
        results,
        admin_role,
        "GET",
        base_url,
        "/admin/companies/pending-updates/1",
        token=admin_token,
    )
    call_api(
        results,
        admin_role,
        "POST",
        base_url,
        "/admin/companies/pending-updates/1/approve",
        token=admin_token,
    )
    call_api(
        results,
        admin_role,
        "POST",
        base_url,
        "/admin/companies/pending-updates/1/reject",
        token=admin_token,
        body={"reason": "Not needed"},
    )

    # Admin support chat
    call_api(results, admin_role, "GET", base_url, "/admin/support/chats", token=admin_token)
    call_api(results, admin_role, "GET", base_url, "/admin/support/chats/waiting", token=admin_token)
    call_api(results, admin_role, "GET", base_url, f"/admin/support/chats/{support_chat_id}", token=admin_token)
    call_api(
        results,
        admin_role,
        "POST",
        base_url,
        f"/admin/support/chats/{support_chat_id}/assign",
        token=admin_token,
    )
    call_api(
        results,
        admin_role,
        "POST",
        base_url,
        f"/admin/support/chats/{support_chat_id}/close",
        token=admin_token,
    )

    # Final: unknown user run
    call_unknown()

    ensure_output_dir()
    with open(OUTPUT_FILE, "w", encoding="utf-8") as fh:
        json.dump({"generatedAt": now_iso(), "results": results}, fh, ensure_ascii=False, indent=2)

    families = {}
    for entry in results:
        family = status_family(entry.get("status_code"))
        families.setdefault(family, []).append(entry)

    for family, items in families.items():
        family_path = os.path.join(OUTPUT_DIR, f"all_api_results_{family}.json")
        with open(family_path, "w", encoding="utf-8") as fh:
            json.dump({"generatedAt": now_iso(), "results": items}, fh, ensure_ascii=False, indent=2)

    print(f"Saved {len(results)} responses to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
