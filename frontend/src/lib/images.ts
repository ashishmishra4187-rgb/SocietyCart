/**
 * Known shortlink mappings (e.g. Bing Image search shortlinks)
 * mapped directly to their CDN image representations so direct image rendering works.
 */
export const SHORTLINK_IMAGE_MAP: Record<string, string> = {
  'https://sl.bing.net/kwf3BjyNOmq': 'https://tse1.mm.bing.net/th/id/OIP.1GfXoe8db2_kRIpw2tXlGQHaEL?pid=ImgDet&rs=1',
  'https://sl.bing.net/iPd2daI35Xw': 'https://tse1.mm.bing.net/th/id/OIP.cuJ1hIDBR0sllnADOMs0cQHaHa?pid=ImgDet&rs=1',
};

/**
 * Maps product names or categories to curated high-resolution grocery photos
 * when items are created without a custom photo URL.
 */
export const DEFAULT_PRODUCT_IMAGES: { keywords: string[]; url: string }[] = [
  {
    keywords: ['atta', 'wheat', 'flour', 'chakki', 'staple'],
    url: '/market/atta.webp',
  },
  {
    keywords: ['oil', 'sunflower', 'mustard', 'tel', 'ghee', 'cooking'],
    url: '/market/oil.webp',
  },
  {
    keywords: ['milk', 'dairy', 'doodh', 'curd', 'paneer', 'butter', 'a2', 'cow milk'],
    url: '/market/milk.webp',
  },
  {
    keywords: ['dal', 'lentil'], url: '/market/dal.webp',
  },
  {
    keywords: ['rice', 'basmati', 'chawal', 'paddy', 'grain'],
    url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
  },
  {
    keywords: ['mango', 'alphonso', 'fruit', 'apple', 'banana', 'orange'],
    url: 'https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=600&q=80',
  },
  {
    keywords: ['almond', 'badam', 'kaju', 'nut', 'cashew', 'dry fruit', 'walnut'],
    url: 'https://images.unsplash.com/photo-1508061252445-5350f3ab0a55?auto=format&fit=crop&w=600&q=80',
  },
  {
    keywords: ['egg', 'eggs', 'anda'],
    url: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&w=600&q=80',
  },
  {
    keywords: ['tea', 'coffee', 'chai'],
    url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80',
  },
  {
    keywords: ['detergent', 'soap', 'clean', 'surf', 'wash'],
    url: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=600&q=80',
  },
];

const FALLBACK_GENERAL_IMAGE =
  'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80';

/**
 * Resolves the display image for a product. If imageUrl is null or empty,
 * it returns a relevant high-resolution image matching the product name or category.
 */
export function resolveProductImage(
  imageUrl?: string | null,
  productName?: string,
  category?: string,
): string {
  if (imageUrl && imageUrl.trim().length > 0) {
    const trimmed = imageUrl.trim();
    if (SHORTLINK_IMAGE_MAP[trimmed]) {
      return SHORTLINK_IMAGE_MAP[trimmed];
    }
    return trimmed;
  }

  const query = `${productName ?? ''} ${category ?? ''}`.toLowerCase();
  for (const preset of DEFAULT_PRODUCT_IMAGES) {
    if (preset.keywords.some((kw) => query.includes(kw))) {
      return preset.url;
    }
  }

  return FALLBACK_GENERAL_IMAGE;
}
