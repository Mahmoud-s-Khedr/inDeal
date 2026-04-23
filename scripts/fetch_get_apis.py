#!/usr/bin/env python3
import os
import sys
import time

from v1_scenario_lib import ScenarioRunner, load_env_files, register_actor


PUBLIC_GET_ENDPOINTS = [
    "/health",
    "/system/stats",
    "/system/config",
    "/companies/search",
    "/deals",
    "/support/info",
    "/support/email-redirect",
]

AUTH_GET_ENDPOINTS = [
    "/users/me",
    "/companies/me",
    "/companies/me/gallery",
    "/companies/me/documents",
    "/companies/me/contributions",
    "/deals/me/deals",
    "/deals/me/requests",
    "/chats",
]

REMOVED_EXPECTED_404 = [
    "/admin/companies",
    "/ads/active",
    "/notifications",
    "/support/tickets",
    "/support/chat",
    "/auth/admin/login",
    "/auth/resend-verification",
    "/auth/verify-email",
]


def run():
    load_env_files()
    ts = int(time.time())
    base_url = os.environ.get("BASE_URL", "http://localhost:3000/api/v1")
    output_path = os.environ.get(
        "GET_API_OUTPUT_FILE",
        os.path.join("scripts", "output", "get_api_responses.json"),
    )

    password = f"Password123!{ts}"
    runner = ScenarioRunner(base_url)

    actor = register_actor(
        runner,
        role="get_actor",
        email=f"v1.get.actor.{ts}@indeal.test",
        password=password,
        company_name=f"V1 GET Actor Co {ts}",
        first_name="Get",
        last_name="Actor",
    )

    for idx, path in enumerate(PUBLIC_GET_ENDPOINTS, start=1):
        runner.step(
            step_id=f"public.get.{idx}",
            role="guest",
            method="GET",
            path=path,
            expected_status_family="2xx",
        )

    for idx, path in enumerate(AUTH_GET_ENDPOINTS, start=1):
        runner.step(
            step_id=f"auth.get.{idx}",
            role=actor.label,
            method="GET",
            path=path,
            token=actor.token,
            expected_status_family="2xx",
        )

    runner.step(
        step_id="auth.get.company_public_profile",
        role=actor.label,
        method="GET",
        path=f"/companies/{actor.company_id}",
        token=actor.token,
        expected_statuses=[200],
    )

    for idx, path in enumerate(REMOVED_EXPECTED_404, start=1):
        runner.step(
            step_id=f"removed.get.{idx}",
            role="guest",
            method="GET",
            path=path,
            expected_statuses=[404],
        )

    runner.step(
        step_id="removed.devices.guest_unauthorized",
        role="guest",
        method="GET",
        path="/users/me/devices",
        expected_statuses=[401],
    )
    runner.step(
        step_id="removed.devices.authenticated_missing_route",
        role=actor.label,
        method="GET",
        path="/users/me/devices",
        token=actor.token,
        expected_statuses=[404],
    )

    runner.save(
        output_path,
        extra_meta={"scenario": "v1_get_matrix", "actorEmail": actor.email},
    )
    print(f"Saved GET API responses to {output_path}")


if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        sys.exit(1)
