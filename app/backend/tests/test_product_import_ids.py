from repositories.products import plan_import_ids


def test_blank_ids_stay_unique_when_the_file_starts_at_one():
    planned = plan_import_ids(["1", "", ""], set())
    assert planned == ["1", "2", "3"]


def test_blank_ids_do_not_reuse_an_explicit_id_later_in_the_file():
    planned = plan_import_ids(["1", "", "185", ""], set())
    assert planned == ["1", "2", "185", "3"]


def test_blank_ids_skip_ids_already_stored():
    planned = plan_import_ids(["", "4", ""], {1, 2})
    assert planned == ["3", "4", "5"]
