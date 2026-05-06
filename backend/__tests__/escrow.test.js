/**
 * Unit tests for the Lodgist escrow endpoints.
 *
 * Tests cover:
 *   POST /api/escrow/initiate  — Initiate escrow payment
 *   POST /api/escrow/hold      — Confirm payment, funds held
 *   POST /api/escrow/release   — Release funds to landlord
 *   GET  /api/escrow/:id       — Fetch single transaction
 *   GET  /api/escrow           — List transactions
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  escrowTransaction: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
};

const mockPaystackService = {
  initializePayment: vi.fn(),
  verifyPayment: vi.fn(),
  createTransferRecipient: vi.fn(),
  transferToLandlord: vi.fn(),
  getBalance: vi.fn(),
};

// ─── Helper: create a test Express app with the escrow router ─────────────────

function createTestApp() {
  const app = express();
  app.use(express.json());
  // Use the factory pattern — pass mock prisma and mock paystackService directly
  const createEscrowRouter = require("../src/routes/escrow");
  const router = createEscrowRouter(mockPrisma, mockPaystackService);
  app.use("/api/escrow", router);
  return app;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockEscrowTransaction = {
  id: "escrow-1",
  reference: "ESCROW-1712345678901-abc123",
  tenantId: 1,
  landlordId: 2,
  listingId: 10,
  amount: 500000,
  currency: "NGN",
  status: "HELD",
  description: "Rent escrow payment",
  paystackAuthorizationUrl: null,
  paystackReference: null,
  releaseDate: null,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

const mockPaystackInitResponse = {
  authorization_url: "https://checkout.paystack.com/abc123",
  reference: "ESCROW-1712345678901-abc123",
  access_code: "abc123",
};

const mockPaystackVerifyResponse = {
  status: "success",
  reference: "ESCROW-1712345678901-abc123",
  amount: 500000,
  currency: "NGN",
  paidAt: "2025-01-01T12:00:00.000Z",
  channel: "card",
  customer: { email: "tenant@example.com", phone: "+2348012345678" },
  metadata: { escrowTransactionId: "escrow-1" },
};

const mockRecipientResponse = {
  recipientCode: "RCP_abc123",
  recipientId: 12345,
};

const mockTransferResponse = {
  transferCode: "TRF_abc123",
  status: "success",
  amount: 500000,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/escrow/initiate", () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  it("should return 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/escrow/initiate")
      .send({ tenantId: 1 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("Missing required fields");
  });

  it("should return 400 when tenantEmail is missing", async () => {
    const res = await request(app)
      .post("/api/escrow/initiate")
      .send({ tenantId: 1, landlordId: 2, amount: 500000, currency: "NGN" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("tenantEmail");
  });

  it("should create an escrow transaction and return payment URL", async () => {
    mockPrisma.escrowTransaction.create.mockResolvedValue(mockEscrowTransaction);
    mockPaystackService.initializePayment.mockResolvedValue(mockPaystackInitResponse);
    mockPrisma.escrowTransaction.update.mockResolvedValue({
      ...mockEscrowTransaction,
      paystackAuthorizationUrl: mockPaystackInitResponse.authorization_url,
      paystackReference: mockPaystackInitResponse.reference,
    });

    const res = await request(app)
      .post("/api/escrow/initiate")
      .send({
        tenantId: 1,
        landlordId: 2,
        listingId: 10,
        amount: 500000,
        currency: "NGN",
        tenantEmail: "tenant@example.com",
        description: "Rent for 3-bedroom apartment",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.escrowTransactionId).toBe("escrow-1");
    expect(res.body.paymentAuthorizationUrl).toBe(mockPaystackInitResponse.authorization_url);
    expect(res.body.paystackReference).toBe(mockPaystackInitResponse.reference);

    expect(mockPrisma.escrowTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 1,
        landlordId: 2,
        amount: 500000,
        currency: "NGN",
        status: "HELD",
      }),
    });

    expect(mockPaystackService.initializePayment).toHaveBeenCalledWith({
      email: "tenant@example.com",
      amount: 500000,
      reference: mockEscrowTransaction.reference,
      metadata: expect.objectContaining({
        escrowTransactionId: "escrow-1",
        tenantId: 1,
        landlordId: 2,
      }),
    });
  });

  it("should return 500 when Paystack initialization fails", async () => {
    mockPrisma.escrowTransaction.create.mockResolvedValue(mockEscrowTransaction);
    mockPaystackService.initializePayment.mockRejectedValue(
      new Error("Paystack API error")
    );

    const res = await request(app)
      .post("/api/escrow/initiate")
      .send({
        tenantId: 1,
        landlordId: 2,
        amount: 500000,
        currency: "NGN",
        tenantEmail: "tenant@example.com",
      });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe("Paystack API error");
  });
});

describe("POST /api/escrow/hold", () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  it("should return 400 when reference is missing", async () => {
    const res = await request(app).post("/api/escrow/hold").send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("reference");
  });

  it("should return 400 when Paystack verification fails", async () => {
    mockPaystackService.verifyPayment.mockResolvedValue({
      ...mockPaystackVerifyResponse,
      status: "failed",
    });

    const res = await request(app)
      .post("/api/escrow/hold")
      .send({ reference: "invalid-ref" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("not successful");
  });

  it("should return 404 when escrow transaction not found", async () => {
    mockPaystackService.verifyPayment.mockResolvedValue(mockPaystackVerifyResponse);
    mockPrisma.escrowTransaction.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/escrow/hold")
      .send({ reference: "ESCROW-1712345678901-abc123" });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("not found");
  });

  it("should return 409 when transaction is already released", async () => {
    mockPaystackService.verifyPayment.mockResolvedValue(mockPaystackVerifyResponse);
    mockPrisma.escrowTransaction.findUnique.mockResolvedValue({
      ...mockEscrowTransaction,
      status: "RELEASED",
    });

    const res = await request(app)
      .post("/api/escrow/hold")
      .send({ reference: "ESCROW-1712345678901-abc123" });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("already");
  });

  it("should confirm payment and return success", async () => {
    mockPaystackService.verifyPayment.mockResolvedValue(mockPaystackVerifyResponse);
    mockPrisma.escrowTransaction.findUnique.mockResolvedValue(mockEscrowTransaction);
    mockPrisma.escrowTransaction.update.mockResolvedValue(mockEscrowTransaction);

    const res = await request(app)
      .post("/api/escrow/hold")
      .send({ reference: "ESCROW-1712345678901-abc123" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("held in escrow");
    expect(res.body.escrowTransactionId).toBe("escrow-1");
    expect(res.body.amount).toBe(500000);

    expect(mockPrisma.escrowTransaction.update).toHaveBeenCalledWith({
      where: { id: "escrow-1" },
      data: expect.objectContaining({
        paystackReference: mockPaystackVerifyResponse.reference,
        status: "HELD",
      }),
    });
  });
});

describe("POST /api/escrow/release", () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  it("should return 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/escrow/release")
      .send({ landlordId: 2 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("Missing required fields");
  });

  it("should return 404 when escrow transaction not found", async () => {
    mockPrisma.escrowTransaction.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/escrow/release")
      .send({ escrowTransactionId: "nonexistent", landlordId: 2 });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("not found");
  });

  it("should return 403 when landlord is not the recipient", async () => {
    mockPrisma.escrowTransaction.findUnique.mockResolvedValue({
      ...mockEscrowTransaction,
      landlordId: 999,
    });

    const res = await request(app)
      .post("/api/escrow/release")
      .send({ escrowTransactionId: "escrow-1", landlordId: 2 });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("not authorized");
  });

  it("should return 409 when transaction is not in HELD status", async () => {
    mockPrisma.escrowTransaction.findUnique.mockResolvedValue({
      ...mockEscrowTransaction,
      status: "RELEASED",
    });

    const res = await request(app)
      .post("/api/escrow/release")
      .send({ escrowTransactionId: "escrow-1", landlordId: 2 });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("already");
  });

  it("should return 400 when landlordBankDetails are missing", async () => {
    mockPrisma.escrowTransaction.findUnique.mockResolvedValue(mockEscrowTransaction);

    const res = await request(app)
      .post("/api/escrow/release")
      .send({ escrowTransactionId: "escrow-1", landlordId: 2 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("landlordBankDetails");
  });

  it("should release funds to landlord successfully", async () => {
    mockPrisma.escrowTransaction.findUnique.mockResolvedValue(mockEscrowTransaction);
    mockPaystackService.createTransferRecipient.mockResolvedValue(mockRecipientResponse);
    mockPaystackService.transferToLandlord.mockResolvedValue(mockTransferResponse);
    mockPrisma.escrowTransaction.update.mockResolvedValue({
      ...mockEscrowTransaction,
      status: "RELEASED",
      releaseDate: new Date(),
    });

    const res = await request(app)
      .post("/api/escrow/release")
      .send({
        escrowTransactionId: "escrow-1",
        landlordId: 2,
        landlordBankDetails: {
          name: "John Doe",
          accountNumber: "0123456789",
          bankCode: "011",
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("released to landlord");
    expect(res.body.transferCode).toBe("TRF_abc123");
    expect(res.body.transferStatus).toBe("success");
    expect(res.body.amountReleased).toBe(500000);

    expect(mockPaystackService.createTransferRecipient).toHaveBeenCalledWith({
      name: "John Doe",
      accountNumber: "0123456789",
      bankCode: "011",
    });

    expect(mockPaystackService.transferToLandlord).toHaveBeenCalledWith({
      amount: 500000,
      recipientCode: "RCP_abc123",
      reference: expect.stringContaining("ESCROW-RELEASE-"),
      reason: expect.stringContaining("Rent escrow release"),
    });

    expect(mockPrisma.escrowTransaction.update).toHaveBeenCalledWith({
      where: { id: "escrow-1" },
      data: expect.objectContaining({
        status: "RELEASED",
        releaseDate: expect.any(Date),
      }),
    });
  });
});

describe("GET /api/escrow/:id", () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  it("should return 404 when transaction not found", async () => {
    mockPrisma.escrowTransaction.findUnique.mockResolvedValue(null);

    const res = await request(app).get("/api/escrow/nonexistent");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("should return the escrow transaction with relations", async () => {
    const transactionWithRelations = {
      ...mockEscrowTransaction,
      tenant: { id: 1, name: "Tenant", email: "tenant@example.com" },
      landlord: { id: 2, name: "Landlord", email: "landlord@example.com" },
      listing: { id: 10, title: "3-Bedroom Apartment", price: 500000 },
    };

    mockPrisma.escrowTransaction.findUnique.mockResolvedValue(transactionWithRelations);

    const res = await request(app).get("/api/escrow/escrow-1");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe("escrow-1");
    expect(res.body.data.tenant.name).toBe("Tenant");
    expect(res.body.data.landlord.name).toBe("Landlord");
    expect(res.body.data.listing.title).toBe("3-Bedroom Apartment");
  });
});

describe("GET /api/escrow", () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  it("should return all escrow transactions", async () => {
    const transactions = [
      { ...mockEscrowTransaction, id: "escrow-1" },
      { ...mockEscrowTransaction, id: "escrow-2", amount: 300000 },
    ];

    mockPrisma.escrowTransaction.findMany.mockResolvedValue(transactions);

    const res = await request(app).get("/api/escrow");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].id).toBe("escrow-1");
    expect(res.body.data[1].id).toBe("escrow-2");
  });

  it("should filter by tenantId", async () => {
    mockPrisma.escrowTransaction.findMany.mockResolvedValue([mockEscrowTransaction]);

    const res = await request(app).get("/api/escrow?tenantId=1");

    expect(res.status).toBe(200);
    expect(mockPrisma.escrowTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 1 }),
      })
    );
  });

  it("should filter by status", async () => {
    mockPrisma.escrowTransaction.findMany.mockResolvedValue([mockEscrowTransaction]);

    const res = await request(app).get("/api/escrow?status=HELD");

    expect(res.status).toBe(200);
    expect(mockPrisma.escrowTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "HELD" }),
      })
    );
  });
});
