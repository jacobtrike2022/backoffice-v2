/**
 * QR Code Generation Utilities
 * Handles QR code creation with logo overlays, framed designs, and exports
 */

import QRCodeStyling from 'qr-code-styling';
import { nanoid } from 'nanoid';

export interface QRCodeOptions {
  url: string;
  logoUrl?: string;
  color?: string;
  size?: number;
}

export interface FramedQROptions extends QRCodeOptions {
  title: string;
  location?: string;
  headerText?: string;
}

/**
 * Generate a slug for Knowledge Base article
 * Format: {sanitized-title}-{random-suffix}
 * Example: "coffee-machine-cleaning-a8x9c2"
 */
export function generateKBSlug(title: string, retryCount = 0): string {
  if (retryCount > 5) {
    throw new Error('Unable to generate unique slug after 5 attempts');
  }

  const baseSlug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50); // Max 50 chars

  const suffixLength = retryCount > 0 ? 8 : 6; // Longer ID if retry
  const suffix = nanoid(suffixLength);
  const slug = `${baseSlug}-${suffix}`;

  return slug;
}

/**
 * Create a QR code with logo overlay
 */
export function createQRCode(options: QRCodeOptions): QRCodeStyling {
  const {
    url,
    logoUrl,
    color = '#F64A05', // Trike orange
    size = 400
  } = options;

  const qrCode = new QRCodeStyling({
    width: size,
    height: size,
    data: url,
    margin: 10,
    qrOptions: {
      typeNumber: 0,
      mode: 'Byte',
      errorCorrectionLevel: 'H' // HIGH - allows 30% of QR to be obscured by logo
    },
    imageOptions: {
      hideBackgroundDots: true,
      imageSize: 0.3, // Logo covers 30% of center area
      margin: 4,
      crossOrigin: 'anonymous'
    },
    dotsOptions: {
      color: color,
      type: 'rounded'
    },
    backgroundOptions: {
      color: '#ffffff'
    },
    image: logoUrl,
    cornersSquareOptions: {
      color: '#000000',
      type: 'extra-rounded'
    },
    cornersDotOptions: {
      color: '#000000',
      type: 'dot'
    }
  });

  return qrCode;
}

/**
 * Generate a framed QR code on canvas with header, title, and location
 */
export async function generateFramedQRCanvas(
  options: FramedQROptions
): Promise<HTMLCanvasElement> {
  const {
    url,
    logoUrl,
    title,
    location,
    headerText = 'SCAN FOR REFERENCE',
    color = '#F64A05'
  } = options;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get canvas 2D context');
  }

  // Canvas dimensions
  const width = 480;
  const baseHeight = 580;
  const locationHeight = location ? 40 : 0;
  const height = baseHeight + locationHeight;
  
  canvas.width = width;
  canvas.height = height;

  // Fill white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Draw black border
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, width - 8, height - 8);

  // Header text
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(headerText, width / 2, 40);

  // Generate QR code
  const qrCode = createQRCode({
    url,
    logoUrl,
    color,
    size: 400
  });

  // Convert QR to blob and load as image
  const qrBlob = await qrCode.getRawData('png');
  if (!qrBlob) {
    throw new Error('Failed to generate QR code blob');
  }

  const qrImg = new Image();
  const qrUrl = URL.createObjectURL(new Blob([qrBlob]));
  
  await new Promise<void>((resolve, reject) => {
    qrImg.onload = () => {
      URL.revokeObjectURL(qrUrl);
      resolve();
    };
    qrImg.onerror = () => {
      URL.revokeObjectURL(qrUrl);
      reject(new Error('Failed to load QR code image'));
    };
    qrImg.src = qrUrl;
  });

  // Draw QR code
  ctx.drawImage(qrImg, 40, 60, 400, 400);

  // Article title (wrapped if needed)
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000000';
  
  const truncatedTitle = title.length > 60 
    ? title.substring(0, 57) + '...' 
    : title;

  // Word wrap title (max 2 lines)
  const words = truncatedTitle.split(' ');
  let line = '';
  let y = 490;
  const maxWidth = 420;

  for (const word of words) {
    const testLine = line + word + ' ';
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && line !== '') {
      ctx.fillText(line.trim(), width / 2, y);
      line = word + ' ';
      y += 22;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), width / 2, y);

  // Location reference (small print)
  if (location) {
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#666666';
    const locationY = y + 30;
    ctx.fillText(location, width / 2, locationY);
  }

  return canvas;
}

/**
 * Download canvas as PNG
 */
export function downloadCanvasAsPNG(
  canvas: HTMLCanvasElement,
  filename: string
): void {
  canvas.toBlob((blob) => {
    if (!blob) {
      throw new Error('Failed to create PNG blob');
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();

    // Cleanup
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }, 'image/png', 1.0);
}

/**
 * Download QR code as SVG
 */
export async function downloadQRCodeAsSVG(
  qrCode: QRCodeStyling,
  filename: string
): Promise<void> {
  const svgData = await qrCode.getRawData('svg');
  
  if (!svgData) {
    throw new Error('Failed to generate SVG data');
  }

  const blob = new Blob([svgData], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  // Cleanup
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Create filename for QR code download
 */
export function createQRFilename(slug: string, extension: 'png' | 'svg'): string {
  const date = new Date().toISOString().split('T')[0];
  return `qr-${slug}-${date}.${extension}`;
}

/**
 * Validate if a string is a valid KB slug format
 */
export function isValidKBSlug(slug: string): boolean {
  // Must be lowercase, alphanumeric with hyphens, ending with random suffix
  const slugPattern = /^[a-z0-9]+-[a-z0-9]+$/;
  return slugPattern.test(slug) && slug.length >= 8 && slug.length <= 70;
}

/**
 * Extract title from slug (remove random suffix)
 */
export function getTitleFromSlug(slug: string): string {
  // Remove the last segment (random suffix)
  const parts = slug.split('-');
  if (parts.length < 2) return slug;
  
  // Remove last part and rejoin
  parts.pop();
  return parts.join('-').replace(/-/g, ' ');
}

/**
 * Generate public KB viewer URL from slug
 * Format: /kb-public?slug={slug}
 * 
 * ⚠️ IMPORTANT: For QR codes to work, ensure your deployment does NOT have
 * a site-level password enabled. Site passwords are separate from KB privacy
 * settings and will block all access before the React app even loads.
 * 
 * If you need both:
 * - Main app with site password for internal users
 * - Public KB viewer for QR codes
 * 
 * Deploy two separate instances:
 * 1. Main app: password-protected deployment
 * 2. KB viewer: public deployment (update baseUrl below)
 */
export function generateKBPublicUrl(slug: string): string {
  // Use the current deployment origin (Vercel or local dev)
  // The React app will detect the slug param and render PublicKBViewer
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  
  return `${baseUrl}?slug=${slug}`;
}