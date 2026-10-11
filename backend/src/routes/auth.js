const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const webauthnService = require("../services/webauthnService");
const { notifySignup } = require("../utils/notifySignup");
const { requireAuth } = require("../middleware/auth");

const BCRYPT_COST = 12;
const REGISTER_REJECTED = Object.freeze({
  success: false,
  error: "We couldn't create that account. If you already have one, sign in instead.",
});

module.exports = (prisma) => {
  const router = express.Router();

  // ── POST /api/auth/register ────────────────────────────────────────────────
  router.post("/register", async (req, res) => {
    try {
      const { email, password, name, phone } = req.body;

      // Validation
      if (!email || !password || !name) {
        return res.status(400).json({
          success: false,
          error: "email, password, and name are required",
        });
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({
          success: false,
          error: "Invalid email address",
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          error: "Password must be at least 8 characters",
        });
      }

      // Hash before any lookup so the duplicate path costs the same as a new
      // account (no timing signal for whether an email exists).
      const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

      // A duplicate email, or a unique-constraint race (P2002), gets the same
      // generic 400 as any other data-dependent rejection. Never reveal that
      // an email is registered.
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });
      if (existingUser) {
        return res.status(400).json(REGISTER_REJECTED);
      }

      let user;
      try {
        user = await prisma.user.create({
          data: {
            email,
            name,
            passwordHash,
            phone: phone || null,
            role: "USER",
          },
        });
      } catch (createError) {
        if (createError && createError.code === "P2002") {
          return res.status(400).json(REGISTER_REJECTED);
        }
        throw createError;
      }

      // Generate JWT
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isHNW: user.isHNW || false,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "24h" }
      );

      const refreshToken = jwt.sign(
        { id: user.id, type: "refresh" },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d" }
      );

      notifySignup({ role: user.role, method: "password" });

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isHNW: user.isHNW || false,
        },
        token,
        refreshToken,
      });
    } catch (error) {
      console.error("Error registering user:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  });

  // ── POST /api/auth/login ───────────────────────────────────────────────────
  router.post("/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      // Validation
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: "email and password are required",
        });
      }

      // Find user
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user || !user.passwordHash) {
        return res.status(401).json({
          success: false,
          error: "Invalid credentials",
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: "Invalid credentials",
        });
      }

      // Generate JWT with isHNW flag
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isHNW: user.isHNW || false,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "24h" }
      );

      const refreshToken = jwt.sign(
        { id: user.id, type: "refresh" },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d" }
      );

      res.json({
        success: true,
        message: "Login successful",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isHNW: user.isHNW || false,
        },
        token,
        refreshToken,
      });
    } catch (error) {
      console.error("Error logging in:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  });

  // ── Passkey / WebAuthn Endpoints ───────────────────────────────────────────

  // POST /api/auth/passkey/register/options
  // Step 1 of registration ceremony: get challenge
  router.post("/passkey/register/options", requireAuth, async (req, res) => {
    try {
      if (!webauthnService.isWebAuthnEnabled()) {
        return res.status(501).json({
          success: false,
          error: "Passkey authentication is not configured. Set WEBAUTHN_ENABLED=true.",
        });
      }

      // A passkey can only be added to the signed-in account. A body userId
      // is accepted for compatibility but must match the token.
      const userId = req.user.id;
      if (req.body.userId !== undefined && Number(req.body.userId) !== userId) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      // Fetch user
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { passkeys: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      const options = await webauthnService.generatePasskeyRegistrationOptions(
        { id: user.id, name: user.name, email: user.email },
        user.passkeys
      );

      // Delete any previous unexpired challenges for this user (one active challenge at a time)
      await prisma.passkeyChallenge.deleteMany({ where: { userId: user.id } });

      // Store challenge server-side with 5-minute TTL — never trust the client to supply it
      await prisma.passkeyChallenge.create({
        data: {
          userId: user.id,
          challenge: options.challenge,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });

      res.json({ success: true, options });
    } catch (error) {
      console.error("Error generating passkey registration options:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Internal server error",
      });
    }
  });

  // POST /api/auth/passkey/register/verify
  // Step 2 of registration ceremony: verify and store credential
  router.post("/passkey/register/verify", requireAuth, async (req, res) => {
    try {
      if (!webauthnService.isWebAuthnEnabled()) {
        return res.status(501).json({
          success: false,
          error: "Passkey authentication is not configured.",
        });
      }

      const userId = req.user.id;
      const { credential } = req.body;
      if (req.body.userId !== undefined && Number(req.body.userId) !== userId) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }
      if (!credential) {
        return res.status(400).json({
          success: false,
          error: "credential is required",
        });
      }

      // Fetch and consume the stored challenge — one-time use
      const storedChallenge = await prisma.passkeyChallenge.findFirst({
        where: { userId, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      });

      if (!storedChallenge) {
        return res.status(400).json({
          success: false,
          error: "No valid challenge found. Request new registration options.",
        });
      }

      await prisma.passkeyChallenge.delete({ where: { id: storedChallenge.id } });

      const result = await webauthnService.verifyAndStorePasskey(
        prisma,
        userId,
        credential,
        storedChallenge.challenge
      );

      res.json({
        success: true,
        message: "Passkey registered successfully",
        credentialId: result.credential.credentialId,
      });
    } catch (error) {
      console.error("Error verifying passkey registration:", error);
      res.status(400).json({
        success: false,
        error: error.message || "Passkey registration failed",
      });
    }
  });

  // POST /api/auth/passkey/login/options
  // Step 1 of authentication ceremony: get challenge
  router.post("/passkey/login/options", async (req, res) => {
    try {
      if (!webauthnService.isWebAuthnEnabled()) {
        return res.status(501).json({
          success: false,
          error: "Passkey authentication is not configured.",
        });
      }

      const { email } = req.body;

      // If email is provided, fetch their credentials for discoverable login
      let allowedCredentials = [];
      if (email) {
        const user = await prisma.user.findUnique({
          where: { email },
          include: { passkeys: true },
        });
        if (user) {
          allowedCredentials = user.passkeys;
        }
      }

      const options = await webauthnService.generatePasskeyAuthenticationOptions(
        allowedCredentials
      );

      // Store challenge server-side (userId may be null for discoverable/usernameless flows)
      const userId = email
        ? (await prisma.user.findUnique({ where: { email }, select: { id: true } }))?.id ?? null
        : null;

      await prisma.passkeyChallenge.create({
        data: {
          userId,
          challenge: options.challenge,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });

      res.json({ success: true, options });
    } catch (error) {
      console.error("Error generating passkey login options:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Internal server error",
      });
    }
  });

  // POST /api/auth/passkey/login/verify
  // Step 2 of authentication ceremony: verify assertion and issue JWT
  router.post("/passkey/login/verify", async (req, res) => {
    try {
      if (!webauthnService.isWebAuthnEnabled()) {
        return res.status(501).json({
          success: false,
          error: "Passkey authentication is not configured.",
        });
      }

      const { credential } = req.body;
      if (!credential) {
        return res.status(400).json({
          success: false,
          error: "credential is required",
        });
      }

      // Look up the credential by ID from the assertion
      const credentialId = credential.id;
      if (!credentialId) {
        return res.status(400).json({
          success: false,
          error: "credential.id is required",
        });
      }

      const storedCredential = await prisma.passkeyCredential.findUnique({
        where: { credentialId },
        include: { user: true },
      });

      if (!storedCredential) {
        return res.status(404).json({
          success: false,
          error: "Passkey credential not found",
        });
      }

      // Extract challenge from clientDataJSON and look it up server-side
      let challengeValue;
      try {
        const clientData = JSON.parse(
          Buffer.from(credential.response.clientDataJSON, "base64").toString("utf8")
        );
        challengeValue = clientData.challenge;
      } catch {
        return res.status(400).json({ success: false, error: "Invalid clientDataJSON" });
      }

      const storedChallenge = await prisma.passkeyChallenge.findUnique({
        where: { challenge: challengeValue },
      });

      if (!storedChallenge || storedChallenge.expiresAt < new Date()) {
        if (storedChallenge) await prisma.passkeyChallenge.delete({ where: { id: storedChallenge.id } });
        return res.status(400).json({ success: false, error: "Invalid or expired challenge" });
      }

      await prisma.passkeyChallenge.delete({ where: { id: storedChallenge.id } });

      const result = await webauthnService.verifyPasskeyAuthentication(
        credential,
        storedCredential,
        challengeValue
      );

      // Update counter to prevent replay attacks
      await prisma.passkeyCredential.update({
        where: { id: storedCredential.id },
        data: {
          counter: result.newCounter,
          lastUsedAt: new Date(),
        },
      });

      // Issue access + refresh tokens
      const user = storedCredential.user;
      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name, role: user.role, isHNW: user.isHNW || false },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "24h" }
      );
      const refreshToken = jwt.sign(
        { id: user.id, type: "refresh" },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d" }
      );

      res.json({
        success: true,
        message: "Passkey login successful",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isHNW: user.isHNW || false,
        },
        token,
        refreshToken,
      });
    } catch (error) {
      console.error("Error verifying passkey login:", error);
      res.status(400).json({
        success: false,
        error: error.message || "Passkey authentication failed",
      });
    }
  });

  // GET /api/auth/passkeys — List user's registered passkeys
  router.get("/passkeys", requireAuth, async (req, res) => {
    try {
      const passkeys = await prisma.passkeyCredential.findMany({
        where: { userId: req.user.id },
        select: {
          id: true,
          credentialId: true,
          name: true,
          deviceType: true,
          backedUp: true,
          createdAt: true,
          lastUsedAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      res.json({ success: true, data: passkeys });
    } catch (error) {
      console.error("Error listing passkeys:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  });

  // DELETE /api/auth/passkeys/:credentialId — Remove a passkey
  router.delete("/passkeys/:credentialId", requireAuth, async (req, res) => {
    try {
      const { credentialId } = req.params;

      // Verify ownership
      const credential = await prisma.passkeyCredential.findUnique({
        where: { credentialId },
      });

      if (!credential || credential.userId !== req.user.id) {
        return res.status(404).json({
          success: false,
          error: "Passkey not found",
        });
      }

      await prisma.passkeyCredential.delete({
        where: { id: credential.id },
      });

      res.json({
        success: true,
        message: "Passkey removed successfully",
      });
    } catch (error) {
      console.error("Error removing passkey:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  });

  // ── POST /api/auth/refresh ─────────────────────────────────────────────────
  // Exchange a valid refresh token for a new access token + refresh token pair.
  // Refresh tokens carry type:"refresh" in the payload to prevent access tokens
  // from being used here.
  router.post("/refresh", async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: "refreshToken is required" });
    }
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
      if (decoded.type !== "refresh") {
        return res.status(401).json({ success: false, error: "Invalid token type" });
      }
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (!user) {
        return res.status(401).json({ success: false, error: "User not found" });
      }
      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name, role: user.role, isHNW: user.isHNW || false },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
      );
      const newRefreshToken = jwt.sign(
        { id: user.id, type: "refresh" },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d" }
      );
      return res.json({ success: true, token, refreshToken: newRefreshToken });
    } catch {
      return res.status(401).json({ success: false, error: "Invalid or expired refresh token" });
    }
  });

  return router;
};
