const express = require("express");
const prismaMod = require("../prisma");
const authRequired = require("../middleware/authRequired");
const prisma = prismaMod.default || prismaMod;

const router = express.Router();


function requireAuth(req: any, res: Response) {
  const myId = req.auth?.userId;
  if (!myId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return myId as string;
}

/* SEARCH USERS BY USERNAME */
router.get("/users/search", authRequired, async (req, res) => {
    const myId = requireAuth(req, res);
  if (!myId) return;

  try {
    const q = String(req.query.username || "").trim().toLowerCase();
    if (!q) return res.json({ users: [] });

    const users = await prisma.user.findMany({
      where: { username: { contains: q } },
      select: { id: true, username: true },
      take: 10,
    });

    return res.json({ users });
  } catch (e) {
    console.error("search users error", e);
    return res.status(500).json({ error: "Server error" });
  }
});

/* SEND FRIEND REQUEST */
router.post("/friends/request", authRequired, async (req, res) => {  const myId = requireAuth(req, res);
  if (!myId) return;

  try {
    const username = String(req.body.username || "").trim().toLowerCase();
    if (!username) return res.status(400).json({ error: "Missing username" });

    const target = await prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true },
    });

    if (!target) return res.status(404).json({ error: "User not found" });
    if (target.id === myId) {
      return res.status(400).json({ error: "Cannot add yourself" });
    }

    try {
      await prisma.friendRequest.create({
        data: { fromUserId: myId, toUserId: target.id },
      });
    } catch (e) {
      if (e && e.code === "P2002") {
        return res.status(409).json({ error: "Request already sent" });
      }
      throw e;
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("friend request error", e);
    return res.status(500).json({ error: "Server error" });
  }
});

/* GET FRIENDS */
router.get("/friends", async (req, res) => {
    const myId = requireAuth(req, res);
  if (!myId) return;

  try {
    const friends = await prisma.friend.findMany({
      where: { userId: myId },
      include: { friend: { select: { id: true, username: true } } },
    });

    return res.json({ friends: friends.map((f) => f.friend) });
  } catch (e) {
    console.error("get friends error", e);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;