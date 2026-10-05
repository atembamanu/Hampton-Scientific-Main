import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { FacilityProductQuoteControls } from '../../components/facility/FacilityProductQuoteControls';
import { ProductDescription } from '../../components/ProductDescription';
import { ProductImageGallery } from '../../components/ProductImageGallery';
import { fetchLiveProduct } from '../../utils/liveCatalog';

export const FacilityProductDetail = () => {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLiveProduct(slug)
      .then((item) => { if (!cancelled) setProduct(item); })
      .catch(() => { if (!cancelled) setProduct(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return <p className="text-sm text-ink-muted py-16">Loading product…</p>;
  }

  if (!product) {
    return (
      <div className="text-center py-16">
        <h1 className="text-xl font-bold text-ink mb-2">Product not found</h1>
        <Link to="/dashboard/products" className="text-sm text-copper hover:underline">Back to products</Link>
      </div>
    );
  }

  return (
    <div>
      <Link to="/dashboard/products" className="text-sm text-copper hover:underline mb-6 inline-block">
        ← Back to products
      </Link>

      <div className="grid lg:grid-cols-2 gap-10 items-start">
        <ProductImageGallery images={product.images || [product.image]} alt={product.name} />

        <div>
          <p className="text-sm text-ink-muted mb-1">{product.category}</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight mb-4">{product.name}</h1>
          <div className="mb-6">
            <FacilityProductQuoteControls product={product} />
          </div>
          {product.description && (
            <ProductDescription html={product.description} className="text-ink-muted leading-relaxed text-sm" />
          )}
        </div>
      </div>
    </div>
  );
};
