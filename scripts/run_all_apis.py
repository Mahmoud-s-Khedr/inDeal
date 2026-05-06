#!/usr/bin/env python3
"""
Canonical V1 flow matrix runner aligned with docs/user-flows.md.
"""

import os
import sys
import time

from v1_scenario_lib import (
    ScenarioRunner,
    build_direct_request_payload,
    build_in_supply_request_payload,
    build_password_reset_debug_otp,
    create_file_for_actor,
    load_env_files,
    register_actor,
    resolve_base_url,
)

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUTPUT_FILE = os.environ.get(
    "ALL_APIS_OUTPUT_FILE",
    os.path.join(PROJECT_ROOT, "scripts", "output", "all_api_results.json"),
)


def run():
    load_env_files()
    ts = int(time.time())
    base_url = resolve_base_url()

    runner = ScenarioRunner(base_url)
    common_password = f"Password123!{ts}"

    for step_id, path, params in [
        ("guest.health", "/health", None),
        ("guest.system_config", "/system/config", None),
        ("guest.system_stats", "/system/stats", None),
        ("guest.companies_search", "/companies/search", {"limit": 5}),
        ("guest.deals_search", "/deals", {"limit": 5, "sortBy": "date", "sortOrder": "desc"}),
        ("guest.search", "/search", {"q": "steel", "limit": 5}),
    ]:
        runner.step(
            step_id=step_id,
            role="guest",
            method="GET",
            path=path,
            params=params,
            expected_status_family="2xx",
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
            step_id=f"{actor.label}.company_get",
            role=actor.label,
            method="GET",
            path="/companies/me",
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
            doc_resp = runner.step(
                step_id=f"{actor.label}.doc_create",
                role=actor.label,
                method="POST",
                path="/companies/me/documents",
                token=actor.token,
                payload={"fileId": file_id, "description": "V1 run_all document"},
                expected_statuses=[201],
            )
            doc_id = runner.extract_id(runner.extract_data(doc_resp), ["id"])
            if doc_id:
                runner.step(
                    step_id=f"{actor.label}.doc_update",
                    role=actor.label,
                    method="PUT",
                    path=f"/companies/me/documents/{doc_id}",
                    token=actor.token,
                    payload={"description": "Updated from run_all"},
                    expected_statuses=[200],
                )

    deal_resp = runner.step(
        step_id="deals.a.create",
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

    if deal_id:
        runner.step(
            step_id="deals.public.get_detail",
            role="guest",
            method="GET",
            path=f"/deals/{deal_id}",
            expected_statuses=[200],
        )

    req_resp = runner.step(
        step_id="requests.in_supply.b.submit",
        role=actor_b.label,
        method="POST",
        path=f"/deals/{deal_id}/requests",
        token=actor_b.token,
        payload=build_in_supply_request_payload("demand"),
        expected_statuses=[201],
    )
    request_id = runner.extract_id(runner.extract_data(req_resp), ["id", "requestId"])

    if deal_id and request_id:
        incoming_requests_resp = runner.step(
            step_id="lists.a.incoming_requests",
            role=actor_a.label,
            method="GET",
            path=f"/deals/{deal_id}/requests",
            token=actor_a.token,
            expected_statuses=[200],
        )
        if not runner.has_request_list_shape(incoming_requests_resp):
            runner.blocked_step(
                step_id="lists.a.incoming_requests.shape",
                role=actor_a.label,
                method="GET",
                path=f"/deals/{deal_id}/requests",
                reason="response missing requests/stats shape",
                expected_statuses=[200],
            )
        runner.step(
            step_id="requests.owner.accept",
            role=actor_a.label,
            method="PATCH",
            path=f"/deals/{deal_id}/requests/{request_id}/status",
            token=actor_a.token,
            payload={"status": "accepted"},
            expected_statuses=[200],
        )

    if request_id:
        runner.step(
            step_id="requests.b.pause",
            role=actor_b.label,
            method="PATCH",
            path=f"/deals/requests/{request_id}/pause",
            token=actor_b.token,
            expected_status_family="2xx",
        )
        runner.step(
            step_id="requests.b.cancel",
            role=actor_b.label,
            method="PATCH",
            path=f"/deals/requests/{request_id}/cancel",
            token=actor_b.token,
            payload={"cancelReason": "test cancel from run_all"},
            expected_status_family="2xx",
        )

    direct_resp = runner.step(
        step_id="direct.b.submit",
        role=actor_b.label,
        method="POST",
        path="/deals/direct-requests",
        token=actor_b.token,
        payload=build_direct_request_payload(actor_a.company_id),
        expected_statuses=[201],
    )
    direct_request_id = runner.extract_id(runner.extract_data(direct_resp), ["id", "requestId"])

    runner.step(
        step_id="lists.a.my_deals",
        role=actor_a.label,
        method="GET",
        path="/deals/me/deals",
        token=actor_a.token,
        expected_statuses=[200],
    )
    runner.step(
        step_id="lists.b.my_applications",
        role=actor_b.label,
        method="GET",
        path="/deals/me/applications",
        token=actor_b.token,
        params={"limit": 20, "offset": 0},
        expected_statuses=[200],
    )
    my_requests_in_supply = runner.step(
        step_id="lists.b.my_requests_in_supply",
        role=actor_b.label,
        method="GET",
        path="/deals/me/requests",
        token=actor_b.token,
        params={"requestType": "inSupply", "limit": 20, "offset": 0},
        expected_statuses=[200],
    )
    my_requests_direct = runner.step(
        step_id="lists.b.my_requests_direct",
        role=actor_b.label,
        method="GET",
        path="/deals/me/requests",
        token=actor_b.token,
        params={"requestType": "direct", "limit": 20, "offset": 0},
        expected_statuses=[200],
    )
    if not runner.has_request_item_fields(my_requests_in_supply):
        runner.blocked_step(
            step_id="lists.b.my_requests_in_supply.shape",
            role=actor_b.label,
            method="GET",
            path="/deals/me/requests",
            reason="response missing request item fields",
            expected_statuses=[200],
        )
    if direct_request_id and not runner.has_request_item_fields(my_requests_direct):
        runner.blocked_step(
            step_id="lists.b.my_requests_direct.shape",
            role=actor_b.label,
            method="GET",
            path="/deals/me/requests",
            reason="direct response missing request item fields",
            expected_statuses=[200],
        )

    room_resp = runner.step(
        step_id="a.create_chat_room",
        role=actor_a.label,
        method="POST",
        path="/chats",
        token=actor_a.token,
        payload={"targetCompanyId": actor_b.company_id},
        expected_status_family="2xx",
    )
    room_id = runner.extract_id(runner.extract_data(room_resp), ["id", "roomId"])

    runner.step(
        step_id="a.chats_list",
        role=actor_a.label,
        method="GET",
        path="/chats",
        token=actor_a.token,
        expected_statuses=[200],
    )

    if room_id:
        runner.step(
            step_id="a.chat_room_details",
            role=actor_a.label,
            method="GET",
            path=f"/chats/{room_id}",
            token=actor_a.token,
            expected_statuses=[200],
        )
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
        runner.step(
            step_id="b.chat_mark_read",
            role=actor_b.label,
            method="POST",
            path=f"/chats/{room_id}/read",
            token=actor_b.token,
            expected_status_family="2xx",
        )
        runner.step(
            step_id="a.chat_archive",
            role=actor_a.label,
            method="PATCH",
            path=f"/chats/{room_id}/archive",
            token=actor_a.token,
            expected_status_family="2xx",
        )

    runner.step(
        step_id="a.logout",
        role=actor_a.label,
        method="POST",
        path="/auth/logout",
        token=actor_a.token,
        expected_status_family="2xx",
    )
    runner.step(
        step_id="a.login_again",
        role=actor_a.label,
        method="POST",
        path="/auth/login",
        payload={"email": actor_a.email, "password": common_password},
        expected_statuses=[200],
    )

    if deal_id:
        runner.step(
            step_id="requests.validation.removed_fields_negative",
            role=actor_b.label,
            method="POST",
            path=f"/deals/{deal_id}/requests",
            token=actor_b.token,
            payload={
                "requestKind": "rfq",
                "requestType": "inSupply",
                "supplyDetails": {
                    "productServiceName": "Legacy invalid payload",
                    "category": "rawMaterial",
                    "supplyType": "inStock",
                    "colorFinish": "red",
                },
            },
            expected_statuses=[400],
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
        ("negative.unauth.users_me", "GET", "/users/me", [401], None),
        ("negative.unauth.files_upload", "POST", "/files/upload-url", [401], None),
        ("negative.removed.admin", "GET", "/admin/companies", [404], None),
        ("negative.removed.ads", "GET", "/ads/active", [404], None),
        ("negative.removed.notifications", "GET", "/notifications", [404], None),
        (
            "negative.removed.auth_admin",
            "POST",
            "/auth/admin/login",
            [404],
            {"email": "admin@indeal.local", "password": "Password123!"},
        ),
    ]

    for step_id, method, path, expected, payload in negative_cases:
        runner.step(
            step_id=step_id,
            role="guest",
            method=method,
            path=path,
            payload=payload,
            expected_statuses=expected,
        )

    runner.step(
        step_id="negative.removed.devices.authenticated_missing_route",
        role=actor_b.label,
        method="GET",
        path="/users/me/devices",
        token=actor_b.token,
        expected_statuses=[404],
    )

    runner.save(
        OUTPUT_FILE,
        extra_meta={
            "scenario": "v1_run_all_mixed",
            "contractsAligned": True,
            "scenarioVersion": "2026-05-deals-contracts-v1",
            "actors": [actor_a.email, actor_b.email],
        },
    )
    print(f"Saved V1 all API results to {OUTPUT_FILE}")


if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        sys.exit(1)
