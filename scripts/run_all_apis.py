#!/usr/bin/env python3
"""
V1 run_all_apis.py

Structured mixed-coverage runner aligned to V1 client behavior.
"""

import os
import sys
import time

from v1_scenario_lib import (
    ScenarioRunner,
    build_password_reset_debug_otp,
    create_file_for_actor,
    load_env_files,
    register_actor,
)

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUTPUT_FILE = os.environ.get(
    "ALL_APIS_OUTPUT_FILE",
    os.path.join(PROJECT_ROOT, "scripts", "output", "all_api_results.json"),
)


def run():
    load_env_files()
    ts = int(time.time())
    base_url = os.environ.get("API_BASE_URL", "http://localhost:3000/api/v1")

    runner = ScenarioRunner(base_url)
    common_password = f"Password123!{ts}"

    runner.step(
        step_id="guest.health",
        role="guest",
        method="GET",
        path="/health",
        expected_statuses=[200],
    )
    runner.step(
        step_id="guest.system_config",
        role="guest",
        method="GET",
        path="/system/config",
        expected_statuses=[200],
    )
    runner.step(
        step_id="guest.companies_search",
        role="guest",
        method="GET",
        path="/companies/search",
        params={"limit": 5},
        expected_status_family="2xx",
    )
    runner.step(
        step_id="guest.deals_search",
        role="guest",
        method="GET",
        path="/deals",
        params={"limit": 5, "sortBy": "date", "sortOrder": "desc"},
        expected_statuses=[200],
    )
    runner.step(
        step_id="guest.support_info",
        role="guest",
        method="GET",
        path="/support/info",
        expected_statuses=[200],
    )
    runner.step(
        step_id="guest.support_redirect",
        role="guest",
        method="GET",
        path="/support/email-redirect",
        expected_statuses=[200],
    )

    actor_a = register_actor(
        runner,
        role="client_admin_a",
        email=f"v1.runall.a.{ts}@indeal.test",
        password=common_password,
        company_name=f"V1 RunAll A {ts}",
        first_name="RunAll",
        last_name="A",
    )
    actor_b = register_actor(
        runner,
        role="client_admin_b",
        email=f"v1.runall.b.{ts}@indeal.test",
        password=common_password,
        company_name=f"V1 RunAll B {ts}",
        first_name="RunAll",
        last_name="B",
    )

    file_a = create_file_for_actor(runner, actor_a, "run-all")
    file_b = create_file_for_actor(runner, actor_b, "run-all")

    for actor, file_id in ((actor_a, file_a), (actor_b, file_b)):
        runner.step(
            step_id=f"{actor.label}.users_me",
            role=actor.label,
            method="GET",
            path="/users/me",
            token=actor.token,
            expected_statuses=[200],
        )
        runner.step(
            step_id=f"{actor.label}.company_update",
            role=actor.label,
            method="PUT",
            path="/companies/me",
            token=actor.token,
            payload={"description": f"Company updated by {actor.label}"},
            expected_statuses=[200],
        )
        if file_id:
            runner.step(
                step_id=f"{actor.label}.doc_create",
                role=actor.label,
                method="POST",
                path="/companies/me/documents",
                token=actor.token,
                payload={"fileId": file_id, "description": "V1 run_all document"},
                expected_statuses=[201],
            )

    deal_resp = runner.step(
        step_id="a.create_deal",
        role=actor_a.label,
        method="POST",
        path="/deals",
        token=actor_a.token,
        payload={
            "dealName": "RunAll Demand Deal",
            "dealDescription": "Deal for run_all_apis.py",
            "dealValue": 77000,
            "dealType": "demand",
            "attachments": [],
        },
        expected_statuses=[201],
    )
    deal_id = runner.extract_id(runner.extract_data(deal_resp), ["id"])

    req_resp = runner.step(
        step_id="b.submit_request",
        role=actor_b.label,
        method="POST",
        path=f"/deals/{deal_id}/requests",
        token=actor_b.token,
        payload={
            "requestKind": "demand",
            "demandDetails": {
                "productServiceName": "Industrial resin",
                "availableQuantity": 300,
                "unitPrice": 80,
                "currency": "USD",
            },
            "attachments": [],
        },
        expected_statuses=[201],
    )
    request_id = runner.extract_id(runner.extract_data(req_resp), ["id", "requestId"])

    runner.step(
        step_id="a.accept_request",
        role=actor_a.label,
        method="PATCH",
        path=f"/deals/{deal_id}/requests/{request_id}/status",
        token=actor_a.token,
        payload={"status": "accepted"},
        expected_statuses=[200],
    )

    runner.step(
        step_id="b.create_review",
        role=actor_b.label,
        method="POST",
        path=f"/companies/{actor_a.company_id}/reviews",
        token=actor_b.token,
        payload={"dealId": deal_id, "rating": 5, "reviewText": "Great buyer."},
        expected_statuses=[201],
    )

    room_resp = runner.step(
        step_id="a.create_chat_room",
        role=actor_a.label,
        method="POST",
        path="/chats",
        token=actor_a.token,
        payload={"targetCompanyId": actor_b.company_id},
        expected_statuses=[201],
    )
    room_id = runner.extract_id(runner.extract_data(room_resp), ["id", "roomId"])

    runner.step(
        step_id="a.chat_send_message",
        role=actor_a.label,
        method="POST",
        path=f"/chats/{room_id}/messages",
        token=actor_a.token,
        payload={"messageText": "Hello from run_all_apis"},
        expected_statuses=[201],
    )
    runner.step(
        step_id="b.chat_list_messages",
        role=actor_b.label,
        method="GET",
        path=f"/chats/{room_id}/messages",
        token=actor_b.token,
        expected_statuses=[200],
    )

    forgot_resp = runner.step(
        step_id="a.forgot_password",
        role=actor_a.label,
        method="POST",
        path="/auth/forgot-password",
        payload={"email": actor_a.email},
        expected_statuses=[200],
    )
    debug_otp = build_password_reset_debug_otp(forgot_resp)

    if debug_otp:
        runner.step(
            step_id="a.verify_otp",
            role=actor_a.label,
            method="POST",
            path="/auth/verify-otp",
            payload={"email": actor_a.email, "otp": debug_otp},
            expected_statuses=[200],
        )
        new_password = f"ResetPass!{ts}"
        runner.step(
            step_id="a.reset_password",
            role=actor_a.label,
            method="POST",
            path="/auth/reset-password",
            payload={
                "email": actor_a.email,
                "otp": debug_otp,
                "password": new_password,
                "confirmPassword": new_password,
            },
            expected_statuses=[200],
        )
        runner.step(
            step_id="a.login_after_reset",
            role=actor_a.label,
            method="POST",
            path="/auth/login",
            payload={"email": actor_a.email, "password": new_password},
            expected_statuses=[200],
        )

    negative_cases = [
        ("negative.unauth.users_me", "GET", "/users/me", [401]),
        ("negative.unauth.files_upload", "POST", "/files/upload-url", [401]),
        ("negative.removed.admin", "GET", "/admin/companies", [404]),
        ("negative.removed.ads", "GET", "/ads/active", [404]),
        ("negative.removed.notifications", "GET", "/notifications", [404]),
        ("negative.removed.support_ticket", "GET", "/support/tickets", [404]),
        ("negative.removed.support_chat", "GET", "/support/chat", [404]),
        ("negative.removed.devices", "GET", "/users/me/devices", [404]),
        ("negative.removed.auth_admin", "POST", "/auth/admin/login", [404]),
        ("negative.removed.auth_verify_email", "GET", "/auth/verify-email", [404]),
    ]

    for step_id, method, path, expected in negative_cases:
        payload = None
        if step_id == "negative.removed.auth_admin":
            payload = {"email": "admin@indeal.local", "password": "Password123!"}
        runner.step(
            step_id=step_id,
            role="guest",
            method=method,
            path=path,
            payload=payload,
            expected_statuses=expected,
        )

    runner.save(
        OUTPUT_FILE,
        extra_meta={
            "scenario": "v1_run_all_mixed",
            "actors": [actor_a.email, actor_b.email],
        },
    )
    print(f"Saved V1 all API results to {OUTPUT_FILE}")


if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        sys.exit(1)
