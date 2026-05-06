import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

// Mock Prisma client globally
vi.mock('../../../db/src/client.js', () => ({
  default: {
    listing: {
      findUnique: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    aIFraudSignal: {
      create: vi.fn(),
    },
  },
}));

// Mock Google Cloud Vision client globally
vi.mock('@google-cloud/vision', () => ({
  ImageAnnotatorClient: vi.fn(() => ({
    webDetection: vi.fn(),
  })),
}));

// Mock fraud check functions to control their behavior for app tests
// These will be actual functions for unit tests via vi.importActual
vi.mock('../src/utils/fraudChecks.js', () => ({
  checkDuplicateLandlordPhone: vi.fn(),
  checkPriceAnomaly: vi.fn(),
  performImageReverseSearch: vi.fn(),
  getMedianPriceForArea: vi.fn(),
  visionClient: { webDetection: vi.fn() },
}));

// Import app AFTER all global mocks are defined
import app from '../src/index.js';

// Import the MOCKED versions of fraud check functions for direct manipulation in ENDPOINT tests
import { 
  checkDuplicateLandlordPhone, 
  checkPriceAnomaly, 
  performImageReverseSearch, 
  getMedianPriceForArea, 
  visionClient 
} from '../src/utils/fraudChecks.js';

describe('Fraud Buster Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mock implementations for fraud check functions for endpoint tests
    checkDuplicateLandlordPhone.mockResolvedValue({ score: 0, reason: null });
    checkPriceAnomaly.mockResolvedValue({ score: 0, reason: null });
    performImageReverseSearch.mockResolvedValue({ score: 0, reason: null });
    getMedianPriceForArea.mockResolvedValue(0); // Mocked helper
    visionClient.webDetection.mockResolvedValueOnce([ { webDetection: { fullMatchingImages: [], pagesWithMatchingImages: [] } } ]); // Mocked visionClient
  });

  describe('POST /api/fraud/check', () => {
    it('should return 400 if listingId is missing', async () => {
      const res = await request(app).post('/api/fraud/check').send({});
      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toEqual('listingId is required and must be a number');
    });

    it('should return 404 if listing is not found', async () => {
      prisma.listing.findUnique.mockResolvedValue(null);

      const res = await request(app).post('/api/fraud/check').send({ listingId: 999 });
      expect(res.statusCode).toEqual(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toEqual('Listing with id 999 not found');
    });

    it('should return a fraud score and reasons for a valid listing', async () => {
      const mockListing = {
        id: 1,
        price: 100000,
        category: 'RESIDENTIAL',
        owner: { id: 101, phone: '123-456-7890' },
        images: [{ url: 'http://example.com/image1.jpg' }],
        property: { state: 'Imo', lga: 'Owerri Municipal' },
      };

      prisma.listing.findUnique.mockResolvedValue(mockListing);
      prisma.aIFraudSignal.create.mockResolvedValue({});

      // Mock the imported fraud check functions for this specific test
      checkDuplicateLandlordPhone.mockResolvedValue({ score: 10, reason: 'Test phone reason' });
      checkPriceAnomaly.mockResolvedValue({ score: 20, reason: 'Test price reason' });
      performImageReverseSearch.mockResolvedValue({ score: 30, reason: 'Test image reason' });

      const res = await request(app).post('/api/fraud/check').send({ listingId: 1 });
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.fraudScore).toEqual(60); // 10 + 20 + 30
      expect(res.body.fraudReasons).toEqual(['Test phone reason', 'Test price reason', 'Test image reason']);
      expect(prisma.aIFraudSignal.create).toHaveBeenCalledOnce();
      expect(prisma.aIFraudSignal.create).toHaveBeenCalledWith({
        data: {
          listingId: 1,
          score: 60,
          reasoning: 'Test phone reason; Test price reason; Test image reason',
          metadata: {
            duplicatePhoneScore: 10,
            priceAnomalyScore: 20,
            imageReverseSearchScore: 30,
          },
        },
      });
    });
  });

  describe('checkDuplicateLandlordPhone (Unit Test)', () => {
    let actualCheckDuplicateLandlordPhone;
    beforeEach(async () => {
      // Get the actual implementation of the function for this test block
      const fraudChecks = await vi.importActual('../src/utils/fraudChecks.js');
      actualCheckDuplicateLandlordPhone = fraudChecks.checkDuplicateLandlordPhone;
      prisma.user.findMany.mockClear(); // Clear prisma mock for this unit test
    });

    it('should return 0 score if no phone is provided', async () => {
      const listing = { owner: { id: 101, phone: null } };
      const { score, reason } = await actualCheckDuplicateLandlordPhone(listing);
      expect(score).toEqual(0);
      expect(reason).toBeNull();
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('should return 0 score if no other users have the same phone', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      const listing = { owner: { id: 101, phone: '123-456-7890' } };
      const { score, reason } = await actualCheckDuplicateLandlordPhone(listing);
      expect(score).toEqual(0);
      expect(reason).toBeNull();
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          phone: '123-456-7890',
          id: { not: 101 },
        },
      });
    });

    it('should return 40 score if other users have the same phone', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 102, phone: '123-456-7890' },
      ]);
      const listing = { owner: { id: 101, phone: '123-456-7890' } };
      const { score, reason } = await actualCheckDuplicateLandlordPhone(listing);
      expect(score).toEqual(40);
      expect(reason).toContain('Duplicate landlord phone');
      expect(prisma.user.findMany).toHaveBeenCalledOnce();
    });
  });

  describe('checkPriceAnomaly (Unit Test)', () => {
    let actualCheckPriceAnomaly;
    let actualGetMedianPriceForArea;
    
    beforeEach(async () => {
      const fraudChecks = await vi.importActual('../src/utils/fraudChecks.js');
      actualCheckPriceAnomaly = fraudChecks.checkPriceAnomaly;
      actualGetMedianPriceForArea = fraudChecks.getMedianPriceForArea; // Get actual helper

      // Spy on the actual helper function and control its behavior
      vi.spyOn(fraudChecks, 'getMedianPriceForArea').mockResolvedValue(0); // Default mock for each test
      fraudChecks.getMedianPriceForArea.mockClear();
    });

    it('should return 0 score if missing location or price data', async () => {
      const listing = { price: 100, property: {}, category: 'RESIDENTIAL' };
      const { score, reason } = await actualCheckPriceAnomaly(listing);
      expect(score).toEqual(0);
      expect(reason).toContain('Missing location or price data');
      expect(getMedianPriceForArea).not.toHaveBeenCalled(); // This checks the globally mocked version
    });

    it('should return 0 score if no median price data', async () => {
      getMedianPriceForArea.mockResolvedValue(0);
      const listing = { price: 100000, property: { state: 'Unknown', lga: 'Unknown' }, category: 'RESIDENTIAL' };
      const { score, reason } = await actualCheckPriceAnomaly(listing);
      expect(score).toEqual(0);
      expect(reason).toContain('No median price data');
      expect(getMedianPriceForArea).toHaveBeenCalledOnce();
    });

    it('should return 15 score for moderate price anomaly (30-50% difference)', async () => {
      getMedianPriceForArea.mockResolvedValue(100000);
      const listing = { price: 135000, property: { state: 'Imo', lga: 'Owerri Municipal' }, category: 'RESIDENTIAL' };
      const { score, reason } = await actualCheckPriceAnomaly(listing);
      expect(score).toEqual(15);
      expect(reason).toContain('35.00% different');
      expect(getMedianPriceForArea).toHaveBeenCalledOnce();
    });

    it('should return 30 score for significant price anomaly (>50% difference)', async () => {
      getMedianPriceForArea.mockResolvedValue(100000);
      const listing = { price: 160000, property: { state: 'Imo', lga: 'Owerri Municipal' }, category: 'RESIDENTIAL' };
      const { score, reason } = await actualCheckPriceAnomaly(listing);
      expect(score).toEqual(30);
      expect(reason).toContain('60.00% different');
      expect(getMedianPriceForArea).toHaveBeenCalledOnce();
    });
  });

  describe('performImageReverseSearch (Unit Test)', () => {
    let actualPerformImageReverseSearch;
    
    beforeEach(async () => {
      const fraudChecks = await vi.importActual('../src/utils/fraudChecks.js');
      actualPerformImageReverseSearch = fraudChecks.performImageReverseSearch;
      // Spy on the actual visionClient.webDetection and control its behavior
      vi.spyOn(fraudChecks.visionClient, 'webDetection').mockResolvedValueOnce([ { webDetection: { fullMatchingImages: [], pagesWithMatchingImages: [] } } ]);
      fraudChecks.visionClient.webDetection.mockClear(); // Clear for each test
    });

    it('should return 0 score if no images are provided', async () => {
      const listing = { images: [] };
      const { score, reason } = await actualPerformImageReverseSearch(listing);
      expect(score).toEqual(0);
      expect(reason).toEqual('No images found for listing to perform reverse search.');
    });

    it('should assign score if image is a stock photo', async () => {
      // This test needs a fresh spy for webDetection on the actual client
      const fraudChecks = await vi.importActual('../src/utils/fraudChecks.js'); 
      vi.spyOn(fraudChecks.visionClient, 'webDetection').mockResolvedValueOnce([
        { webDetection: { pagesWithMatchingImages: [{ url: 'https://shutterstock.com/image.jpg' }] } },
      ]);
      const mockImage = { url: 'http://example.com/stock.jpg' };
      const listing = { images: [mockImage] };
      const { score, reason } = await actualPerformImageReverseSearch(listing);
      expect(score).toEqual(25);
      expect(reason).toContain('appears to be a stock photo');
      expect(fraudChecks.visionClient.webDetection).toHaveBeenCalledOnce();
    });

    it('should assign score if image has full matching images elsewhere', async () => {
      // This test needs a fresh spy for webDetection on the actual client
      const fraudChecks = await vi.importActual('../src/utils/fraudChecks.js'); 
      vi.spyOn(fraudChecks.visionClient, 'webDetection').mockResolvedValueOnce([
        { webDetection: { fullMatchingImages: [{ url: 'http://other.com/image.jpg' }], pagesWithMatchingImages: [] } },
      ]);
      const mockImage = { url: 'http://example.com/unique.jpg' };
      const listing = { images: [mockImage] };
      const { score, reason } = await actualPerformImageReverseSearch(listing);
      expect(score).toEqual(10);
      expect(reason).toContain('found as full match');
      expect(fraudChecks.visionClient.webDetection).toHaveBeenCalledOnce();
    });
  });
});