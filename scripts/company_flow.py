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


def pick_file_id(company_payload, doc_items, gallery_items, contribution_items, media_items):
    if company_payload and company_payload.get("logoFileId"):
        return company_payload.get("logoFileId")
    for item in doc_items or []:
        file_id = item.get("fileId")
        if file_id:
            return file_id
    for item in gallery_items or []:
        file_id = item.get("imageFileId")
        if file_id:
            return file_id
    for item in contribution_items or []:
        file_id = item.get("mediaFileId")
        if file_id:
            return file_id
    for item in media_items or []:
        file_id = item.get("fileId")
        if file_id:
            return file_id
    return None


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

    agent_email = os.environ.get("AGENT_EMAIL") or f"{agent_prefix}{agent_index}@{agent_domain}"
    agent2_email = os.environ.get("AGENT2_EMAIL") or f"{agent_prefix}{agent2_index}@{agent_domain}"

    output_path = os.environ.get(
        "COMPANY_FLOW_OUTPUT_FILE",
        os.path.join("scripts", "output", "company_flow_results.json"),
    )

    steps = []
    started_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    agent_token, agent_login_payload, agent_login = login(base_url, agent_email, agent_password)
    agent2_token, agent2_login_payload, agent2_login = login(base_url, agent2_email, agent_password)

    record_step(steps, "agent_login", "POST", "/auth/login", agent_login, payload={"email": agent_email})
    record_step(steps, "agent2_login", "POST", "/auth/login", agent2_login, payload={"email": agent2_email})

    agent_company = (agent_login_payload or {}).get("data", {}).get("company")
    agent2_company = (agent2_login_payload or {}).get("data", {}).get("company")

    # Profile
    resp = http_request("GET", base_url, "/companies/me", token=agent_token)
    record_step(steps, "get_my_profile", "GET", "/companies/me", resp)

    update_payload = {"description": "Updated by company flow script"}
    resp = http_request("PUT", base_url, "/companies/me", payload=update_payload, token=agent_token)
    record_step(steps, "update_my_profile", "PUT", "/companies/me", resp, payload=update_payload)

    resp = http_request("POST", base_url, "/companies/me/resend-for-review", token=agent_token)
    record_step(steps, "resend_for_review", "POST", "/companies/me/resend-for-review", resp)

    # Gallery
    resp_gallery = http_request("GET", base_url, "/companies/me/gallery", token=agent_token)
    record_step(steps, "list_my_gallery", "GET", "/companies/me/gallery", resp_gallery)
    gallery_payload = parse_json(resp_gallery.get("body") or "")
    gallery_items = (gallery_payload or {}).get("data", []) or []

    # Documents
    resp_docs = http_request("GET", base_url, "/companies/me/documents", token=agent_token)
    record_step(steps, "list_my_documents", "GET", "/companies/me/documents", resp_docs)
    docs_payload = parse_json(resp_docs.get("body") or "")
    doc_items = (docs_payload or {}).get("data", []) or []

    # Contributions
    resp_contrib = http_request("GET", base_url, "/companies/me/contributions", token=agent_token)
    record_step(steps, "list_my_contributions", "GET", "/companies/me/contributions", resp_contrib)
    contrib_payload = parse_json(resp_contrib.get("body") or "")
    contrib_items = (contrib_payload or {}).get("data", []) or []

    # Contribution media (for first contribution if exists)
    media_items = []
    if contrib_items:
        contrib_id = contrib_items[0].get("id")
        if contrib_id:
            resp_media = http_request(
                "GET",
                base_url,
                f"/companies/me/contributions/{contrib_id}/media",
                token=agent_token,
            )
            record_step(steps, "list_contribution_media", "GET", f"/companies/me/contributions/{contrib_id}/media", resp_media)
            media_payload = parse_json(resp_media.get("body") or "")
            media_items = (media_payload or {}).get("data", []) or []

    file_id = pick_file_id(agent_company, doc_items, gallery_items, contrib_items, media_items)

    created_gallery_id = None
    if file_id:
        payload = {"imageFileId": file_id, "description": "Gallery item created by script"}
        resp = http_request("POST", base_url, "/companies/me/gallery", payload=payload, token=agent_token)
        record_step(steps, "create_gallery_item", "POST", "/companies/me/gallery", resp, payload=payload)
        parsed = parse_json(resp.get("body") or "")
        created_gallery_id = (parsed or {}).get("data", {}).get("id")
    elif gallery_items:
        created_gallery_id = gallery_items[0].get("id")

    if created_gallery_id:
        payload = {"description": "Gallery item updated by script"}
        resp = http_request(
            "PUT",
            base_url,
            f"/companies/me/gallery/{created_gallery_id}",
            payload=payload,
            token=agent_token,
        )
        record_step(steps, "update_gallery_item", "PUT", f"/companies/me/gallery/{created_gallery_id}", resp, payload=payload)

        resp = http_request(
            "DELETE",
            base_url,
            f"/companies/me/gallery/{created_gallery_id}",
            token=agent_token,
        )
        record_step(steps, "delete_gallery_item", "DELETE", f"/companies/me/gallery/{created_gallery_id}", resp)
    else:
        record_step(steps, "gallery_item_skipped", "SKIP", "/companies/me/gallery", {"reason": "No fileId or existing items"})

    created_doc_id = None
    if file_id:
        payload = {"fileId": file_id, "description": "Document created by script"}
        resp = http_request("POST", base_url, "/companies/me/documents", payload=payload, token=agent_token)
        record_step(steps, "create_document", "POST", "/companies/me/documents", resp, payload=payload)
        parsed = parse_json(resp.get("body") or "")
        created_doc_id = (parsed or {}).get("data", {}).get("id")
    elif doc_items:
        created_doc_id = doc_items[0].get("id")

    if created_doc_id:
        payload = {"description": "Document updated by script"}
        resp = http_request(
            "PUT",
            base_url,
            f"/companies/me/documents/{created_doc_id}",
            payload=payload,
            token=agent_token,
        )
        record_step(steps, "update_document", "PUT", f"/companies/me/documents/{created_doc_id}", resp, payload=payload)

        resp = http_request(
            "DELETE",
            base_url,
            f"/companies/me/documents/{created_doc_id}",
            token=agent_token,
        )
        record_step(steps, "delete_document", "DELETE", f"/companies/me/documents/{created_doc_id}", resp)
    else:
        record_step(steps, "document_skipped", "SKIP", "/companies/me/documents", {"reason": "No fileId or existing items"})

    created_contribution_id = None
    if file_id:
        payload = {
            "type": "project",
            "title": "Contribution created by script",
            "description": "Seeded contribution",
            "mediaType": "image",
            "mediaFileId": file_id,
        }
        resp = http_request("POST", base_url, "/companies/me/contributions", payload=payload, token=agent_token)
        record_step(steps, "create_contribution", "POST", "/companies/me/contributions", resp, payload=payload)
        parsed = parse_json(resp.get("body") or "")
        created_contribution_id = (parsed or {}).get("data", {}).get("id")
    elif contrib_items:
        created_contribution_id = contrib_items[0].get("id")

    if created_contribution_id:
        payload = {"description": "Contribution updated by script"}
        resp = http_request(
            "PUT",
            base_url,
            f"/companies/me/contributions/{created_contribution_id}",
            payload=payload,
            token=agent_token,
        )
        record_step(steps, "update_contribution", "PUT", f"/companies/me/contributions/{created_contribution_id}", resp, payload=payload)

        # Contribution media CRUD
        media_id = None
        if file_id:
            payload = {
                "fileId": file_id,
                "mediaType": "image",
                "caption": "Contribution media created by script",
                "sortOrder": 0,
            }
            resp = http_request(
                "POST",
                base_url,
                f"/companies/me/contributions/{created_contribution_id}/media",
                payload=payload,
                token=agent_token,
            )
            record_step(
                steps,
                "create_contribution_media",
                "POST",
                f"/companies/me/contributions/{created_contribution_id}/media",
                resp,
                payload=payload,
            )
            parsed = parse_json(resp.get("body") or "")
            media_id = (parsed or {}).get("data", {}).get("id")

        if media_id:
            payload = {"caption": "Contribution media updated by script"}
            resp = http_request(
                "PUT",
                base_url,
                f"/companies/me/contributions/{created_contribution_id}/media/{media_id}",
                payload=payload,
                token=agent_token,
            )
            record_step(
                steps,
                "update_contribution_media",
                "PUT",
                f"/companies/me/contributions/{created_contribution_id}/media/{media_id}",
                resp,
                payload=payload,
            )

            payload = {"orderedIds": [media_id]}
            resp = http_request(
                "PUT",
                base_url,
                f"/companies/me/contributions/{created_contribution_id}/media/reorder",
                payload=payload,
                token=agent_token,
            )
            record_step(
                steps,
                "reorder_contribution_media",
                "PUT",
                f"/companies/me/contributions/{created_contribution_id}/media/reorder",
                resp,
                payload=payload,
            )

            resp = http_request(
                "DELETE",
                base_url,
                f"/companies/me/contributions/{created_contribution_id}/media/{media_id}",
                token=agent_token,
            )
            record_step(
                steps,
                "delete_contribution_media",
                "DELETE",
                f"/companies/me/contributions/{created_contribution_id}/media/{media_id}",
                resp,
            )
        else:
            record_step(
                steps,
                "contribution_media_skipped",
                "SKIP",
                f"/companies/me/contributions/{created_contribution_id}/media",
                {"reason": "No fileId to create media"},
            )

        resp = http_request(
            "DELETE",
            base_url,
            f"/companies/me/contributions/{created_contribution_id}",
            token=agent_token,
        )
        record_step(steps, "delete_contribution", "DELETE", f"/companies/me/contributions/{created_contribution_id}", resp)
    else:
        record_step(steps, "contribution_skipped", "SKIP", "/companies/me/contributions", {"reason": "No fileId or existing items"})

    # Public flow for target company
    target_company_id = None
    if agent2_company and agent2_company.get("id"):
        target_company_id = agent2_company.get("id")
    elif agent_company and agent_company.get("id"):
        target_company_id = agent_company.get("id")

    if target_company_id:
        resp = http_request("GET", base_url, f"/companies/{target_company_id}")
        record_step(steps, "public_company_profile", "GET", f"/companies/{target_company_id}", resp)

        resp = http_request("GET", base_url, f"/companies/{target_company_id}/gallery")
        record_step(steps, "public_company_gallery", "GET", f"/companies/{target_company_id}/gallery", resp)

        resp = http_request("GET", base_url, f"/companies/{target_company_id}/reviews")
        record_step(steps, "public_company_reviews", "GET", f"/companies/{target_company_id}/reviews", resp)

    # Review creation (requires accepted deal between agent and agent2)
    review_deal_id = None
    if agent_token and agent2_token and agent_company and agent2_company:
        deal_payload = {
            "dealName": "Company flow review deal",
            "dealDescription": "Deal created to enable review",
            "dealValue": 10000,
            "dealType": "rfq",
        }
        resp = http_request("POST", base_url, "/deals", payload=deal_payload, token=agent_token)
        record_step(steps, "create_review_deal", "POST", "/deals", resp, payload=deal_payload)
        parsed = parse_json(resp.get("body") or "")
        review_deal_id = (parsed or {}).get("data", {}).get("id")

        if review_deal_id:
            request_payload = {"requestDetails": "Request for review deal", "requestOffer": 9500}
            resp = http_request(
                "POST",
                base_url,
                f"/deals/{review_deal_id}/requests",
                payload=request_payload,
                token=agent2_token,
            )
            record_step(
                steps,
                "submit_review_deal_request",
                "POST",
                f"/deals/{review_deal_id}/requests",
                resp,
                payload=request_payload,
            )
            parsed = parse_json(resp.get("body") or "")
            request_id = (parsed or {}).get("data", {}).get("id")

            if request_id:
                status_payload = {"status": "accepted"}
                resp = http_request(
                    "PATCH",
                    base_url,
                    f"/deals/{review_deal_id}/requests/{request_id}/status",
                    payload=status_payload,
                    token=agent_token,
                )
                record_step(
                    steps,
                    "accept_review_deal_request",
                    "PATCH",
                    f"/deals/{review_deal_id}/requests/{request_id}/status",
                    resp,
                    payload=status_payload,
                )

    if target_company_id and review_deal_id:
        review_payload = {
            "dealId": review_deal_id,
            "rating": 5,
            "reviewText": "Great collaboration in review flow",
        }
        resp = http_request(
            "POST",
            base_url,
            f"/companies/{target_company_id}/reviews",
            payload=review_payload,
            token=agent_token,
        )
        record_step(
            steps,
            "create_company_review",
            "POST",
            f"/companies/{target_company_id}/reviews",
            resp,
            payload=review_payload,
        )

    finished_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    results = {
        "meta": {
            "baseUrl": base_url,
            "startedAt": started_at,
            "finishedAt": finished_at,
            "agentEmail": agent_email,
            "agent2Email": agent2_email,
        },
        "steps": steps,
    }

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(results, handle, ensure_ascii=False, indent=2)

    print(f"Saved company flow results to {output_path}")


if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        sys.exit(1)
