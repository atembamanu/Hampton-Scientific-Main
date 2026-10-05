import { useEffect, useState } from 'react';
import axios from 'axios';

import { API_URL } from '../config/apiBaseUrl';
import { getFullImageUrl } from './imageHelper';
import { stripHtml } from './richText';

const CACHE_MS = 15000;
let cache = null;
let cachedAt = 0;
let inflight = null;

export const mapLiveProduct = (row) => {
  const productId = String(row.product_id || row.id);
  const categoryId = row.category_id != null ? String(row.category_id) : '';
  const unit = row.stocking_unit || row.unit || 'unit';
  const price = Number(row.price || 0);
  const rawImages = (Array.isArray(row.images) && row.images.length
    ? row.images
    : (row.image_url ? [row.image_url] : [])
  ).filter(Boolean);
  const images = rawImages.map((src) => getFullImageUrl(src));
  return {
    id: productId,
    product_id: productId,
    slug: productId,
    sku: productId,
    name: row.name,
    category: row.category_name || '',
    categorySlug: categoryId,
    category_id: categoryId,
    categoryId,
    categoryName: row.category_name || '',
    description: row.description || '',
    image: images[0] || getFullImageUrl(row.image_url),
    images: images.length ? images : [getFullImageUrl(row.image_url)],
    inStock: Boolean(row.in_stock),
    is_featured: Boolean(row.is_featured),
    listPrice: price,
    price,
    priceUnit: unit,
    unit,
    package: row.package || '',
    currency: 'KES',
  };
};

export const mapLiveCategory = (row) => ({
  id: row.id,
  category_id: String(row.category_id),
  slug: String(row.category_id),
  name: row.name,
  description: row.description || '',
  image: row.image,
  is_featured: Boolean(row.is_featured),
  nav_group: row.nav_group || 'other',
  display_order: row.display_order || 0,
});

export async function fetchLiveCatalog() {
  const now = Date.now();
  if (cache && now - cachedAt < CACHE_MS) return cache;
  if (inflight) return inflight;
  inflight = Promise.all([
    axios.get(`${API_URL}/api/products`),
    axios.get(`${API_URL}/api/products/categories`),
  ])
    .then(([productsRes, categoriesRes]) => {
      cache = {
        products: (productsRes.data || []).map(mapLiveProduct),
        categories: (categoriesRes.data || [])
          .map(mapLiveCategory)
          .sort((a, b) => (a.display_order - b.display_order) || a.name.localeCompare(b.name)),
      };
      cachedAt = Date.now();
      return cache;
    })
    .finally(() => { inflight = null; });
  return inflight;
}

export async function fetchLiveProduct(productId) {
  const res = await axios.get(`${API_URL}/api/products/${productId}`);
  return mapLiveProduct(res.data);
}

export function filterCatalogProducts(products, { categoryId, search } = {}) {
  const selected = !categoryId || categoryId === 'all' ? '' : String(categoryId);
  const query = (search || '').trim().toLowerCase();
  return products.filter((product) => {
    const matchesCategory = !selected || String(product.category_id) === selected;
    const matchesSearch = !query || [product.name, product.category, stripHtml(product.description), product.sku].some((value) =>
      String(value || '').toLowerCase().includes(query)
    );
    return matchesCategory && matchesSearch;
  });
}

export function featuredProducts(products, limit = 6) {
  const list = Array.isArray(products) ? products : [];
  const starred = list.filter((product) => product.is_featured);
  return (starred.length ? starred : list).slice(0, limit);
}

export function storefrontCategories(categories, products, limit = 8) {
  const list = Array.isArray(products) ? products : [];
  const cats = Array.isArray(categories) ? categories : [];
  const counts = new Map();
  list.forEach((product) => {
    const id = String(product.category_id || '');
    if (!id) return;
    counts.set(id, (counts.get(id) || 0) + 1);
  });
  const withCount = cats.map((category) => ({
    ...category,
    count: counts.get(String(category.category_id)) || 0,
  }));
  const starred = withCount.filter((category) => category.is_featured && category.count > 0);
  const stocked = withCount.filter((category) => category.count > 0);
  return (starred.length ? starred : stocked).slice(0, limit);
}

export function useLiveCatalog() {
  const [state, setState] = useState({ products: [], categories: [], loading: true, error: false });
  useEffect(() => {
    let cancelled = false;
    fetchLiveCatalog()
      .then((data) => {
        if (!cancelled) setState({ ...data, loading: false, error: false });
      })
      .catch(() => {
        if (!cancelled) setState({ products: [], categories: [], loading: false, error: true });
      });
    return () => { cancelled = true; };
  }, []);
  return state;
}
