#!/usr/bin/env python3
import json
import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib import error, request
from urllib.parse import urlencode, urljoin

_UNSET = object()


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, hdrs, newurl):
        return None


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def load_env_files() -> Dict[str, str]:
    env = {}
    cwd = os.getcwd()
    for name in (".env", ".env.docker", ".env.backup", ".env.example"):
        path = os.path.join(cwd, name)
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
                    env[key] = value
                    if key not in os.environ:
                        os.environ[key] = value
        except OSError:
            continue
    return env


def resolve_base_url(default: str = "http://localhost:3000/api/v1") -> str:
    return (
        os.environ.get("API_BASE_URL")
        or os.environ.get("BASE_URL")
        or os.environ.get("API_BASE")
        or default
    )


def parse_json(text: str) -> Optional[Dict[str, Any]]:
    try:
        return json.loads(text)
    except Exception:
        return None


def _status_family(status: Optional[int]) -> str:
    if isinstance(status, int):
        return f"{status // 100}xx"
    return "unknown"


@dataclass
class Actor:
    label: str
    email: str
    password: str
    token: Optional[str] = None
    user_id: Optional[int] = None
    company_id: Optional[int] = None


class ScenarioRunner:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/") + "/"
        self.started_at = now_iso()
        self._opener = request.build_opener(NoRedirect())
        self.steps: List[Dict[str, Any]] = []

    def request(
        self,
        method: str,
        path: str,
        *,
        token: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None,
        payload: Optional[Dict[str, Any]] = None,
        timeout: int = 30,
    ) -> Dict[str, Any]:
        url = urljoin(self.base_url, path.lstrip("/"))
        if params:
            query = urlencode(params, doseq=True)
            url = f"{url}?{query}"

        headers = {"Accept": "application/json"}
        data = None
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if token:
            headers["Authorization"] = f"Bearer {token}"

        req = request.Request(url, method=method, headers=headers, data=data)
        started = time.time()

        try:
            resp = self._opener.open(req, timeout=timeout)
            body = resp.read().decode("utf-8", errors="replace")
            return {
                "url": url,
                "status": resp.getcode(),
                "headers": dict(resp.headers.items()),
                "body": body,
                "json": parse_json(body),
                "durationMs": int((time.time() - started) * 1000),
                "error": None,
            }
        except error.HTTPError as http_err:
            body = http_err.read().decode("utf-8", errors="replace")
            return {
                "url": url,
                "status": http_err.code,
                "headers": dict(getattr(http_err, "headers", {}).items()),
                "body": body,
                "json": parse_json(body),
                "durationMs": int((time.time() - started) * 1000),
                "error": str(http_err),
            }
        except error.URLError as url_err:
            return {
                "url": url,
                "status": None,
                "headers": {},
                "body": "",
                "json": None,
                "durationMs": int((time.time() - started) * 1000),
                "error": str(url_err),
            }

    def step(
        self,
        *,
        step_id: str,
        role: str,
        method: str,
        path: str,
        token: Any = _UNSET,
        params: Optional[Dict[str, Any]] = None,
        payload: Optional[Dict[str, Any]] = None,
        expected_statuses: Optional[List[int]] = None,
        expected_status_family: Optional[str] = None,
    ) -> Dict[str, Any]:
        if token is _UNSET:
            token_value = None
        elif not token:
            return self.blocked_step(
                step_id=step_id,
                role=role,
                method=method,
                path=path,
                reason="missing access token from prior auth step",
                expected_statuses=expected_statuses,
                expected_status_family=expected_status_family,
            )
        else:
            token_value = token

        response = self.request(
            method,
            path,
            token=token_value,
            params=params,
            payload=payload,
        )

        status = response.get("status")
        assertion_passed = True
        if expected_statuses is not None:
            assertion_passed = status in expected_statuses
        elif expected_status_family is not None:
            assertion_passed = _status_family(status) == expected_status_family

        entry = {
            "timestamp": now_iso(),
            "stepId": step_id,
            "role": role,
            "method": method,
            "path": path,
            "request": {"params": params, "payload": payload},
            "expectedStatus": expected_statuses,
            "expectedStatusFamily": expected_status_family,
            "assertionResult": {
                "passed": assertion_passed,
                "actualStatus": status,
                "actualStatusFamily": _status_family(status),
            },
            "response": response,
        }
        self.steps.append(entry)
        return response

    def blocked_step(
        self,
        *,
        step_id: str,
        role: str,
        method: str,
        path: str,
        reason: str,
        expected_statuses: Optional[List[int]] = None,
        expected_status_family: Optional[str] = None,
    ) -> Dict[str, Any]:
        entry = {
            "timestamp": now_iso(),
            "stepId": step_id,
            "role": role,
            "method": method,
            "path": path,
            "request": {"params": None, "payload": None},
            "expectedStatus": expected_statuses,
            "expectedStatusFamily": expected_status_family,
            "assertionResult": {
                "passed": False,
                "actualStatus": None,
                "actualStatusFamily": "blocked",
            },
            "response": {
                "url": None,
                "status": None,
                "headers": {},
                "body": "",
                "json": None,
                "durationMs": 0,
                "error": f"Blocked: {reason}",
            },
            "blocked": True,
            "blockReason": reason,
        }
        self.steps.append(entry)
        return entry["response"]

    def extract_token(self, response: Dict[str, Any]) -> Optional[str]:
        data = (response.get("json") or {}).get("data") or {}
        return data.get("accessToken") or data.get("token")

    def extract_data(self, response: Dict[str, Any]) -> Any:
        payload = response.get("json") or {}
        return payload.get("data")

    def extract_id(self, payload: Any, keys: Optional[List[str]] = None) -> Optional[int]:
        keys = keys or ["id", "roomId", "fileId", "documentId", "dealId", "requestId"]
        if isinstance(payload, dict):
            for key in keys:
                value = payload.get(key)
                if isinstance(value, int):
                    return value
        return None

    def require_id(
        self,
        payload: Any,
        *,
        keys: Optional[List[str]] = None,
        context: str = "response payload",
    ) -> Optional[int]:
        value = self.extract_id(payload, keys)
        if isinstance(value, int) and value > 0:
            return value
        return None

    def summary(self) -> Dict[str, Any]:
        total = len(self.steps)
        passed = sum(1 for s in self.steps if s["assertionResult"]["passed"])
        failed = total - passed
        by_family: Dict[str, int] = {}
        for step in self.steps:
            fam = step["assertionResult"]["actualStatusFamily"]
            by_family[fam] = by_family.get(fam, 0) + 1
        return {
            "totalSteps": total,
            "passedAssertions": passed,
            "failedAssertions": failed,
            "statusFamilyBreakdown": by_family,
        }

    def save(self, output_path: str, extra_meta: Optional[Dict[str, Any]] = None):
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        meta = {
            "baseUrl": self.base_url,
            "startedAt": self.started_at,
            "finishedAt": now_iso(),
            "summary": self.summary(),
        }
        if extra_meta:
            meta.update(extra_meta)

        with open(output_path, "w", encoding="utf-8") as handle:
            json.dump({"meta": meta, "steps": self.steps}, handle, ensure_ascii=False, indent=2)


def build_password_reset_debug_otp(response: Dict[str, Any]) -> Optional[str]:
    data = (response.get("json") or {}).get("data") or {}
    debug = data.get("debugOtp") or {}
    otp = debug.get("otp")
    return otp if isinstance(otp, str) and len(otp) == 6 else None


def build_email_verification_debug_otp(response: Dict[str, Any]) -> Optional[str]:
    data = (response.get("json") or {}).get("data") or {}
    debug = data.get("debugOtp") or {}
    otp = debug.get("otp")
    return otp if isinstance(otp, str) and len(otp) == 6 else None


def pick_register_file_id(runner: ScenarioRunner, role: str) -> Optional[int]:
    resp = runner.step(
        step_id=f"{role}.register_upload_url",
        role=role,
        method="POST",
        path="/auth/register/upload-url",
        payload={
            "fileName": f"{role}-registration.pdf",
            "fileType": "application/pdf",
            "fileSize": 4096,
        },
        expected_statuses=[201],
    )
    data = runner.extract_data(resp)
    if isinstance(data, dict) and isinstance(data.get("file"), dict):
        return runner.extract_id(data["file"], ["id"])
    return None


def register_actor(
    runner: ScenarioRunner,
    *,
    role: str,
    email: str,
    password: str,
    company_name: str,
    first_name: str,
    last_name: str,
) -> Actor:
    file_id = pick_register_file_id(runner, role)
    documents = []
    if file_id:
        documents.append({
            "fileId": file_id,
            "docType": "commercial-register",
            "description": "Registration doc from simulator",
        })

    company_payload = {
        "name": company_name,
        "description": f"{company_name} created by V1 scenario runner",
    }
    if documents:
        company_payload["documents"] = documents

    resp = runner.step(
        step_id=f"{role}.register",
        role=role,
        method="POST",
        path="/auth/register",
        payload={
            "user": {
                "username": email.split("@")[0][:40],
                "email": email,
                "password": password,
                "firstName": first_name,
                "lastName": last_name,
            },
            "company": company_payload,
        },
        expected_statuses=[201],
    )

    token = runner.extract_token(resp)
    data = runner.extract_data(resp) or {}
    user_id = runner.extract_id(data.get("user") if isinstance(data, dict) else None, ["id"])
    company_id = runner.extract_id(data.get("company") if isinstance(data, dict) else None, ["id"])

    actor = Actor(
        label=role,
        email=email,
        password=password,
        token=token,
        user_id=user_id,
        company_id=company_id,
    )

    email_otp = build_email_verification_debug_otp(resp)
    if email_otp:
        runner.step(
            step_id=f"{role}.verify_email",
            role=role,
            method="POST",
            path="/auth/verify-email",
            payload={"email": email, "otp": email_otp},
            expected_statuses=[200],
        )

    login_resp = runner.step(
        step_id=f"{role}.login",
        role=role,
        method="POST",
        path="/auth/login",
        payload={"email": email, "password": password},
        expected_statuses=[200],
    )
    login_token = runner.extract_token(login_resp)
    if login_token:
        actor.token = login_token

    return actor


def create_file_for_actor(runner: ScenarioRunner, actor: Actor, name_prefix: str) -> Optional[int]:
    resp = runner.step(
        step_id=f"{actor.label}.{name_prefix}.upload_url",
        role=actor.label,
        method="POST",
        path="/files/upload-url",
        token=actor.token,
        payload={
            "fileName": f"{name_prefix}-{actor.label}.png",
            "fileType": "image/png",
            "fileSize": 2048,
        },
        expected_statuses=[201],
    )
    data = runner.extract_data(resp)
    if isinstance(data, dict) and isinstance(data.get("file"), dict):
        return runner.extract_id(data["file"], ["id"])
    return None
