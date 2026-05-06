#!/usr/bin/env python3
"""
V1 scenario orchestrator.

Simulates a realistic multi-company client journey with mixed coverage.
"""

import os
import sys
import time

from v1_scenario_lib import (
    Actor,
    ScenarioRunner,
    build_direct_request_payload,
    build_in_supply_request_payload,
    build_supply_details,
    build_password_reset_debug_otp,
    create_file_for_actor,
    load_env_files,
    register_actor,
    resolve_base_url,
)

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUTPUT_FILE = os.environ.get(
    "SIMULATE_ALL_OUTPUT_FILE",
    os.path.join(PROJECT_ROOT, "scripts", "output", "simulate_all_results.json"),
)


def setup_company_assets(runner: ScenarioRunner, actor: Actor, tag: str):
    file_id = create_file_for_actor(runner, actor, f"simulate-{tag}")

    runner.step(
        step_id=f"{actor.label}.company.get",
        role=actor.label,
        method="GET",
        path="/companies/me",
        token=actor.token,
        expected_statuses=[200],
    )
    runner.step(
        step_id=f"{actor.label}.company.update",
        role=actor.label,
        method="PUT",
        path="/companies/me",
        token=actor.token,
        payload={"description": f"Updated from simulate_all ({tag})"},
        expected_statuses=[200],
    )

    gallery_id = None
    if file_id:
        gallery_resp = runner.step(
            step_id=f"{actor.label}.gallery.create",
            role=actor.label,
            method="POST",
            path="/companies/me/gallery",
            token=actor.token,
            payload={"imageFileId": file_id, "description": "Simulate gallery item"},
            expected_statuses=[201],
        )
        gallery_id = runner.extract_id(runner.extract_data(gallery_resp), ["id"])

    doc_id = None
    if file_id:
        doc_resp = runner.step(
            step_id=f"{actor.label}.document.create",
            role=actor.label,
            method="POST",
            path="/companies/me/documents",
            token=actor.token,
            payload={"fileId": file_id, "description": "Simulate document"},
            expected_statuses=[201],
        )
        doc_id = runner.extract_id(runner.extract_data(doc_resp), ["id"])

    contribution_id = None
    if file_id:
        contribution_resp = runner.step(
            step_id=f"{actor.label}.contribution.create",
            role=actor.label,
            method="POST",
            path="/companies/me/contributions",
            token=actor.token,
            payload={
                "type": "project",
                "title": f"{actor.label} project",
                "description": "Contribution from simulate_all",
                "mediaType": "image",
                "mediaFileId": file_id,
            },
            expected_statuses=[201],
        )
        contribution_id = runner.extract_id(runner.extract_data(contribution_resp), ["id"])

    return {
        "fileId": file_id,
        "galleryId": gallery_id,
        "documentId": doc_id,
        "contributionId": contribution_id,
    }


def run():
    load_env_files()
    ts = int(time.time())
    base_url = resolve_base_url()
    runner = ScenarioRunner(base_url)

    password = f"Password123!{ts}"
    a = register_actor(
        runner,
        role="agent_a",
        email=f"v1.sim.a.{ts}@indeal.test",
        password=password,
        company_name=f"V1 Sim A {ts}",
        first_name="Sim",
        last_name="A",
    )
    b = register_actor(
        runner,
        role="agent_b",
        email=f"v1.sim.b.{ts}@indeal.test",
        password=password,
        company_name=f"V1 Sim B {ts}",
        first_name="Sim",
        last_name="B",
    )
    c = register_actor(
        runner,
        role="agent_c",
        email=f"v1.sim.c.{ts}@indeal.test",
        password=password,
        company_name=f"V1 Sim C {ts}",
        first_name="Sim",
        last_name="C",
    )

    actors = [a, b, c]

    # Guest coverage
    for step_id, path in [
        ("guest.health", "/health"),
        ("guest.system", "/system/config"),
        ("guest.company_search", "/companies/search"),
        ("guest.deals", "/deals"),
    ]:
        runner.step(
            step_id=step_id,
            role="guest",
            method="GET",
            path=path,
            expected_status_family="2xx",
        )

    # Per-actor company setup
    actor_assets = {}
    for idx, actor in enumerate(actors, start=1):
        actor_assets[actor.label] = setup_company_assets(runner, actor, f"{idx}")

    # Deal matrix
    deal_ids = {}
    for actor in actors:
        deal_resp = runner.step(
            step_id=f"deals.{actor.label}.create",
            role=actor.label,
            method="POST",
            path="/deals",
            token=actor.token,
            payload={
                "dealName": f"Deal by {actor.label}",
                "dealDescription": "Created in simulate_all",
                "dealValue": 90000,
                "dealType": "supply",
                "attachments": [],
            },
            expected_statuses=[201],
        )
        deal_ids[actor.label] = runner.extract_id(runner.extract_data(deal_resp), ["id"])

    # B submits request on A deal -> accepted
    req_b_a_resp = runner.step(
        step_id="requests.in_supply.agent_b_on_a.submit",
        role=b.label,
        method="POST",
        path=f"/deals/{deal_ids[a.label]}/requests",
        token=b.token,
        payload=build_in_supply_request_payload(
            "supply",
            supply_details=build_supply_details("Packaging cartons", category="packingAndContainers"),
        ),
        expected_statuses=[201],
    )
    req_b_a_id = runner.require_id(
        runner.extract_data(req_b_a_resp),
        keys=["id", "requestId"],
        context="requests.in_supply.agent_b_on_a.submit",
    )
    if req_b_a_id:
        runner.step(
            step_id="requests.owner.agent_a.accept_b",
            role=a.label,
            method="PATCH",
            path=f"/deals/{deal_ids[a.label]}/requests/{req_b_a_id}/status",
            token=a.token,
            payload={"status": "accepted"},
            expected_statuses=[200],
        )
    else:
        runner.blocked_step(
            step_id="requests.owner.agent_a.accept_b",
            role=a.label,
            method="PATCH",
            path="/deals/<dealId>/requests/<requestId>/status",
            reason="missing request id from agent_b.request_on_a",
            expected_statuses=[200],
        )

    # C submits request on A deal -> cancel
    req_c_a_resp = runner.step(
        step_id="requests.in_supply.agent_c_on_a.submit",
        role=c.label,
        method="POST",
        path=f"/deals/{deal_ids[a.label]}/requests",
        token=c.token,
        payload=build_in_supply_request_payload("demand"),
        expected_statuses=[201],
    )
    req_c_a_id = runner.require_id(
        runner.extract_data(req_c_a_resp),
        keys=["id", "requestId"],
        context="requests.in_supply.agent_c_on_a.submit",
    )
    if req_c_a_id:
        runner.step(
            step_id="requests.applicant.agent_c.cancel",
            role=c.label,
            method="PATCH",
            path=f"/deals/requests/{req_c_a_id}/cancel",
            token=c.token,
            payload={"cancelReason": "No capacity this month"},
            expected_statuses=[200],
        )
    else:
        runner.blocked_step(
            step_id="requests.applicant.agent_c.cancel",
            role=c.label,
            method="PATCH",
            path="/deals/requests/<requestId>/cancel",
            reason="missing request id from agent_c.request_on_a",
            expected_statuses=[200],
        )

    # review path
    runner.step(
        step_id="agent_b.review_agent_a_company",
        role=b.label,
        method="POST",
        path=f"/companies/{a.company_id}/reviews",
        token=b.token,
        payload={
            "dealId": deal_ids[a.label],
            "rating": 5,
            "reviewText": "Smooth process and clear communication.",
        },
        expected_statuses=[201],
    )

    # chat path
    room_resp = runner.step(
        step_id="agent_a.chat_room_with_b",
        role=a.label,
        method="POST",
        path="/chats",
        token=a.token,
        payload={"targetCompanyId": b.company_id},
        expected_statuses=[201],
    )
    room_id = runner.extract_id(runner.extract_data(room_resp), ["id", "roomId"])
    runner.step(
        step_id="agent_a.chat_send",
        role=a.label,
        method="POST",
        path=f"/chats/{room_id}/messages",
        token=a.token,
        payload={"messageText": "Message from simulate_all agent_a"},
        expected_statuses=[201],
    )
    runner.step(
        step_id="agent_b.chat_read",
        role=b.label,
        method="POST",
        path=f"/chats/{room_id}/read",
        token=b.token,
        payload={},
        expected_statuses=[200],
    )
    runner.step(
        step_id="agent_a.chat_archive",
        role=a.label,
        method="PATCH",
        path=f"/chats/{room_id}/archive",
        token=a.token,
        expected_statuses=[200],
    )

    # forgot/reset flow with dev OTP
    forgot_resp = runner.step(
        step_id="agent_c.forgot_password",
        role=c.label,
        method="POST",
        path="/auth/forgot-password",
        payload={"email": c.email},
        expected_statuses=[200],
    )
    otp = build_password_reset_debug_otp(forgot_resp)
    if otp:
        new_password = f"NewPass!{ts}"
        runner.step(
            step_id="agent_c.verify_otp",
            role=c.label,
            method="POST",
            path="/auth/verify-otp",
            payload={"email": c.email, "otp": otp},
            expected_statuses=[200],
        )
        runner.step(
            step_id="agent_c.reset_password",
            role=c.label,
            method="POST",
            path="/auth/reset-password",
            payload={
                "email": c.email,
                "otp": otp,
                "password": new_password,
                "confirmPassword": new_password,
            },
            expected_statuses=[200],
        )
        runner.step(
            step_id="agent_c.login_new_password",
            role=c.label,
            method="POST",
            path="/auth/login",
            payload={"email": c.email, "password": new_password},
            expected_statuses=[200],
        )

    owner_requests_resp = runner.step(
        step_id="lists.owner.agent_a_requests",
        role=a.label,
        method="GET",
        path=f"/deals/{deal_ids[a.label]}/requests",
        token=a.token,
        expected_statuses=[200],
    )
    if not runner.has_request_list_shape(owner_requests_resp):
        runner.blocked_step(
            step_id="lists.owner.agent_a_requests.shape",
            role=a.label,
            method="GET",
            path=f"/deals/{deal_ids[a.label]}/requests",
            reason="response missing requests/stats shape",
            expected_statuses=[200],
        )

    direct_resp = runner.step(
        step_id="direct.agent_c_to_b.submit",
        role=c.label,
        method="POST",
        path="/deals/direct-requests",
        token=c.token,
        payload=build_direct_request_payload(b.company_id),
        expected_statuses=[201],
    )
    direct_request_id = runner.extract_id(runner.extract_data(direct_resp), ["id", "requestId"])

    runner.step(
        step_id="lists.agent_c.my_applications",
        role=c.label,
        method="GET",
        path="/deals/me/applications",
        token=c.token,
        params={"limit": 20, "offset": 0},
        expected_statuses=[200],
    )
    reqs_in_supply = runner.step(
        step_id="lists.agent_c.my_requests_in_supply",
        role=c.label,
        method="GET",
        path="/deals/me/requests",
        token=c.token,
        params={"requestType": "inSupply", "limit": 20, "offset": 0},
        expected_statuses=[200],
    )
    reqs_direct = runner.step(
        step_id="lists.agent_c.my_requests_direct",
        role=c.label,
        method="GET",
        path="/deals/me/requests",
        token=c.token,
        params={"requestType": "direct", "limit": 20, "offset": 0},
        expected_statuses=[200],
    )
    if not runner.has_request_item_fields(reqs_in_supply):
        runner.blocked_step(
            step_id="lists.agent_c.my_requests_in_supply.shape",
            role=c.label,
            method="GET",
            path="/deals/me/requests",
            reason="response missing request item fields",
            expected_statuses=[200],
        )
    if direct_request_id and not runner.has_request_item_fields(reqs_direct):
        runner.blocked_step(
            step_id="lists.agent_c.my_requests_direct.shape",
            role=c.label,
            method="GET",
            path="/deals/me/requests",
            reason="direct response missing request item fields",
            expected_statuses=[200],
        )

    if direct_request_id:
        runner.step(
            step_id="requests.applicant.agent_c.pause_direct",
            role=c.label,
            method="PATCH",
            path=f"/deals/requests/{direct_request_id}/pause",
            token=c.token,
            expected_statuses=[200],
        )
        runner.step(
            step_id="requests.applicant.agent_c.cancel_direct",
            role=c.label,
            method="PATCH",
            path=f"/deals/requests/{direct_request_id}/cancel",
            token=c.token,
            payload={"cancelReason": "No longer needed"},
            expected_statuses=[200],
        )

    runner.step(
        step_id="requests.validation.removed_fields_negative",
        role=c.label,
        method="POST",
        path=f"/deals/{deal_ids[a.label]}/requests",
        token=c.token,
        payload={
            "requestKind": "rfq",
            "requestType": "inSupply",
            "supplyDetails": {
                "productServiceName": "Invalid legacy payload",
                "category": "rawMaterial",
                "supplyType": "inStock",
                "stockDeliveryTime": "7 days",
            },
        },
        expected_statuses=[400],
    )

    # Removed namespace checks
    removed_checks = [
        ("removed.admin", "GET", "/admin/companies"),
        ("removed.ads", "GET", "/ads/active"),
        ("removed.notifications", "GET", "/notifications"),
        ("removed.support_info", "GET", "/support/info"),
        ("removed.support_redirect", "GET", "/support/email-redirect"),
        ("removed.support_tickets", "GET", "/support/tickets"),
        ("removed.support_chat", "GET", "/support/chat"),
        ("removed.devices.guest_unauthorized", "GET", "/users/me/devices"),
        ("removed.auth_admin", "POST", "/auth/admin/login"),
    ]

    for step_id, method, path in removed_checks:
        payload = None
        if path == "/auth/admin/login":
            payload = {"email": "admin@indeal.local", "password": "Password123!"}
        expected = [401] if step_id == "removed.devices.guest_unauthorized" else [404]
        runner.step(
            step_id=step_id,
            role="guest",
            method=method,
            path=path,
            payload=payload,
            expected_statuses=expected,
        )

    runner.step(
        step_id="removed.devices.authenticated_missing_route",
        role=a.label,
        method="GET",
        path="/users/me/devices",
        token=a.token,
        expected_statuses=[404],
    )

    # unauthorized check sample
    runner.step(
        step_id="negative.unauthorized_users_me",
        role="guest",
        method="GET",
        path="/users/me",
        expected_statuses=[401],
    )

    runner.save(
        OUTPUT_FILE,
        extra_meta={
            "scenario": "v1_simulate_all",
            "contractsAligned": True,
            "scenarioVersion": "2026-05-deals-contracts-v1",
            "actors": [a.email, b.email, c.email],
            "deals": deal_ids,
        },
    )
    print(f"Saved simulate_all results to {OUTPUT_FILE}")


if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        sys.exit(1)
