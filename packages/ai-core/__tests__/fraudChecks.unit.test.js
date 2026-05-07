// ─── Set dummy DATABASE_URL before any module loads ──────────────────────────
process.env.DATABASE_URL = 'postgresql://dummy:dummy@localhost:5432/dummy';

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import the ACTUAL functions and the setPrisma injector
import {
  checkDuplicateLandlordPhone,
  checkPriceAnomaly,
  getMedianPriceForArea,
  performImageReverseSearch,
  visionClient,
  setPrisma,
} from '../src/utils/fraudChecks.js';

// ─── Mock Prisma ─────────────────────────────────────────────────────────────
const mockPrisma = {
  listing: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
  },
  aiFraudSignal: {
    create: vi.fn(),
  },
};

// Inject the mock prisma before each test
beforeEach(() => {
  setPrisma(mockPrisma);
  vi.clearAllMocks();
});

describe('checkDuplicateLandlordPhone', () => {
  it('should return 0 score if no phone is provided', async () => {
    const listing = { owner: { id: 101, phone: null } };
    const { score, reason } = await checkDuplicateLandlordPhone(listing);
    expect(score).toEqual(0);
    expect(reason).toBeNull();
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it('should return 0 score if no other users have the same phone', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    const listing = { owner: { id: 101, phone: '123-456-7890' } };
    const { score, reason } = await checkDuplicateLandlordPhone(listing);
    expect(score).toEqual(0);
    expect(reason).toBeNull();
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      where: {
        phone: '123-456-7890',
        id: { not: 101 },
      },
    });
  });

  it('should return 40 score if other users have the same phone', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 102, phone: '123-456-7890' },
    ]);
    const listing = { owner: { id: 101, phone: '123-456-7890' } };
    const { score, reason } = await checkDuplicateLandlordPhone(listing);
    expect(score).toEqual(40);
    expect(reason).toContain('Duplicate landlord phone');
    expect(mockPrisma.user.findMany).toHaveBeenCalledOnce();
  });
});

describe('checkPriceAnomaly', () => {
  it('should return 0 score if missing location or price data', async () => {
    const listing = { price: 100, property: {}, category: 'RESIDENTIAL' };
    const { score, reason } = await checkPriceAnomaly(listing);
    expect(score).toEqual(0);
    expect(reason).toContain('Missing location or price data');
  });

  it('should return 0 score if no median price data', async () => {
    const listing = { price: 100000, property: { state: 'Unknown', lga: 'Unknown' }, category: 'RESIDENTIAL' };
    const { score, reason } = await checkPriceAnomaly(listing);
    expect(score).toEqual(0);
    expect(reason).toContain('No median price data');
  });

  it('should return 15 score for moderate price anomaly (30-50% difference)', async () => {
    // Owerri Municipal RESIDENTIAL median is 150000; price 202500 is 35% above
    const listing = { price: 202500, property: { state: 'Imo', lga: 'Owerri Municipal' }, category: 'RESIDENTIAL' };
    const { score, reason } = await checkPriceAnomaly(listing);
    expect(score).toEqual(15);
    expect(reason).toContain('35.00% different');
  });

  it('should return 30 score for significant price anomaly (>50% difference)', async () => {
    // Owerri Municipal RESIDENTIAL median is 150000; price 240000 is 60% above
    const listing = { price: 240000, property: { state: 'Imo', lga: 'Owerri Municipal' }, category: 'RESIDENTIAL' };
    const { score, reason } = await checkPriceAnomaly(listing);
    expect(score).toEqual(30);
    expect(reason).toContain('60.00% different');
  });
});

describe('getMedianPriceForArea', () => {
  it('should return correct median for known area', async () => {
    const result = await getMedianPriceForArea('Imo', 'Owerri Municipal', 'RESIDENTIAL');
    expect(result).toEqual(150000);
  });

  it('should return 0 for unknown area', async () => {
    const result = await getMedianPriceForArea('Unknown', 'Unknown', 'RESIDENTIAL');
    expect(result).toEqual(0);
  });
});

describe('performImageReverseSearch', () => {
  it('should return 0 score if no images are provided', async () => {
    const listing = { images: [] };
    const { score, reason } = await performImageReverseSearch(listing);
    expect(score).toEqual(0);
    expect(reason).toEqual('No images found for listing to perform reverse search.');
  });

  it('should assign score if image is a stock photo', async () => {
    vi.spyOn(visionClient, 'webDetection').mockResolvedValueOnce([
      { webDetection: { 
        fullMatchingImages: [], 
        pagesWithMatchingImages: [{ url: 'https://shutterstock.com/image.jpg' }] 
      }},
    ]);
    const mockImage = { url: 'http://example.com/stock.jpg' };
    const listing = { images: [mockImage] };
    const { score, reason } = await performImageReverseSearch(listing);
    // 5 (pagesWithMatchingImages) + 25 (stock photo) = 30
    expect(score).toEqual(30);
    expect(reason).toContain('appears to be a stock photo');
    expect(visionClient.webDetection).toHaveBeenCalledOnce();
  });

  it('should assign score if image has full matching images elsewhere', async () => {
    vi.spyOn(visionClient, 'webDetection').mockResolvedValueOnce([
      { webDetection: { 
        fullMatchingImages: [{ url: 'http://other.com/image.jpg' }], 
        pagesWithMatchingImages: [] 
      }},
    ]);
    const mockImage = { url: 'http://example.com/unique.jpg' };
    const listing = { images: [mockImage] };
    const { score, reason } = await performImageReverseSearch(listing);
    expect(score).toEqual(10);
    expect(reason).toContain('found as full match');
    expect(visionClient.webDetection).toHaveBeenCalledOnce();
  });
});
