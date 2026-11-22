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
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const initial = name?.trim() ? name.trim().charAt(0).toUpperCase() : null;
  const resolvedSrc = resolveProductImage(src, name, category);

  // Reset error state if resolvedSrc changes
  const prevSrc = React.useRef(resolvedSrc);
  if (prevSrc.current !== resolvedSrc) {
    prevSrc.current = resolvedSrc;
    setHasError(false);
    setIsLoaded(false);
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
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        className={`${className} transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
      />
      {!isLoaded && (
        <div className="absolute inset-0 bg-neutral-200/60 animate-pulse flex items-center justify-center" aria-hidden="true">
          <ImageIcon className="w-5 h-5 text-neutral-400 opacity-50" />
        </div>
      )}
    </div>
  );
};

export default ProductImage;
