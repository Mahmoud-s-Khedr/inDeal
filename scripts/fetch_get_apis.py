#!/usr/bin/env python3
import json
import os
import sys
import time
from urllib import request, error
from urllib.parse import urljoin


def load_env_files():
    for name in (".env", ".env.docker", ".env.backup", ".env.example"):
        path = os.path.join(os.getcwd(), name)
        if not os.path.isfile(path):
            continue
        try:
            with open(path, "r", encoding="utf-8") as handle:
                for line in handle:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, value = line.split("=", 1)
                    key = key.strip()
                    value = value.strip().strip("\"'")
                    if key and key not in os.environ:
                        os.environ[key] = value
        except OSError:
            continue


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, hdrs, newurl):
        return None


def build_opener():
    return request.build_opener(NoRedirect())


def read_body_bytes(response):
    try:
        return response.read()
    except Exception:
        return b""


def decode_body(body_bytes):
    try:
        return body_bytes.decode("utf-8")
    except Exception:
        return body_bytes.decode("utf-8", errors="replace")


def http_request(method, base_url, path, payload=None, token=None, timeout=30):
    url = urljoin(base_url, path.lstrip("/"))
    headers = {"Accept": "application/json"}
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = request.Request(url, method=method, headers=headers, data=data)
    opener = build_opener()

    try:
        resp = opener.open(req, timeout=timeout)
        body_bytes = read_body_bytes(resp)
        return {
            "url": url,
            "status": resp.getcode(),
            "headers": dict(resp.headers.items()),
            "body": decode_body(body_bytes),
        }
    except error.HTTPError as http_err:
        body_bytes = read_body_bytes(http_err)
        return {
            "url": url,
            "status": http_err.code,
            "headers": dict(getattr(http_err, "headers", {}).items()),
            "body": decode_body(body_bytes),
        }
    except error.URLError as url_err:
        return {
            "url": url,
            "status": None,
            "headers": {},
            "body": "",
            "error": str(url_err),
        }


def login(base_url, email, password, is_admin=False):
    path = "/auth/admin/login" if is_admin else "/auth/login"
    result = http_request(
        "POST",
        base_url,
        path,
        payload={"email": email, "password": password},
        token=None,
    )
    token = None
    try:
        parsed = json.loads(result.get("body") or "{}")
        token = parsed.get("data", {}).get("token")
    except json.JSONDecodeError:
        token = None
    return token, result


def build_endpoints():
    return [
        "/health",
        "/system/stats",
        "/system/config",
        "/auth/verify-email?email=admin@indeal.local&token=invalidinvalidinvalid",
        "/companies/search",
        "/companies/me",
        "/companies/me/gallery",
        "/companies/me/documents",
        "/companies/me/contributions",
        "/companies/me/contributions/1/media",
        "/companies/1",
        "/companies/1/gallery",
        "/companies/1/reviews",
        "/deals",
        "/deals/1",
        "/deals/me/deals",
        "/deals/me/requests",
        "/deals/1/requests",
        "/chats",
        "/chats/1",
        "/chats/1/messages",
        "/ads/active",
        "/ads/1/click",
        "/ads/1",
        "/ads/1/analytics",
        "/support/info",
        "/support/tickets",
        "/support/tickets/1",
        "/support/chat",
        "/support/chat/1/messages",
        "/notifications",
        "/users/me",
        "/users/me/devices",
        "/admin/companies",
        "/admin/companies/pending",
        "/admin/companies/1",
        "/admin/companies/1/reviews",
        "/admin/companies/1/gallery",
        "/admin/companies/1/documents",
        "/admin/companies/1/contributions",
        "/admin/deals",
        "/admin/deals/1",
        "/admin/ads",
        "/admin/ads/1",
        "/admin/tickets",
        "/admin/tickets/1",
        "/admin/companies/pending-updates",
        "/admin/companies/pending-updates/1",
        "/admin/support/chats",
        "/admin/support/chats/waiting",
        "/admin/support/chats/1",
    ]


def run():
    load_env_files()

    base_url = os.environ.get("BASE_URL", "http://localhost:3000/api/v1/")
    if not base_url.endswith("/"):
        base_url += "/"

    admin_email = os.environ.get("ADMIN_EMAIL") or os.environ.get("SEED_ADMIN_EMAIL") or "admin@indeal.local"
    admin_password = (
        os.environ.get("ADMIN_PASSWORD")
        or os.environ.get("SEED_ADMIN_PASSWORD")
        or "Password123!"
    )

    agent_password = os.environ.get("AGENT_PASSWORD") or os.environ.get("SEED_TEST_PASSWORD") or "Password123!"
    agent_prefix = os.environ.get("SEED_TEST_AGENT_PREFIX") or "agent"
    agent_domain = os.environ.get("SEED_TEST_EMAIL_DOMAIN") or "indeal.test"
    agent_index = os.environ.get("AGENT_INDEX") or "1"
    agent_email = os.environ.get("AGENT_EMAIL") or f"{agent_prefix}{agent_index}@{agent_domain}"

    output_path = os.environ.get(
        "GET_API_OUTPUT_FILE",
        os.path.join("scripts", "output", "get_api_responses.json"),
    )

    endpoints = build_endpoints()

    started_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    agent_token, agent_login = login(base_url, agent_email, agent_password, is_admin=False)
    admin_token, admin_login = login(base_url, admin_email, admin_password, is_admin=True)

    results = {
        "meta": {
            "baseUrl": base_url,
            "startedAt": started_at,
            "agentEmail": agent_email,
            "adminEmail": admin_email,
        },
        "auth": {
            "agentLogin": agent_login,
            "adminLogin": admin_login,
        },
        "anonymous": [],
        "agent": [],
        "admin": [],
    }

    for path in endpoints:
        results["anonymous"].append(
            {
                "method": "GET",
                "path": path,
                "response": http_request("GET", base_url, path),
            }
        )

        results["agent"].append(
            {
                "method": "GET",
                "path": path,
                "response": http_request("GET", base_url, path, token=agent_token),
            }
        )

        results["admin"].append(
            {
                "method": "GET",
                "path": path,
                "response": http_request("GET", base_url, path, token=admin_token),
            }
        )

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(results, handle, ensure_ascii=False, indent=2)

    print(f"Saved GET API responses to {output_path}")


if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        sys.exit(1)
