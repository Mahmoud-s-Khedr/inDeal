#!/usr/bin/env python3
import os
import sys
import time

from v1_scenario_lib import ScenarioRunner, load_env_files, register_actor, resolve_base_url


def run():
    load_env_files()
    ts = int(time.time())
    base_url = resolve_base_url()
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

    def create_deal(step_id: str, name: str):
        deal_resp = runner.step(
            step_id=step_id,
            role=owner.label,
            method="POST",
            path="/deals",
            token=owner.token,
            payload={
                "dealName": name,
                "dealDescription": "Deal created by deals_flow.py",
                "dealValue": 50000,
                "dealType": "supply",
                "attachments": [],
            },
            expected_statuses=[201],
        )
        return runner.require_id(runner.extract_data(deal_resp), keys=["id"], context=step_id)

    runner.step(
        step_id="public.list_deals",
        role="guest",
        method="GET",
        path="/deals",
        params={"sortBy": "date", "sortOrder": "desc", "limit": 20},
        expected_statuses=[200],
    )

    deal_cancel_id = create_deal("owner.create_deal.cancel_track", "V1 Supply Deal - Cancel")
    deal_accept_id = create_deal("owner.create_deal.accept_track", "V1 Supply Deal - Accept")
    deal_withdraw_id = create_deal("owner.create_deal.withdraw_track", "V1 Supply Deal - Withdraw")

    runner.step(
        step_id="owner.my_deals",
        role=owner.label,
        method="GET",
        path="/deals/me/deals",
        token=owner.token,
        expected_statuses=[200],
    )

    if deal_accept_id:
        runner.step(
            step_id="applicant.get_deal",
            role=applicant.label,
            method="GET",
            path=f"/deals/{deal_accept_id}",
            token=applicant.token,
            expected_statuses=[200],
        )

    cancel_req_id = None
    if deal_cancel_id:
        cancel_req_resp = runner.step(
            step_id="applicant.submit_request_cancel_path",
            role=applicant.label,
            method="POST",
            path=f"/deals/{deal_cancel_id}/requests",
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
        cancel_req_id = runner.require_id(
            runner.extract_data(cancel_req_resp),
            keys=["id", "requestId"],
            context="applicant.submit_request_cancel_path",
        )

    if cancel_req_id:
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
        runner.step(
            step_id="applicant.reapply_after_cancel",
            role=applicant.label,
            method="POST",
            path=f"/deals/{deal_cancel_id}/requests",
            token=applicant.token,
            payload={
                "requestKind": "supply",
                "supplyDetails": {
                    "productServiceName": "Steel sheets",
                    "category": "rawMaterial",
                    "quantityRequired": 40,
                },
                "attachments": [],
            },
            expected_statuses=[201],
        )
    else:
        runner.blocked_step(
            step_id="applicant.pause_request",
            role=applicant.label,
            method="PATCH",
            path="/deals/requests/<requestId>/pause",
            reason="missing request id from applicant.submit_request_cancel_path",
            expected_statuses=[200],
        )
        runner.blocked_step(
            step_id="applicant.cancel_request",
            role=applicant.label,
            method="PATCH",
            path="/deals/requests/<requestId>/cancel",
            reason="missing request id from applicant.submit_request_cancel_path",
            expected_statuses=[200],
        )

    accepted_req_id = None
    if deal_accept_id:
        accepted_req_resp = runner.step(
            step_id="applicant.submit_request_accept_path",
            role=applicant.label,
            method="POST",
            path=f"/deals/{deal_accept_id}/requests",
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
        accepted_req_id = runner.require_id(
            runner.extract_data(accepted_req_resp),
            keys=["id", "requestId"],
            context="applicant.submit_request_accept_path",
        )

        runner.step(
            step_id="owner.list_requests",
            role=owner.label,
            method="GET",
            path=f"/deals/{deal_accept_id}/requests",
            token=owner.token,
            expected_statuses=[200],
        )

    if deal_accept_id and accepted_req_id:
        runner.step(
            step_id="owner.accept_request",
            role=owner.label,
            method="PATCH",
            path=f"/deals/{deal_accept_id}/requests/{accepted_req_id}/status",
            token=owner.token,
            payload={"status": "accepted"},
            expected_statuses=[200],
        )
    else:
        runner.blocked_step(
            step_id="owner.accept_request",
            role=owner.label,
            method="PATCH",
            path="/deals/<dealId>/requests/<requestId>/status",
            reason="accept track missing deal id or request id",
            expected_statuses=[200],
        )

    withdraw_req_id = None
    if deal_withdraw_id:
        withdraw_req_resp = runner.step(
            step_id="applicant.submit_request_withdraw_alias",
            role=applicant.label,
            method="POST",
            path=f"/deals/{deal_withdraw_id}/requests",
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
        withdraw_req_id = runner.require_id(
            runner.extract_data(withdraw_req_resp),
            keys=["id", "requestId"],
            context="applicant.submit_request_withdraw_alias",
        )

    if withdraw_req_id:
        runner.step(
            step_id="applicant.withdraw_alias",
            role=applicant.label,
            method="DELETE",
            path=f"/deals/requests/{withdraw_req_id}",
            token=applicant.token,
            params={"cancelReason": "No longer interested"},
            expected_statuses=[200],
        )
    else:
        runner.blocked_step(
            step_id="applicant.withdraw_alias",
            role=applicant.label,
            method="DELETE",
            path="/deals/requests/<requestId>",
            reason="missing request id from applicant.submit_request_withdraw_alias",
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

    if deal_accept_id:
        runner.step(
            step_id="owner.update_deal",
            role=owner.label,
            method="PUT",
            path=f"/deals/{deal_accept_id}",
            token=owner.token,
            payload={"dealDescription": "Updated by deals_flow"},
            expected_statuses=[200],
        )
        runner.step(
            step_id="owner.archive_deal",
            role=owner.label,
            method="DELETE",
            path=f"/deals/{deal_accept_id}",
            token=owner.token,
            expected_statuses=[200],
        )

    runner.save(
        output_path,
        extra_meta={
            "scenario": "v1_deals_flow",
            "actors": [owner.email, applicant.email],
        },
    )
    print(f"Saved deals flow results to {output_path}")


if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        sys.exit(1)
