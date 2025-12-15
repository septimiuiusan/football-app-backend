// src/routes/users.routes.ts
import express from "express";
import { PrismaClient } from "@prisma/client";
import authRequired from "../middleware/authRequired.js";

const prisma = new PrismaClient();
const router = express.Router();

function normUsername(v: any) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._]/g, "");
}

function requireAuth(req: any, res: any): string | null {
  const myId = req.auth?.userId;
  if (!myId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return String(myId);
}

/* ✅ MUST be before "/:username" */
router.get("/search", authRequired, async (req: any, res: any) => {
  const myId = requireAuth(req, res);
  if (!myId) return;

  try {
    const q = normUsername(req.query?.username);
    if (!q) return res.json({ users: [] });

    const users = await prisma.user.findMany({
      where: {
        username: { contains: q },
        NOT: { id: myId },
      },
      select: { id: true, username: true, name: true, avatarUrl: true },
      take: 10,
    });

    return res.json({ users });
  } catch (e) {
    console.error("users search error", e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/:username", authRequired, async (req: any, res: any) => {
  const myId = requireAuth(req, res);
  if (!myId) return;

  try {
    const username = normUsername(req.params?.username);
    if (!username) return res.status(400).json({ error: "Missing username" });

    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true, name: true, avatarUrl: true },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    const isFriend = !!(await prisma.friend.findUnique({
      where: { userId_friendId: { userId: myId, friendId: user.id } },
      select: { id: true },
    }));

    return res.json({ user, isFriend });
  } catch (e) {
    console.error("get user by username error", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;