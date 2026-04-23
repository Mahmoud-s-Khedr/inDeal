#!/usr/bin/env python3
import os
import sys
import time

from v1_scenario_lib import ScenarioRunner, load_env_files, register_actor


def run():
    load_env_files()
    ts = int(time.time())
    base_url = os.environ.get("BASE_URL", "http://localhost:3000/api/v1")
    output_path = os.environ.get(
        "DEALS_FLOW_OUTPUT_FILE",
        os.path.join("scripts", "output", "deals_flow_results.json"),
    )

    password = f"Password123!{ts}"
    runner = ScenarioRunner(base_url)

    owner = register_actor(
        runner,
        role="deal_owner",
        email=f"v1.deal.owner.{ts}@indeal.test",
        password=password,
        company_name=f"V1 Deal Owner Co {ts}",
        first_name="Deal",
        last_name="Owner",
    )
    applicant = register_actor(
        runner,
        role="deal_applicant",
        email=f"v1.deal.applicant.{ts}@indeal.test",
        password=password,
        company_name=f"V1 Deal Applicant Co {ts}",
        first_name="Deal",
        last_name="Applicant",
    )

    deal_resp = runner.step(
        step_id="owner.create_deal",
        role=owner.label,
        method="POST",
        path="/deals",
        token=owner.token,
        payload={
            "dealName": "V1 Supply Deal",
            "dealDescription": "Deal created by deals_flow.py",
            "dealValue": 50000,
            "dealType": "supply",
            "attachments": [],
        },
        expected_statuses=[201],
    )
    deal_id = runner.extract_id(runner.extract_data(deal_resp), ["id"])

    runner.step(
        step_id="applicant.list_deals",
        role=applicant.label,
        method="GET",
        path="/deals",
        token=applicant.token,
        params={"sortBy": "date", "sortOrder": "desc", "limit": 20},
        expected_statuses=[200],
    )
    runner.step(
        step_id="applicant.get_deal",
        role=applicant.label,
        method="GET",
        path=f"/deals/{deal_id}",
        token=applicant.token,
        expected_statuses=[200],
    )

    cancel_req_resp = runner.step(
        step_id="applicant.submit_request_cancel_path",
        role=applicant.label,
        method="POST",
        path=f"/deals/{deal_id}/requests",
        token=applicant.token,
        payload={
            "requestKind": "supply",
            "supplyDetails": {
                "productServiceName": "Steel sheets",
                "category": "rawMaterial",
                "quantityRequired": 70,
            },
            "attachments": [],
        },
        expected_statuses=[201],
    )
    cancel_req_id = runner.extract_id(runner.extract_data(cancel_req_resp), ["id", "requestId"])

    runner.step(
        step_id="applicant.pause_request",
        role=applicant.label,
        method="PATCH",
        path=f"/deals/requests/{cancel_req_id}/pause",
        token=applicant.token,
        expected_statuses=[200],
    )
    runner.step(
        step_id="applicant.cancel_request",
        role=applicant.label,
        method="PATCH",
        path=f"/deals/requests/{cancel_req_id}/cancel",
        token=applicant.token,
        payload={"cancelReason": "Found another supplier"},
        expected_statuses=[200],
    )

    accepted_req_resp = runner.step(
        step_id="applicant.submit_request_accept_path",
        role=applicant.label,
        method="POST",
        path=f"/deals/{deal_id}/requests",
        token=applicant.token,
        payload={
            "requestKind": "demand",
            "demandDetails": {
                "productServiceName": "Steel sheets",
                "availableQuantity": 120,
                "unitPrice": 410,
                "currency": "USD",
            },
            "attachments": [],
        },
        expected_statuses=[201],
    )
    accepted_req_id = runner.extract_id(runner.extract_data(accepted_req_resp), ["id", "requestId"])

    runner.step(
        step_id="owner.list_requests",
        role=owner.label,
        method="GET",
        path=f"/deals/{deal_id}/requests",
        token=owner.token,
        expected_statuses=[200],
    )
    runner.step(
        step_id="owner.accept_request",
        role=owner.label,
        method="PATCH",
        path=f"/deals/{deal_id}/requests/{accepted_req_id}/status",
        token=owner.token,
        payload={"status": "accepted"},
        expected_statuses=[200],
    )

    withdraw_req_resp = runner.step(
        step_id="applicant.submit_request_withdraw_alias",
        role=applicant.label,
        method="POST",
        path=f"/deals/{deal_id}/requests",
        token=applicant.token,
        payload={
            "requestKind": "rfq",
            "supplyDetails": {
                "productServiceName": "Steel sheets",
                "category": "rawMaterial",
                "quantityRequired": 50,
            },
            "attachments": [],
        },
        expected_statuses=[201],
    )
    withdraw_req_id = runner.extract_id(runner.extract_data(withdraw_req_resp), ["id", "requestId"])

    runner.step(
        step_id="applicant.withdraw_alias",
        role=applicant.label,
        method="DELETE",
        path=f"/deals/requests/{withdraw_req_id}",
        token=applicant.token,
        params={"cancelReason": "No longer interested"},
        expected_statuses=[200],
    )

    runner.step(
        step_id="owner.close_deal",
        role=owner.label,
        method="PUT",
        path=f"/deals/{deal_id}",
        token=owner.token,
        payload={"status": "closed"},
        expected_statuses=[200],
    )
    runner.step(
        step_id="owner.reopen_deal",
        role=owner.label,
        method="PUT",
        path=f"/deals/{deal_id}",
        token=owner.token,
        payload={"status": "open"},
        expected_statuses=[200],
    )

    runner.step(
        step_id="owner.my_deals",
        role=owner.label,
        method="GET",
        path="/deals/me/deals",
        token=owner.token,
        expected_statuses=[200],
    )
    runner.step(
        step_id="applicant.my_requests",
        role=applicant.label,
        method="GET",
        path="/deals/me/requests",
        token=applicant.token,
        expected_statuses=[200],
    )

    runner.step(
        step_id="owner.archive_deal",
        role=owner.label,
        method="DELETE",
        path=f"/deals/{deal_id}",
        token=owner.token,
        expected_statuses=[200],
    )

    runner.step(
        step_id="negative.removed_ads",
        role="guest",
        method="GET",
        path="/ads/active",
        expected_statuses=[404],
    )

    runner.save(
        output_path,
        extra_meta={
            "scenario": "v1_deals_flow",
            "ownerEmail": owner.email,
            "applicantEmail": applicant.email,
        },
    )
    print(f"Saved deals flow results to {output_path}")


if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        sys.exit(1)
