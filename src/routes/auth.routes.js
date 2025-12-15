const express = require("express");
const bcrypt = require("bcrypt"); // keep bcrypt if installed
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const authRequired = require("../middleware/authRequired");

const prisma = new PrismaClient();
const router = express.Router();

function signToken(userId) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET missing");
  return jwt.sign({ userId }, secret, { expiresIn: "7d" });
}

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function normUsername(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._]/g, "");
}

function baseFromEmail(email) {
  const base = (String(email).split("@")[0] || "user").toLowerCase();
  const cleaned = base.replace(/[^a-z0-9._]/g, "");
  return cleaned || `user${Math.floor(1000 + Math.random() * 9000)}`;
}

async function generateUniqueUsername(desired, email) {
  const base = normUsername(desired) || baseFromEmail(email);

  const tries = [
    base,
    `${base}${Math.floor(1000 + Math.random() * 9000)}`,
    `${base}${Date.now().toString().slice(-6)}`,
  ];

  for (const u of tries) {
    const exists = await prisma.user.findUnique({
      where: { username: u },
      select: { id: true },
    });
    if (!exists) return u;
  }
  return `${base}${Date.now()}`;
}

/* ---------- MULTER SETUP (avatar upload) ---------- */
const AVATAR_DIR = path.join(process.cwd(), "uploads", "avatars");
if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATAR_DIR),
  filename: (req, file, cb) => {
    const userId = req.auth?.userId || "anon";
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    cb(null, `${userId}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

/* ---------- GET ME ---------- */
router.get("/me", authRequired, async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Invalid token" });

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true, name: true, avatarUrl: true },
    });

    if (!dbUser) return res.status(404).json({ error: "User not found" });

    return res.json({
      user: {
        id: dbUser.id,
        email: dbUser.email,
        username: dbUser.username,
        name: dbUser.name ?? dbUser.username,
        avatarUrl: dbUser.avatarUrl ?? null,
      },
    });
  } catch (e) {
    console.log("me error", e);
    return res.status(500).json({ error: "Server error" });
  }
});

/* ---------- UPDATE PROFILE (name, username, avatarUrl) ---------- */
router.put("/me", authRequired, async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Invalid token" });

    const { name, username, avatarUrl } = req.body || {};
    const data = {};

    if (typeof name === "string") data.name = name.trim() || null;

    if (typeof username === "string") {
      const u = normUsername(username);
      if (!u) return res.status(400).json({ error: "Invalid username" });
      data.username = u;
    }

    if (typeof avatarUrl === "string") data.avatarUrl = avatarUrl.trim() || null;

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, username: true, name: true, avatarUrl: true },
    });

    return res.json({
      user: {
        id: updated.id,
        email: updated.email,
        username: updated.username,
        name: updated.name ?? updated.username,
        avatarUrl: updated.avatarUrl ?? null,
      },
    });
  } catch (e) {
    console.log("update me error", e);
    if (e?.code === "P2002") return res.status(409).json({ error: "Username already in use" });
    return res.status(500).json({ error: "Server error" });
  }
});

/* ---------- CHANGE PASSWORD ---------- */
router.put("/me/password", authRequired, async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Invalid token" });

    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "Missing passwords" });
    if (String(newPassword).length < 8) return res.status(400).json({ error: "New password must be at least 8 characters" });

    const userWithHash = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!userWithHash) return res.status(404).json({ error: "User not found" });

    const ok = await bcrypt.compare(String(currentPassword), String(userWithHash.passwordHash));
    if (!ok) return res.status(401).json({ error: "Current password incorrect" });

    const passwordHash = await bcrypt.hash(String(newPassword), 10);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return res.json({ ok: true });
  } catch (e) {
    console.log("change password error", e);
    return res.status(500).json({ error: "Server error" });
  }
});

/* ---------- UPLOAD AVATAR (file) ---------- */
router.post("/me/avatar", authRequired, upload.single("avatar"), async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Invalid token" });
    if (!req.file) return res.status(400).json({ error: "Missing file" });

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const avatarUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: { id: true, email: true, username: true, name: true, avatarUrl: true },
    });

    return res.json({
      user: {
        id: updated.id,
        email: updated.email,
        username: updated.username,
        name: updated.name ?? updated.username,
        avatarUrl: updated.avatarUrl ?? null,
      },
    });
  } catch (e) {
    console.log("upload avatar error", e);
    return res.status(500).json({ error: "Server error" });
  }
});

/* ---------- SIGNUP ---------- */
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, username } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    if (String(password).length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

    const normalizedEmail = normEmail(email);

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existing) return res.status(409).json({ error: "Email already in use" });

    const passwordHash = await bcrypt.hash(String(password), 10);

    const finalUsername =
      (typeof username === "string" && normUsername(username)) ||
      (typeof name === "string" && normUsername(name)) ||
      (await generateUniqueUsername(name, normalizedEmail));

    const created = await prisma.user.create({
      data: {
        email: normalizedEmail,
        username: finalUsername,
        name: typeof name === "string" ? name.trim() || null : null,
        passwordHash,
        avatarUrl: null,
      },
      select: { id: true, email: true, username: true, name: true, avatarUrl: true },
    });

    const token = signToken(created.id);

    return res.json({
      token,
      user: {
        id: created.id,
        email: created.email,
        username: created.username,
        name: created.name ?? created.username,
        avatarUrl: created.avatarUrl ?? null,
      },
    });
  } catch (e) {
    console.log("signup error", e);
    if (e?.code === "P2002") return res.status(409).json({ error: "Username already in use" });
    return res.status(500).json({ error: "Server error" });
  }
});

/* ---------- LOGIN (email + password only) ---------- */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const normalizedEmail = normEmail(email);

    const userWithHash = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, username: true, name: true, avatarUrl: true, passwordHash: true },
    });

    if (!userWithHash) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(String(password), String(userWithHash.passwordHash));
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = signToken(userWithHash.id);

    return res.json({
      token,
      user: {
        id: userWithHash.id,
        email: userWithHash.email,
        username: userWithHash.username,
        name: userWithHash.name ?? userWithHash.username,
        avatarUrl: userWithHash.avatarUrl ?? null,
      },
    });
  } catch (e) {
    console.log("login error", e);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;