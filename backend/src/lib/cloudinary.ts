import { v2 as cloudinary } from 'cloudinary';
import type { Violation } from '../types';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };

export interface AnalysisResult {
  violations: Violation[];
  annotatedImage: Buffer;
  fixedImage: Buffer;
  metadata: {
    width: number;
    height: number;
    textRegionsFound: number;
    analysisTimestamp: string;
  };
}

export async function uploadForAnalysis(
  file: Buffer,
  sourceType: string,
  sourceRef: string
): Promise<{ public_id: string }> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: 'a11y-audits',
        resource_type: 'image',
        eager: [
          {
            transformation: [
              { effect: 'accessibility_analysis' },
            ],
          },
        ],
        context: `sourceType=${sourceType}|sourceRef=${sourceRef}`,
        tags: ['a11y-audit', sourceType],
      },
      (error, result) => (error ? reject(error) : resolve({ public_id: result!.public_id })),
    ).end(file);
  });
}

export function getAnnotatedImageUrl(publicId: string, violations: Violation[]) {
  const overlays = violations.map((v) => {
    const bounds = v.bounds || v.coordinates;
    return {
      overlay: {
        resource_type: 'image',
        public_id: `a11y-violations/${(v.type || 'contrast')}-marker`,
        transformation: [
          { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, crop: 'crop' },
          { effect: 'outline:3:ff0000' },
          { opacity: 80 },
        ],
      },
      flags: 'layer_apply',
      gravity: 'north_west',
    };
  });

  return cloudinary.url(publicId, {
    transformation: [...overlays, { quality: 'auto', fetch_format: 'auto' }],
  });
}

type FixBounds = { x: number; y: number; width: number; height: number };

export function getFixedImageUrl(publicId: string, fixes: Array<{ bounds: FixBounds; targetHex: string }>) {
  return cloudinary.url(publicId, {
    transformation: fixes.map((f) => {
      const b = f.bounds;
      return {
        overlay: {
          resource_type: 'image',
          public_id: publicId,
          transformation: [
            { x: b.x, y: b.y, width: b.width, height: b.height, crop: 'crop' },
            { effect: `colorize:100:${f.targetHex.replace('#', '')}` },
          ],
        },
        flags: 'layer_apply',
        gravity: 'north_west',
      };
    }),
    quality: 'auto',
    fetch_format: 'auto',
  });
}

export function getResponsiveUrls(publicId: string) {
  const breakpoints = [320, 768, 1024, 1440];
  return breakpoints.map((w) => ({
    breakpoint: w,
    url: cloudinary.url(publicId, {
      transformation: [{ width: w, crop: 'scale' }, { quality: 'auto', fetch_format: 'auto' }],
    }),
  }));
}