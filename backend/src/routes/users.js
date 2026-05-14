const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");

module.exports = (prisma) => {
  const router = express.Router();

  // GET /api/users — STUDIO_ADMIN only
  router.get("/", requireAuth, requireRole("STUDIO_ADMIN"), async (_req, res) => {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isVerified: true,
          isHNW: true,
          truthIndex: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
      res.json({ success: true, data: users });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // GET /api/users/:id — Public profile (no auth required, but excludes sensitive fields)
  router.get("/:id", async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      if (isNaN(userId)) {
        return res.status(400).json({ success: false, error: "Invalid user ID" });
      }

      const include = {};
      if (req.query.include) {
        const parts = req.query.include.split(",");
        if (parts.includes("listings")) {
          include.listings = {
            select: { id: true, title: true, price: true, status: true, createdAt: true },
          };
        }
        if (parts.includes("reviews")) {
          include.reviews = {
            include: { listing: { select: { id: true, title: true } } },
          };
        }
        if (parts.includes("passkeys")) {
          // Only include passkey count, not the actual credentials
          include._count = { select: { passkeys: true } };
        }
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: Object.keys(include).length > 0 ? include : undefined,
      });

      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      // Exclude sensitive fields from response
      const { passwordHash, ...safeUser } = user;
      res.json({ success: true, data: safeUser });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // PUT /api/users/:id — STUDIO_ADMIN only (for role management, verification)
  router.put("/:id", requireAuth, requireRole("STUDIO_ADMIN"), async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      if (isNaN(userId)) {
        return res.status(400).json({ success: false, error: "Invalid user ID" });
      }

      const { name, email, phone, role, isVerified, isHNW } = req.body;

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;
      if (role !== undefined) updateData.role = role;
      if (isVerified !== undefined) updateData.isVerified = isVerified;
      if (isHNW !== undefined) {
        updateData.isHNW = isHNW;
        updateData.hnwVerifiedAt = isHNW ? new Date() : null;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ success: false, error: "No valid fields provided for update" });
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
      });

      const { passwordHash, ...safeUser } = updatedUser;
      res.json({ success: true, data: safeUser });
    } catch (error) {
      if (error.code === "P2025") {
        return res.status(404).json({ success: false, error: "User not found" });
      }
      if (error.code === "P2002") {
        return res.status(409).json({ success: false, error: "A user with this email already exists" });
      }
      console.error("Error updating user:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // DELETE /api/users/:id — STUDIO_ADMIN only
  router.delete("/:id", requireAuth, requireRole("STUDIO_ADMIN"), async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      if (isNaN(userId)) {
        return res.status(400).json({ success: false, error: "Invalid user ID" });
      }

      await prisma.user.delete({ where: { id: userId } });
      res.status(204).send();
    } catch (error) {
      if (error.code === "P2025") {
        return res.status(404).json({ success: false, error: "User not found" });
      }
      console.error("Error deleting user:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  return router;
};
