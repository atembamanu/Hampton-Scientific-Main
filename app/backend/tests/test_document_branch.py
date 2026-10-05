from utils.document_context import document_branch_name


def test_document_branch_name_from_snapshot():
    assert document_branch_name({"delivery_snapshot": {"branch_name": "Karen"}}) == "Karen"
    assert document_branch_name({"branch_name": "Main"}) == "Main"
    assert document_branch_name({}) == ""
