/**
 * ╔══════════════════════════════════════╗
 * ║   AUTH MIDDLEWARE                    ║
 * ║   JWT Token verification             ║
 * ║   Protects private routes            ║
 * ╚══════════════════════════════════════╝
 *
 * How it works:
 *   1. Frontend sends: Authorization: Bearer <token>
 *   2. This middleware verifies the token
 *   3. Attaches req.user = { id, email } for route handlers
 *   4. If token is invalid → returns 401
 */

const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided. Please log in.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.userId, email: decoded.email };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token. Please log in again.' });
  }
}

module.exports = authMiddleware;
