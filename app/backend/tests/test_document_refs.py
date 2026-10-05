from utils.document_refs import format_reference, parse_document_stem, sibling_reference


def test_parse_new_and_legacy_stems():
    assert parse_document_stem("QT202609271") == "202609271"
    assert parse_document_stem("QT-20260927-0001") == "202609271"
    assert parse_document_stem("ORD-20260927-0002") == "202609272"


def test_sibling_references_share_stem():
    assert sibling_reference("QT202609271", "order") == "ORD202609271"
    assert sibling_reference("QT202609271", "invoice") == "IN202609271"
    assert format_reference("quote", "202609271") == "QT202609271"
