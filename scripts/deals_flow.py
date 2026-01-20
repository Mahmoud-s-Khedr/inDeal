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


def parse_json(body):
    try:
        return json.loads(body)
    except Exception:
        return None


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
    data = parse_json(result.get("body") or "")
    if data:
        token = data.get("data", {}).get("token")
    return token, data, result


def record_step(steps, name, method, path, response, payload=None):
    steps.append(
        {
            "name": name,
            "method": method,
            "path": path,
            "payload": payload,
            "response": response,
        }
    )


def run():
    load_env_files()

    base_url = os.environ.get("BASE_URL", "http://localhost:3000/api/v1/")
    if not base_url.endswith("/"):
        base_url += "/"

    agent_password = os.environ.get("AGENT_PASSWORD") or os.environ.get("SEED_TEST_PASSWORD") or "Password123!"
    agent_prefix = os.environ.get("SEED_TEST_AGENT_PREFIX") or "agent"
    agent_domain = os.environ.get("SEED_TEST_EMAIL_DOMAIN") or "indeal.test"

    agent_index = os.environ.get("AGENT_INDEX") or "1"
    agent2_index = os.environ.get("AGENT2_INDEX") or "2"

    owner_email = os.environ.get("OWNER_EMAIL") or f"{agent_prefix}{agent_index}@{agent_domain}"
    applicant_email = os.environ.get("APPLICANT_EMAIL") or f"{agent_prefix}{agent2_index}@{agent_domain}"

    output_path = os.environ.get(
        "DEALS_FLOW_OUTPUT_FILE",
        os.path.join("scripts", "output", "deals_flow_results.json"),
    )

    steps = []
    started_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    owner_token, owner_login_payload, owner_login = login(base_url, owner_email, agent_password)
    applicant_token, applicant_login_payload, applicant_login = login(base_url, applicant_email, agent_password)

    record_step(steps, "owner_login", "POST", "/auth/login", owner_login, payload={"email": owner_email})
    record_step(steps, "applicant_login", "POST", "/auth/login", applicant_login, payload={"email": applicant_email})

    # Owner creates deal
    deal_payload = {
        "dealName": "Flow deal",
        "dealDescription": "Deal created by deals flow script",
        "dealValue": 50000,
        "dealType": "rfq",
    }
    resp = http_request("POST", base_url, "/deals", payload=deal_payload, token=owner_token)
    record_step(steps, "create_deal", "POST", "/deals", resp, payload=deal_payload)
    parsed = parse_json(resp.get("body") or "")
    deal_id = (parsed or {}).get("data", {}).get("id")

    if deal_id:
        resp = http_request("GET", base_url, "/deals", token=applicant_token)
        record_step(steps, "list_deals", "GET", "/deals", resp)

        resp = http_request("GET", base_url, f"/deals/{deal_id}", token=applicant_token)
        record_step(steps, "get_deal", "GET", f"/deals/{deal_id}", resp)

        # Applicant submits request (pending)
        request_payload = {"requestDetails": "Initial request", "requestOffer": 48000}
        resp = http_request(
            "POST",
            base_url,
            f"/deals/{deal_id}/requests",
            payload=request_payload,
            token=applicant_token,
        )
        record_step(
            steps,
            "submit_request_1",
            "POST",
            f"/deals/{deal_id}/requests",
            resp,
            payload=request_payload,
        )
        parsed = parse_json(resp.get("body") or "")
        request_id_1 = (parsed or {}).get("data", {}).get("id")

        # Withdraw pending request
        if request_id_1:
            resp = http_request(
                "DELETE",
                base_url,
                f"/deals/requests/{request_id_1}",
                token=applicant_token,
            )
            record_step(steps, "withdraw_request_1", "DELETE", f"/deals/requests/{request_id_1}", resp)

        # Submit second request for acceptance
        request_payload = {"requestDetails": "Second request", "requestOffer": 47000}
        resp = http_request(
            "POST",
            base_url,
            f"/deals/{deal_id}/requests",
            payload=request_payload,
            token=applicant_token,
        )
        record_step(
            steps,
            "submit_request_2",
            "POST",
            f"/deals/{deal_id}/requests",
            resp,
            payload=request_payload,
        )
        parsed = parse_json(resp.get("body") or "")
        request_id_2 = (parsed or {}).get("data", {}).get("id")

        # Owner lists requests
        resp = http_request(
            "GET",
            base_url,
            f"/deals/{deal_id}/requests",
            token=owner_token,
        )
        record_step(steps, "list_deal_requests", "GET", f"/deals/{deal_id}/requests", resp)

        # Owner accepts request
        if request_id_2:
            status_payload = {"status": "accepted"}
            resp = http_request(
                "PATCH",
                base_url,
                f"/deals/{deal_id}/requests/{request_id_2}/status",
                payload=status_payload,
                token=owner_token,
            )
            record_step(
                steps,
                "accept_request",
                "PATCH",
                f"/deals/{deal_id}/requests/{request_id_2}/status",
                resp,
                payload=status_payload,
            )

        # Applicant views status
        resp = http_request("GET", base_url, f"/deals/{deal_id}", token=applicant_token)
        record_step(steps, "get_deal_after_accept", "GET", f"/deals/{deal_id}", resp)

        resp = http_request("GET", base_url, "/deals/me/requests", token=applicant_token)
        record_step(steps, "list_my_requests", "GET", "/deals/me/requests", resp)

        # Owner closes deal
        close_payload = {"status": "closed"}
        resp = http_request(
            "PUT",
            base_url,
            f"/deals/{deal_id}",
            payload=close_payload,
            token=owner_token,
        )
        record_step(steps, "close_deal", "PUT", f"/deals/{deal_id}", resp, payload=close_payload)

        # Owner archives deal
        resp = http_request(
            "DELETE",
            base_url,
            f"/deals/{deal_id}",
            token=owner_token,
        )
        record_step(steps, "archive_deal", "DELETE", f"/deals/{deal_id}", resp)

    finished_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    results = {
        "meta": {
            "baseUrl": base_url,
            "startedAt": started_at,
            "finishedAt": finished_at,
            "ownerEmail": owner_email,
            "applicantEmail": applicant_email,
        },
        "steps": steps,
    }

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(results, handle, ensure_ascii=False, indent=2)

    print(f"Saved deals flow results to {output_path}")


if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        sys.exit(1)
