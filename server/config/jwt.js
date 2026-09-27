const jwt = require('jsonwebtoken')
const User = require('../models/User')

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key'
const EXPIRES_IN = '7d'

function signToken(payload) {
  return jwt.sign({
    id: payload.id,
    email: payload.email,
    role: payload.role
  }, JWT_SECRET, { expiresIn: EXPIRES_IN })
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET)
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return res.status(401).json({ message: 'Unauthorized' })
  try {
    req.user = verifyToken(token)
    User.findById(req.user.id)
      .then((user) => {
        if (!user || !user.isActive) {
          return res.status(401).json({ message: 'Unauthorized' })
        }

        if (
          user.userType !== 'admin' &&
          user.applicationStatus !== 'accepted'
        ) {
          const statusMessage =
            user.applicationStatus === 'rejected'
              ? 'Your application has been rejected by admin'
              : 'Your registration is pending admin approval'
          return res.status(403).json({ message: statusMessage })
        }

        req.user.role = user.userType
        next()
      })
      .catch(() => res.status(401).json({ message: 'Unauthorized' }))
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' })
  }
}

module.exports = { signToken, verifyToken, authMiddleware }


