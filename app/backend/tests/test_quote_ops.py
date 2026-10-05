from types import SimpleNamespace

import pytest

from utils.quote_ops import (
    VALID_ACTIONS,
    all_lines_priced,
    apply_status_override,
    apply_workflow_action,
    available_status_overrides,
    compute_ops_status,
    customer_reply_transition,
    paginate_by_ops_status,
)


def test_create_order_only_from_accepted():
    assert "create_order" not in VALID_ACTIONS["submitted"]
    assert "create_order" not in VALID_ACTIONS["awaiting_customer"]
    assert "create_order" in VALID_ACTIONS["accepted"]


def test_submitted_actions():
    assert VALID_ACTIONS["submitted"] == ["start_review", "cancel"]


def test_preparing_quote_is_retired():
    assert "preparing_quote" not in VALID_ACTIONS
    for actions in VALID_ACTIONS.values():
        assert "prepare_quote" not in actions
    legacy = SimpleNamespace(status="pending", current_handler="PREPARING_QUOTE")
    assert compute_ops_status(legacy) == "under_review"
    priced_not_sent = SimpleNamespace(status="quoted", current_handler="ADMIN_REVIEW")
    assert compute_ops_status(priced_not_sent) == "under_review"


def test_paginate_by_ops_status_filters_before_slicing():
    quotes = [
        SimpleNamespace(id="a", status="pending", current_handler="ADMIN_REVIEW"),
        SimpleNamespace(id="b", status="pending", current_handler="UNDER_REVIEW"),
        SimpleNamespace(id="c", status="quoted", current_handler="CUSTOMER_REVIEW"),
        SimpleNamespace(id="d", status="accepted", current_handler="CUSTOMER_REVIEW"),
    ]
    page, total = paginate_by_ops_status(quotes, {"d"}, ["submitted", "accepted"], 0, 10)
    assert total == 1
    assert [row.id for row in page] == ["a"]

    converted, converted_total = paginate_by_ops_status(quotes, {"d"}, ["converted"], 0, 10)
    assert converted_total == 1
    assert converted[0].id == "d"

    second, _ = paginate_by_ops_status(quotes, set(), [], 1, 2)
    assert [row.id for row in second] == ["b", "c"]


def test_compute_ops_status_mapping():
    assert compute_ops_status(SimpleNamespace(status="draft", current_handler="CUSTOMER_DRAFT")) == "draft"
    submitted = SimpleNamespace(status="pending", current_handler="ADMIN_REVIEW")
    assert compute_ops_status(submitted) == "submitted"

    review = SimpleNamespace(status="pending", current_handler="UNDER_REVIEW")
    assert compute_ops_status(review) == "under_review"

    info = SimpleNamespace(status="pending", current_handler="AWAITING_INFORMATION")
    assert compute_ops_status(info) == "awaiting_information"

    awaiting = SimpleNamespace(status="quoted", current_handler="CUSTOMER_REVIEW")
    assert compute_ops_status(awaiting) == "awaiting_customer"

    accepted = SimpleNamespace(status="accepted", current_handler="LOCKED_APPROVED")
    assert compute_ops_status(accepted) == "accepted"
    assert compute_ops_status(accepted, has_order=True) == "converted"


def test_apply_workflow_actions():
    quote = SimpleNamespace(status="pending", current_handler="ADMIN_REVIEW")
    assert apply_workflow_action(quote, "start_review") == ("pending", "UNDER_REVIEW")
    assert apply_workflow_action(quote, "request_information") == ("pending", "AWAITING_INFORMATION")
    assert apply_workflow_action(quote, "send_quote") == ("quoted", "CUSTOMER_REVIEW")
    status, _ = apply_workflow_action(quote, "cancel")
    assert status == "cancelled"
    with pytest.raises(ValueError):
        apply_workflow_action(quote, "prepare_quote")


def test_customer_reply_returns_quote_to_review():
    awaiting_info = SimpleNamespace(status="pending", current_handler="AWAITING_INFORMATION")
    assert customer_reply_transition(awaiting_info) == ("pending", "UNDER_REVIEW")

    awaiting_customer = SimpleNamespace(status="quoted", current_handler="CUSTOMER_REVIEW")
    assert customer_reply_transition(awaiting_customer) is None

    negotiating = SimpleNamespace(status="revision_proposed", current_handler="ADMIN_REVIEW")
    assert customer_reply_transition(negotiating) is None


def test_status_overrides():
    targets = available_status_overrides("under_review")
    assert "under_review" not in targets
    assert set(targets) == {"awaiting_information", "awaiting_customer", "accepted", "rejected", "cancelled"}
    assert available_status_overrides("converted") == []

    assert apply_status_override("accepted") == ("accepted", "CUSTOMER_REVIEW", "accepted")
    assert apply_status_override("rejected") == ("rejected", "CUSTOMER_REVIEW", "rejected")
    assert apply_status_override("awaiting_customer") == ("quoted", "CUSTOMER_REVIEW", None)
    with pytest.raises(ValueError):
        apply_status_override("converted")


def test_all_lines_priced():
    assert all_lines_priced([SimpleNamespace(unit_price=10), SimpleNamespace(unit_price=2.5)])
    assert not all_lines_priced([SimpleNamespace(unit_price=10), SimpleNamespace(unit_price=0)])
    assert not all_lines_priced([SimpleNamespace(unit_price=None)])
    assert not all_lines_priced([])
    assert all_lines_priced([{"unit_price": 5}])
