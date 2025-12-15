// src/routes/friends.routes.ts
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

/* SEARCH USERS BY USERNAME */
router.get("/users/search", authRequired, async (req: any, res: any) => {
  const myId = requireAuth(req, res);
  if (!myId) return;

  try {
    const q = normUsername(req.query?.username);
    if (!q) return res.json({ users: [] });

    const users = await prisma.user.findMany({
      where: {
        username: { contains: q, mode: "insensitive" as any },
        NOT: { id: myId },
      },
      select: { id: true, username: true, name: true, avatarUrl: true },
      take: 10,
    });

    return res.json({ users });
  } catch (e) {
    console.error("search users error", e);
    return res.status(500).json({ error: "Server error" });
  }
});

/* USER PROFILE BY USERNAME */
router.get("/users/:username", authRequired, async (req: any, res: any) => {
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

    const outgoing = await prisma.friendRequest.findFirst({
      where: { fromUserId: myId, toUserId: user.id, status: "PENDING" },
      select: { id: true },
    });

    return res.json({ user, isFriend, requestSent: !!outgoing });
  } catch (e) {
    console.error("get user by username error", e);
    return res.status(500).json({ error: "Server error" });
  }
});

/* SEND FRIEND REQUEST */
router.post("/friends/request", authRequired, async (req: any, res: any) => {
  const myId = requireAuth(req, res);
  if (!myId) return;

  try {
    const username = normUsername(req.body?.username);
    if (!username) return res.status(400).json({ error: "Missing username" });

    const target = await prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true },
    });

    if (!target) return res.status(404).json({ error: "User not found" });
    if (target.id === myId) return res.status(400).json({ error: "Cannot add yourself" });

    const alreadyFriends = await prisma.friend.findUnique({
      where: { userId_friendId: { userId: myId, friendId: target.id } },
      select: { id: true },
    });
    if (alreadyFriends) return res.status(409).json({ error: "Already friends" });

    const existingReq = await prisma.friendRequest.findFirst({
      where: { fromUserId: myId, toUserId: target.id },
      select: { id: true, status: true },
    });

    if (existingReq) {
      if (existingReq.status === "PENDING") return res.json({ ok: true, requestSent: true });

      await prisma.friendRequest.update({
        where: { id: existingReq.id },
        data: { status: "PENDING" },
      });

      return res.json({ ok: true, requestSent: true });
    }

    await prisma.friendRequest.create({
      data: { fromUserId: myId, toUserId: target.id, status: "PENDING" },
    });

    return res.json({ ok: true, requestSent: true });
  } catch (e) {
    console.error("friend request error", e);
    return res.status(500).json({ error: "Server error" });
  }
});

/* INCOMING REQUESTS */
router.get("/friends/requests/incoming", authRequired, async (req: any, res: any) => {
  const myId = requireAuth(req, res);
  if (!myId) return;

  try {
    const incoming = await prisma.friendRequest.findMany({
      where: { toUserId: myId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: {
        fromUser: { select: { id: true, username: true, name: true, avatarUrl: true } },
      },
    });

    return res.json({
      count: incoming.length,
      incoming: incoming.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        from: r.fromUser,
      })),
    });
  } catch (e) {
    console.error("incoming requests error", e);
    return res.status(500).json({ error: "Server error" });
  }
});

/* ACCEPT REQUEST */
router.post("/friends/requests/:id/accept", authRequired, async (req: any, res: any) => {
  const myId = requireAuth(req, res);
  if (!myId) return;

  try {
    const requestId = String(req.params?.id ?? "").trim();
    if (!requestId) return res.status(400).json({ error: "Missing request id" });

    const request = await prisma.friendRequest.findUnique({
      where: { id: requestId },
      select: { id: true, fromUserId: true, toUserId: true, status: true },
    });

    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.toUserId !== myId) return res.status(403).json({ error: "Forbidden" });
    if (request.status !== "PENDING") return res.status(409).json({ error: "Request not pending" });

    await prisma.$transaction(async (tx) => {
      await tx.friendRequest.update({
        where: { id: requestId },
        data: { status: "ACCEPTED" },
      });

      await tx.friend.create({ data: { userId: myId, friendId: request.fromUserId } }).catch(() => null);
      await tx.friend.create({ data: { userId: request.fromUserId, friendId: myId } }).catch(() => null);
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error("accept request error", e);
    return res.status(500).json({ error: "Server error" });
  }
});

/* DECLINE REQUEST */
router.post("/friends/requests/:id/decline", authRequired, async (req: any, res: any) => {
  const myId = requireAuth(req, res);
  if (!myId) return;

  try {
    const requestId = String(req.params?.id ?? "").trim();
    if (!requestId) return res.status(400).json({ error: "Missing request id" });

    const request = await prisma.friendRequest.findUnique({
      where: { id: requestId },
      select: { id: true, toUserId: true, status: true },
    });

    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.toUserId !== myId) return res.status(403).json({ error: "Forbidden" });
    if (request.status !== "PENDING") return res.status(409).json({ error: "Request not pending" });

    await prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: "DECLINED" },
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error("decline request error", e);
    return res.status(500).json({ error: "Server error" });
  }
});

/* GET FRIENDS */
router.get("/friends", authRequired, async (req: any, res: any) => {
  const myId = requireAuth(req, res);
  if (!myId) return;

  try {
    const friends = await prisma.friend.findMany({
      where: { userId: myId },
      include: { friend: { select: { id: true, username: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ friends: friends.map((f) => f.friend) });
  } catch (e) {
    console.error("get friends error", e);
    return res.status(500).json({ error: "Server error" });
  }
});

/* REMOVE FRIEND */
router.delete("/friends/:friendId", authRequired, async (req: any, res: any) => {
  const myId = requireAuth(req, res);
  if (!myId) return;

  try {
    const friendId = String(req.params?.friendId ?? "").trim();
    if (!friendId) return res.status(400).json({ error: "Missing friendId" });
    if (friendId === myId) return res.status(400).json({ error: "Invalid friendId" });

    await prisma.$transaction(async (tx) => {
      await tx.friend.deleteMany({ where: { userId: myId, friendId } });
      await tx.friend.deleteMany({ where: { userId: friendId, friendId: myId } });
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error("remove friend error", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;