from repositories.products import normalize_image_urls, resolve_product_images


def test_normalize_image_urls_keeps_order_and_dedupes():
    assert normalize_image_urls(
        ["/images/products/a.jpg", " /images/products/b.jpg ", "/images/products/a.jpg", ""],
        "/images/products/c.jpg",
    ) == [
        "/images/products/a.jpg",
        "/images/products/b.jpg",
        "/images/products/c.jpg",
    ]


def test_normalize_image_urls_falls_back_to_primary():
    assert normalize_image_urls(None, "/images/products/only.jpg") == ["/images/products/only.jpg"]
    assert normalize_image_urls([], None) == []


class _Row:
    def __init__(self, images=None, image_url=None):
        self.images = images
        self.image_url = image_url


def test_resolve_images_payload_replaces_gallery():
    existing = _Row(images=["/a.jpg", "/b.jpg"], image_url="/a.jpg")
    assert resolve_product_images({"images": ["/c.jpg", "/a.jpg"]}, existing) == ["/c.jpg", "/a.jpg"]


def test_resolve_image_url_keeps_extra_gallery_items():
    existing = _Row(images=["/a.jpg", "/b.jpg"], image_url="/a.jpg")
    assert resolve_product_images({"image_url": "/b.jpg"}, existing) == ["/b.jpg", "/a.jpg"]
