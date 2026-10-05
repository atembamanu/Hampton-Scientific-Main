import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ProductQuoteControls } from '../components/template/ProductQuoteControls';
import { TemplateProductCard } from '../components/template/TemplateProductCard';
import { ProductDescription } from '../components/ProductDescription';
import { ProductImageGallery } from '../components/ProductImageGallery';
import { fetchLiveCatalog, fetchLiveProduct } from '../utils/liveCatalog';

export const ProductDetail = () => {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLiveProduct(slug)
      .then(async (item) => {
        if (cancelled) return;
        setProduct(item);
        const { products } = await fetchLiveCatalog();
        if (cancelled) return;
        setRelated(
          products
            .filter((row) => row.category_id === item.category_id && row.slug !== item.slug)
            .slice(0, 4)
        );
      })
      .catch(() => {
        if (!cancelled) setProduct(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen pb-16 flex items-center justify-center bg-cream">
        <p className="text-sm text-ink-muted">Loading product…</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen pb-16 flex items-center justify-center bg-cream">
        <div className="text-center px-6">
          <h1 className="text-xl font-bold text-ink mb-2">Product not found</h1>
          <Link to="/products" className="text-sm text-copper hover:underline">Back to store</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-cream">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          <ProductImageGallery images={product.images || [product.image]} alt={product.name} />

          <div className="lg:pt-8">
            <p className="text-sm text-ink-muted mb-1">{product.category}</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-ink tracking-tight mb-6">{product.name}</h1>
            {product.inStock && <p className="text-sm text-green-700 mb-6">In stock</p>}
            <div className="mb-8">
              <ProductQuoteControls product={product} />
            </div>
            <div className="section-divider pt-6 mb-8 space-y-2 text-sm text-ink-muted">
              <p>Quote-based pricing — contact us for a tailored quote.</p>
              <p>Delivery and installation available across the region.</p>
            </div>
            {product.description && (
              <ProductDescription html={product.description} className="text-ink-muted leading-relaxed" />
            )}
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-20 section-divider pt-16">
            <h2 className="text-xl font-bold text-ink mb-8">Customers Also Bought</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {related.map((item) => (
                <TemplateProductCard key={item.id} product={item} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
