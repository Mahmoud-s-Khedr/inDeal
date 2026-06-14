#!/usr/bin/env python3
import os
import sys
import time

from v1_scenario_lib import (
    ScenarioRunner,
    build_direct_request_payload,
    build_in_supply_request_payload,
    build_supply_details,
    load_env_files,
    register_actor,
    resolve_base_url,
)


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

    deal_cancel_id = create_deal("deals.owner.create.cancel_track", "V1 Supply Deal - Cancel")
    deal_accept_id = create_deal("deals.owner.create.accept_track", "V1 Supply Deal - Accept")
    deal_withdraw_id = create_deal("deals.owner.create.withdraw_track", "V1 Supply Deal - Withdraw")

    runner.step(
        step_id="lists.owner.my_deals",
        role=owner.label,
        method="GET",
        path="/deals/me/deals",
        token=owner.token,
        expected_statuses=[200],
    )

    if deal_accept_id:
        runner.step(
            step_id="deals.applicant.get_detail",
            role=applicant.label,
            method="GET",
            path=f"/deals/{deal_accept_id}",
            token=applicant.token,
            expected_statuses=[200],
        )

    cancel_req_id = None
    if deal_cancel_id:
        cancel_req_resp = runner.step(
            step_id="requests.in_supply.submit.cancel_track",
            role=applicant.label,
            method="POST",
            path=f"/deals/{deal_cancel_id}/requests",
            token=applicant.token,
            payload=build_in_supply_request_payload(
                "supply",
                supply_details=build_supply_details("Steel sheets"),
            ),
            expected_statuses=[201],
        )
        cancel_req_id = runner.require_id(
            runner.extract_data(cancel_req_resp),
            keys=["id", "requestId"],
            context="requests.in_supply.submit.cancel_track",
        )

    if cancel_req_id:
        runner.step(
            step_id="requests.applicant.pause",
            role=applicant.label,
            method="PATCH",
            path=f"/deals/requests/{cancel_req_id}/pause",
            token=applicant.token,
            expected_statuses=[200],
        )
        runner.step(
            step_id="requests.applicant.cancel",
            role=applicant.label,
            method="PATCH",
            path=f"/deals/requests/{cancel_req_id}/cancel",
            token=applicant.token,
            payload={"cancelReason": "Found another supplier"},
            expected_statuses=[200],
        )
        runner.step(
            step_id="requests.in_supply.reapply_after_cancel",
            role=applicant.label,
            method="POST",
            path=f"/deals/{deal_cancel_id}/requests",
            token=applicant.token,
            payload=build_in_supply_request_payload(
                "supply",
                supply_details=build_supply_details("Steel sheets"),
            ),
            expected_statuses=[201],
        )
    else:
        runner.blocked_step(
            step_id="requests.applicant.pause",
            role=applicant.label,
            method="PATCH",
            path="/deals/requests/<requestId>/pause",
            reason="missing request id from applicant.submit_request_cancel_path",
            expected_statuses=[200],
        )
        runner.blocked_step(
            step_id="requests.applicant.cancel",
            role=applicant.label,
            method="PATCH",
            path="/deals/requests/<requestId>/cancel",
            reason="missing request id from applicant.submit_request_cancel_path",
            expected_statuses=[200],
        )

    accepted_req_id = None
    if deal_accept_id:
        accepted_req_resp = runner.step(
            step_id="requests.in_supply.submit.accept_track",
            role=applicant.label,
            method="POST",
            path=f"/deals/{deal_accept_id}/requests",
            token=applicant.token,
            payload=build_in_supply_request_payload("demand"),
            expected_statuses=[201],
        )
        accepted_req_id = runner.require_id(
            runner.extract_data(accepted_req_resp),
            keys=["id", "requestId"],
            context="requests.in_supply.submit.accept_track",
        )

        owner_list_resp = runner.step(
            step_id="lists.owner.deal_requests",
            role=owner.label,
            method="GET",
            path=f"/deals/{deal_accept_id}/requests",
            token=owner.token,
            expected_statuses=[200],
        )
        if not runner.has_request_list_shape(owner_list_resp):
            runner.blocked_step(
                step_id="lists.owner.deal_requests.shape",
                role=owner.label,
                method="GET",
                path=f"/deals/{deal_accept_id}/requests",
                reason="response missing requests/stats shape",
                expected_statuses=[200],
            )

    if deal_accept_id and accepted_req_id:
        runner.step(
            step_id="requests.owner.accept",
            role=owner.label,
            method="PATCH",
            path=f"/deals/{deal_accept_id}/requests/{accepted_req_id}/status",
            token=owner.token,
            payload={"status": "accepted"},
            expected_statuses=[200],
        )
        runner.step(
            step_id="requests.owner.reject_after_accept_negative",
            role=owner.label,
            method="PATCH",
            path=f"/deals/{deal_accept_id}/requests/{accepted_req_id}/status",
            token=owner.token,
            payload={"status": "rejected"},
            expected_statuses=[400],
        )
    else:
        runner.blocked_step(
            step_id="requests.owner.accept",
            role=owner.label,
            method="PATCH",
            path="/deals/<dealId>/requests/<requestId>/status",
            reason="accept track missing deal id or request id",
            expected_statuses=[200],
        )

    withdraw_req_id = None
    if deal_withdraw_id:
        withdraw_req_resp = runner.step(
            step_id="requests.in_supply.submit.withdraw_alias_track",
            role=applicant.label,
            method="POST",
            path=f"/deals/{deal_withdraw_id}/requests",
            token=applicant.token,
            payload=build_in_supply_request_payload(
                "rfq",
                supply_details=build_supply_details("Steel sheets"),
            ),
            expected_statuses=[201],
        )
        withdraw_req_id = runner.require_id(
            runner.extract_data(withdraw_req_resp),
            keys=["id", "requestId"],
            context="requests.in_supply.submit.withdraw_alias_track",
        )

    if withdraw_req_id:
        runner.step(
            step_id="requests.applicant.withdraw_alias",
            role=applicant.label,
            method="DELETE",
            path=f"/deals/requests/{withdraw_req_id}",
            token=applicant.token,
            params={"cancelReason": "No longer interested"},
            expected_statuses=[200],
        )
    else:
        runner.blocked_step(
            step_id="requests.applicant.withdraw_alias",
            role=applicant.label,
            method="DELETE",
            path="/deals/requests/<requestId>",
            reason="missing request id from applicant.submit_request_withdraw_alias",
            expected_statuses=[200],
        )

    direct_resp = runner.step(
        step_id="direct.applicant.submit",
        role=applicant.label,
        method="POST",
        path="/deals/direct-requests",
        token=applicant.token,
        payload=build_direct_request_payload(owner.company_id),
        expected_statuses=[201],
    )
    direct_request_id = runner.require_id(
        runner.extract_data(direct_resp),
        keys=["id", "requestId"],
        context="direct.applicant.submit",
    )

    runner.step(
        step_id="lists.applicant.my_applications",
        role=applicant.label,
        method="GET",
        path="/deals/me/applications",
        token=applicant.token,
        params={"limit": 20, "offset": 0},
        expected_statuses=[200],
    )
    my_requests_in_supply = runner.step(
        step_id="lists.applicant.my_requests_in_supply",
        role=applicant.label,
        method="GET",
        path="/deals/me/requests",
        token=applicant.token,
        params={"limit": 20, "offset": 0},
        expected_statuses=[200],
    )
    my_requests_direct = runner.step(
        step_id="lists.applicant.my_requests_direct",
        role=applicant.label,
        method="GET",
        path="/deals/me/direct-requests",
        token=applicant.token,
        params={"limit": 20, "offset": 0},
        expected_statuses=[200],
    )
    if not runner.has_request_item_fields(my_requests_in_supply):
        runner.blocked_step(
            step_id="lists.applicant.my_requests_in_supply.shape",
            role=applicant.label,
            method="GET",
            path="/deals/me/requests",
            reason="response missing request item fields",
            expected_statuses=[200],
        )
    if direct_request_id and not runner.has_request_item_fields(my_requests_direct):
        runner.blocked_step(
            step_id="lists.applicant.my_requests_direct.shape",
            role=applicant.label,
            method="GET",
            path="/deals/me/direct-requests",
            reason="direct response missing request item fields",
            expected_statuses=[200],
        )

    if direct_request_id:
        runner.step(
            step_id="requests.applicant.pause_direct",
            role=applicant.label,
            method="PATCH",
            path=f"/deals/requests/{direct_request_id}/pause",
            token=applicant.token,
            expected_statuses=[200],
        )
        runner.step(
            step_id="requests.applicant.cancel_direct",
            role=applicant.label,
            method="PATCH",
            path=f"/deals/requests/{direct_request_id}/cancel",
            token=applicant.token,
            payload={"cancelReason": "Cancel direct path"},
            expected_statuses=[200],
        )

    if deal_cancel_id:
        runner.step(
            step_id="requests.validation.removed_fields_negative",
            role=applicant.label,
            method="POST",
            path=f"/deals/{deal_cancel_id}/requests",
            token=applicant.token,
            payload={
                "requestKind": "rfq",
                "requestType": "inSupply",
                "supplyDetails": {
                    "productServiceName": "Legacy invalid payload",
                    "category": "rawMaterial",
                    "supplyType": "inStock",
                    "stockDeliveryTime": "2 weeks",
                },
            },
            expected_statuses=[400],
        )

    if deal_accept_id:
        runner.step(
            step_id="deals.owner.update",
            role=owner.label,
            method="PUT",
            path=f"/deals/{deal_accept_id}",
            token=owner.token,
            payload={"dealDescription": "Updated by deals_flow"},
            expected_statuses=[200],
        )
        runner.step(
            step_id="deals.owner.archive",
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
            "contractsAligned": True,
            "scenarioVersion": "2026-05-deals-contracts-v1",
            "actors": [owner.email, applicant.email],
        },
    )
    print(f"Saved deals flow results to {output_path}")


if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        sys.exit(1)
