import { Router } from "express";
import prisma from "../prisma"; // change if your prisma client path differs

const router = Router();

// GET /api/users/search?username=sep
router.get("/users/search", async (req, res) => {
  const q = String(req.query.username || "").trim().toLowerCase();
  if (!q) return res.json({ users: [] });

  const users = await prisma.user.findMany({
    where: { username: { contains: q } },
    select: { id: true, username: true },
    take: 10,
  });

  res.json({ users });
});

// POST /api/friends/request { username }
router.post("/friends/request", async (req: any, res) => {
  const myId = req.user?.id;
  if (!myId) return res.status(401).json({ error: "Unauthorized" });

  const username = String(req.body.username || "").trim().toLowerCase();
  if (!username) return res.status(400).json({ error: "Missing username" });

  const target = await prisma.user.findUnique({ where: { username } });
  if (!target) return res.status(404).json({ error: "User not found" });
  if (target.id === myId) return res.status(400).json({ error: "Cannot add yourself" });

  const alreadyFriend = await prisma.friend.findUnique({
    where: { userId_friendId: { userId: myId, friendId: target.id } },
  });
  if (alreadyFriend) return res.status(409).json({ error: "Already friends" });

  const existing = await prisma.friendRequest.findFirst({
    where: {
      status: "PENDING",
      OR: [
        { fromUserId: myId, toUserId: target.id },
        { fromUserId: target.id, toUserId: myId },
      ],
    },
  });
  if (existing) return res.status(409).json({ error: "Request already pending" });

  const fr = await prisma.friendRequest.create({
    data: { fromUserId: myId, toUserId: target.id, status: "PENDING" },
    select: { id: true, status: true, createdAt: true },
  });

  res.json({ request: fr });
});

// GET /api/friends/requests (incoming)
router.get("/friends/requests", async (req: any, res) => {
  const myId = req.user?.id;
  if (!myId) return res.status(401).json({ error: "Unauthorized" });

  const incoming = await prisma.friendRequest.findMany({
    where: { toUserId: myId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: { fromUser: { select: { id: true, username: true } } },
  });

  res.json({
    incoming: incoming.map((r) => ({
      id: r.id,
      from: r.fromUser,
      createdAt: r.createdAt,
    })),
  });
});

// POST /api/friends/accept { requestId }
router.post("/friends/accept", async (req: any, res) => {
  const myId = req.user?.id;
  if (!myId) return res.status(401).json({ error: "Unauthorized" });

  const requestId = String(req.body.requestId || "").trim();
  if (!requestId) return res.status(400).json({ error: "Missing requestId" });

  const fr = await prisma.friendRequest.findUnique({ where: { id: requestId } });
  if (!fr || fr.toUserId !== myId) return res.status(404).json({ error: "Request not found" });
  if (fr.status !== "PENDING") return res.status(409).json({ error: "Request already handled" });

  await prisma.$transaction([
    prisma.friendRequest.update({ where: { id: requestId }, data: { status: "ACCEPTED" } }),
    prisma.friend.upsert({
      where: { userId_friendId: { userId: fr.fromUserId, friendId: fr.toUserId } },
      update: {},
      create: { userId: fr.fromUserId, friendId: fr.toUserId },
    }),
    prisma.friend.upsert({
      where: { userId_friendId: { userId: fr.toUserId, friendId: fr.fromUserId } },
      update: {},
      create: { userId: fr.toUserId, friendId: fr.fromUserId },
    }),
  ]);

  res.json({ ok: true });
});

// POST /api/friends/decline { requestId }
router.post("/friends/decline", async (req: any, res) => {
  const myId = req.user?.id;
  if (!myId) return res.status(401).json({ error: "Unauthorized" });

  const requestId = String(req.body.requestId || "").trim();
  if (!requestId) return res.status(400).json({ error: "Missing requestId" });

  const fr = await prisma.friendRequest.findUnique({ where: { id: requestId } });
  if (!fr || fr.toUserId !== myId) return res.status(404).json({ error: "Request not found" });
  if (fr.status !== "PENDING") return res.status(409).json({ error: "Request already handled" });

  await prisma.friendRequest.update({ where: { id: requestId }, data: { status: "DECLINED" } });

  res.json({ ok: true });
});

// GET /api/friends
router.get("/friends", async (req: any, res) => {
  const myId = req.user?.id;
  if (!myId) return res.status(401).json({ error: "Unauthorized" });

  const rows = await prisma.friend.findMany({
    where: { userId: myId },
    include: { friend: { select: { id: true, username: true } } },
    orderBy: { createdAt: "desc" },
  });

  res.json({
    friends: rows.map((r) => r.friend),
  });
});

export default router;