import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const ProductImageGallery = ({ images = [], alt = '', className = '' }) => {
  const list = (Array.isArray(images) ? images : []).filter(Boolean);
  const galleryKey = list.join('|');
  const [index, setIndex] = useState(0);
  const startX = useRef(null);

  useEffect(() => {
    setIndex(0);
  }, [galleryKey]);

  if (!list.length) {
    return (
      <div className={`bg-cream-dark rounded-2xl overflow-hidden aspect-square ${className}`} />
    );
  }

  const safeIndex = Math.min(index, list.length - 1);
  const multiple = list.length > 1;
  const go = (delta) => setIndex((currentIndex) => (
    (currentIndex + delta + list.length) % list.length
  ));

  return (
    <div className={className}>
      <div
        className="relative bg-cream-dark rounded-2xl overflow-hidden aspect-square outline-none"
        tabIndex={multiple ? 0 : undefined}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') go(-1);
          if (event.key === 'ArrowRight') go(1);
        }}
        onPointerDown={(event) => { startX.current = event.clientX; }}
        onPointerUp={(event) => {
          if (startX.current == null || !multiple) return;
          const dx = event.clientX - startX.current;
          startX.current = null;
          if (dx > 40) go(-1);
          if (dx < -40) go(1);
        }}
      >
        {list.map((src, i) => (
          <img
            key={`${src}-${i}`}
            src={src}
            alt={i === safeIndex ? alt : ''}
            className={`gallery-slide pointer-events-none ${i === safeIndex ? 'is-active' : ''}`}
          />
        ))}
        {multiple && (
          <>
            <button
              type="button"
              className="gallery-nav absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 inline-flex items-center justify-center bg-white/90 text-ink shadow-sm hover:bg-white"
              aria-label="Previous image"
              onClick={() => go(-1)}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              className="gallery-nav absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 inline-flex items-center justify-center bg-white/90 text-ink shadow-sm hover:bg-white"
              aria-label="Next image"
              onClick={() => go(1)}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <p className="absolute bottom-3 right-3 z-10 text-[11px] font-medium bg-ink/70 text-white px-2 py-0.5 rounded-full">
              {safeIndex + 1} / {list.length}
            </p>
          </>
        )}
      </div>
      {multiple && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {list.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              className={`gallery-thumb shrink-0 w-16 h-16 overflow-hidden border ${
                i === safeIndex ? 'border-copper ring-2 ring-copper/30' : 'border-ink/10 hover:border-ink/25'
              }`}
              aria-label={`Show image ${i + 1}`}
              aria-current={i === safeIndex ? 'true' : undefined}
              onClick={() => setIndex(i)}
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
