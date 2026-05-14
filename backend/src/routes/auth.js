const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const webauthnService = require("../services/webauthnService");

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

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          error: "Password must be at least 8 characters",
        });
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: "Email already registered",
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          name,
          passwordHash,
          phone: phone || null,
          role: "USER",
        },
      });

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
        { expiresIn: "24h" }
      );

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

      if (!user) {
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
        { expiresIn: "24h" }
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
  router.post("/passkey/register/options", async (req, res) => {
    try {
      if (!webauthnService.isWebAuthnEnabled()) {
        return res.status(501).json({
          success: false,
          error: "Passkey authentication is not configured. Set WEBAUTHN_ENABLED=true.",
        });
      }

      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "userId is required",
        });
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

      // Store challenge in the database (via user record or Redis; for now pass back)
      // In production, store challenge in Redis with TTL
      res.json({
        success: true,
        options,
        // Frontend needs to pass this challenge back in the verify step
        challenge: options.challenge,
      });
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
  router.post("/passkey/register/verify", async (req, res) => {
    try {
      if (!webauthnService.isWebAuthnEnabled()) {
        return res.status(501).json({
          success: false,
          error: "Passkey authentication is not configured.",
        });
      }

      const { userId, credential } = req.body;
      if (!userId || !credential) {
        return res.status(400).json({
          success: false,
          error: "userId and credential are required",
        });
      }

      const result = await webauthnService.verifyAndStorePasskey(
        prisma,
        userId,
        credential
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

      res.json({
        success: true,
        options,
        challenge: options.challenge,
      });
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

      const result = await webauthnService.verifyPasskeyAuthentication(
        credential,
        storedCredential
      );

      // Update counter to prevent replay attacks
      await prisma.passkeyCredential.update({
        where: { id: storedCredential.id },
        data: {
          counter: result.newCounter,
          lastUsedAt: new Date(),
        },
      });

      // Issue JWT
      const user = storedCredential.user;
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isHNW: user.isHNW || false,
        },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
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
  router.get("/passkeys", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const passkeys = await prisma.passkeyCredential.findMany({
        where: { userId: decoded.id },
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
  router.delete("/passkeys/:credentialId", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const { credentialId } = req.params;

      // Verify ownership
      const credential = await prisma.passkeyCredential.findUnique({
        where: { credentialId },
      });

      if (!credential || credential.userId !== decoded.id) {
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

  return router;
};
