const jwt = require("jsonwebtoken");

module.exports = function authRequired(req, res, next) {
  const header = String(req.headers.authorization || "");
  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = header.slice(7);
  const secret = process.env.JWT_SECRET;
  if (!secret) return res.status(500).json({ error: "JWT_SECRET missing" });

  try {
    const decoded = jwt.verify(token, secret);
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ error: "Invalid token" });
    }
    req.auth = { userId: decoded.userId };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};