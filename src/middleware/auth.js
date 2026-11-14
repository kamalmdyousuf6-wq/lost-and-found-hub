const jwt = require("jsonwebtoken");

function authenticate(allowedRoles = []) {
  return (req, res, next) => {
    const header = req.get("authorization") || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: "Authentication required." });
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ["HS256"]
      });

      if (!payload.sub || !["user", "admin"].includes(payload.role)) {
        return res.status(401).json({ error: "Invalid authentication token." });
      }

      if (allowedRoles.length && !allowedRoles.includes(payload.role)) {
        return res.status(403).json({ error: "You do not have permission to do this." });
      }

      req.auth = {
        id: Number(payload.sub),
        role: payload.role
      };

      next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired authentication token." });
    }
  };
}

module.exports = { authenticate };