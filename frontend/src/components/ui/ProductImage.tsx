import React, { useState } from 'react';
import { ImageIcon } from './Icons';
import { resolveProductImage } from '../../lib/images';

interface ProductImageProps {
  src?: string | null;
  alt?: string;
  name?: string;
  category?: string;
  className?: string;
  containerClassName?: string;
  fallbackClassName?: string;
  loading?: 'lazy' | 'eager';
  captionFallback?: boolean;
}

export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  alt = '',
  name,
  category,
  className = 'w-full h-full object-cover',
  containerClassName = 'w-full h-full relative overflow-hidden bg-neutral-100 flex items-center justify-center',
  fallbackClassName = 'text-neutral-400 flex flex-col items-center justify-center p-2 text-center select-none',
  loading = 'lazy',
  captionFallback = false,
}) => {
  const [hasError, setHasError] = useState(false);

  const initial = name?.trim() ? name.trim().charAt(0).toUpperCase() : null;
  const resolvedSrc = resolveProductImage(src, name, category);

  // Reset error state if resolvedSrc changes
  const prevSrc = React.useRef(resolvedSrc);
  if (prevSrc.current !== resolvedSrc) {
    prevSrc.current = resolvedSrc;
    setHasError(false);
  }

  if (hasError) {
    return (
      <div className={containerClassName}>
        <div className={fallbackClassName} aria-hidden="true">
          {initial ? (
            <span className="font-bold text-neutral-500 text-lg leading-none">{initial}</span>
          ) : (
            <ImageIcon className="w-6 h-6 text-neutral-400 stroke-1" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      <img
        src={resolvedSrc}
        alt={alt}
        loading={loading}
        onError={() => setHasError(true)}
        data-catalogue-photo={src?.trim() ? true : undefined}
        className={className}
      />
      {captionFallback && !src?.trim() && <span className="market-image-caption">Illustrative photo</span>}

    </div>
  );
};

export default ProductImage;
