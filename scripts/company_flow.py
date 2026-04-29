#!/usr/bin/env python3
import os
import sys
import time

from v1_scenario_lib import (
    ScenarioRunner,
    create_file_for_actor,
    load_env_files,
    register_actor,
)


def run():
    load_env_files()
    ts = int(time.time())
    base_url = os.environ.get("BASE_URL", "http://localhost:3000/api/v1")
    output_path = os.environ.get(
        "COMPANY_FLOW_OUTPUT_FILE",
        os.path.join("scripts", "output", "company_flow_results.json"),
    )

    password = f"Password123!{ts}"
    runner = ScenarioRunner(base_url)

    actor_a = register_actor(
        runner,
        role="company_admin_a",
        email=f"v1.company.a.{ts}@indeal.test",
        password=password,
        company_name=f"V1 Company A {ts}",
        first_name="Company",
        last_name="OwnerA",
    )
    actor_b = register_actor(
        runner,
        role="company_admin_b",
        email=f"v1.company.b.{ts}@indeal.test",
        password=password,
        company_name=f"V1 Company B {ts}",
        first_name="Company",
        last_name="OwnerB",
    )

    file_id = create_file_for_actor(runner, actor_a, "company-flow")

    runner.step(
        step_id="a.get_company_me",
        role=actor_a.label,
        method="GET",
        path="/companies/me",
        token=actor_a.token,
        expected_statuses=[200],
    )
    runner.step(
        step_id="a.update_company_me",
        role=actor_a.label,
        method="PUT",
        path="/companies/me",
        token=actor_a.token,
        payload={"description": "Updated from company_flow v1"},
        expected_statuses=[200],
    )
    gallery_id = None
    if file_id:
        gallery_resp = runner.step(
            step_id="a.gallery.create",
            role=actor_a.label,
            method="POST",
            path="/companies/me/gallery",
            token=actor_a.token,
            payload={"imageFileId": file_id, "description": "Gallery from v1 flow"},
            expected_statuses=[201],
        )
        gallery_id = runner.extract_id(runner.extract_data(gallery_resp), ["id"])

    if gallery_id:
        runner.step(
            step_id="a.gallery.update",
            role=actor_a.label,
            method="PUT",
            path=f"/companies/me/gallery/{gallery_id}",
            token=actor_a.token,
            payload={"description": "Gallery updated in v1 flow"},
            expected_statuses=[200],
        )
        runner.step(
            step_id="a.gallery.list",
            role=actor_a.label,
            method="GET",
            path="/companies/me/gallery",
            token=actor_a.token,
            expected_statuses=[200],
        )

    document_id = None
    if file_id:
        doc_resp = runner.step(
            step_id="a.document.create",
            role=actor_a.label,
            method="POST",
            path="/companies/me/documents",
            token=actor_a.token,
            payload={"fileId": file_id, "description": "Doc from v1 flow"},
            expected_statuses=[201],
        )
        document_id = runner.extract_id(runner.extract_data(doc_resp), ["id"])

    if document_id:
        runner.step(
            step_id="a.document.update",
            role=actor_a.label,
            method="PUT",
            path=f"/companies/me/documents/{document_id}",
            token=actor_a.token,
            payload={"description": "Doc updated in v1 flow"},
            expected_statuses=[200],
        )

    contribution_id = None
    if file_id:
        contrib_resp = runner.step(
            step_id="a.contribution.create",
            role=actor_a.label,
            method="POST",
            path="/companies/me/contributions",
            token=actor_a.token,
            payload={
                "type": "product",
                "title": "V1 Product Contribution",
                "description": "Added by company_flow.py",
                "mediaFileId": file_id,
                "mediaType": "image",
            },
            expected_statuses=[201],
        )
        contribution_id = runner.extract_id(runner.extract_data(contrib_resp), ["id"])

    media_id = None
    if contribution_id and file_id:
        media_resp = runner.step(
            step_id="a.contribution_media.create",
            role=actor_a.label,
            method="POST",
            path=f"/companies/me/contributions/{contribution_id}/media",
            token=actor_a.token,
            payload={
                "fileId": file_id,
                "mediaType": "image",
                "caption": "Media caption",
                "sortOrder": 0,
            },
            expected_statuses=[201],
        )
        media_id = runner.extract_id(runner.extract_data(media_resp), ["id"])

    if contribution_id and media_id:
        runner.step(
            step_id="a.contribution_media.update",
            role=actor_a.label,
            method="PUT",
            path=f"/companies/me/contributions/{contribution_id}/media/{media_id}",
            token=actor_a.token,
            payload={"caption": "Updated media caption"},
            expected_statuses=[200],
        )
        runner.step(
            step_id="a.contribution_media.reorder",
            role=actor_a.label,
            method="PUT",
            path=f"/companies/me/contributions/{contribution_id}/media/reorder",
            token=actor_a.token,
            payload={"orderedIds": [media_id]},
            expected_statuses=[200],
        )

    runner.step(
        step_id="public.company_b.profile",
        role="guest",
        method="GET",
        path=f"/companies/{actor_b.company_id}",
        expected_statuses=[200],
    )
    runner.step(
        step_id="public.company_b.gallery",
        role="guest",
        method="GET",
        path=f"/companies/{actor_b.company_id}/gallery",
        expected_statuses=[200],
    )
    runner.step(
        step_id="public.company_b.reviews",
        role="guest",
        method="GET",
        path=f"/companies/{actor_b.company_id}/reviews",
        expected_statuses=[200],
    )

    deal_resp = runner.step(
        step_id="a.create_review_deal",
        role=actor_a.label,
        method="POST",
        path="/deals",
        token=actor_a.token,
        payload={
            "dealName": "Company Flow Review Deal",
            "dealDescription": "Deal to unlock review path",
            "dealValue": 12000,
            "dealType": "supply",
            "attachments": [],
        },
        expected_statuses=[201, 403],
    )
    deal_id = runner.require_id(
        runner.extract_data(deal_resp),
        keys=["id"],
        context="a.create_review_deal",
    )
    if deal_id:
        request_resp = runner.step(
            step_id="b.submit_review_request",
            role=actor_b.label,
            method="POST",
            path=f"/deals/{deal_id}/requests",
            token=actor_b.token,
            payload={
                "requestKind": "supply",
                "supplyDetails": {
                    "productServiceName": "Industrial bolts",
                    "category": "industrialEquipment",
                    "quantityRequired": 100,
                },
                "attachments": [],
            },
            expected_statuses=[201],
        )
        request_id = runner.require_id(
            runner.extract_data(request_resp),
            keys=["id", "requestId"],
            context="b.submit_review_request",
        )
        if request_id:
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
                payload={
                    "dealId": deal_id,
                    "rating": 5,
                    "reviewText": "Great collaboration through V1 company flow.",
                },
                expected_statuses=[201],
            )

    runner.step(
        step_id="negative.removed_admin",
        role="guest",
        method="GET",
        path="/admin/companies",
        expected_statuses=[404],
    )

    if contribution_id:
        if media_id:
            runner.step(
                step_id="a.contribution_media.delete",
                role=actor_a.label,
                method="DELETE",
                path=f"/companies/me/contributions/{contribution_id}/media/{media_id}",
                token=actor_a.token,
                expected_statuses=[200],
            )
        runner.step(
            step_id="a.contribution.delete",
            role=actor_a.label,
            method="DELETE",
            path=f"/companies/me/contributions/{contribution_id}",
            token=actor_a.token,
            expected_statuses=[200],
        )

    if document_id:
        runner.step(
            step_id="a.document.delete",
            role=actor_a.label,
            method="DELETE",
            path=f"/companies/me/documents/{document_id}",
            token=actor_a.token,
            expected_statuses=[200],
        )

    if gallery_id:
        runner.step(
            step_id="a.gallery.delete",
            role=actor_a.label,
            method="DELETE",
            path=f"/companies/me/gallery/{gallery_id}",
            token=actor_a.token,
            expected_statuses=[200],
        )

    runner.save(
        output_path,
        extra_meta={
            "scenario": "v1_company_flow",
            "actors": [actor_a.email, actor_b.email],
        },
    )
    print(f"Saved company flow results to {output_path}")


if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        sys.exit(1)
