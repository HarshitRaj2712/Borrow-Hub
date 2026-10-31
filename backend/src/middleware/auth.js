import jwt from 'jsonwebtoken'
import { User } from '../models/User.js'

function getSecret() {
  const secret = process.env.JWT_SECRET?.trim()
  if (!secret || secret.length < 64) throw new Error('JWT_SECRET must be at least 64 characters. Configure a strong secret in backend/.env before starting the API.')
  return secret
}

export function issueToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email, name: user.name, ver: user.tokenVersion || 0 }, getSecret(), { expiresIn: '15m' })
}

export async function requireAuth(req, res, next) {
  const header = req.get('authorization')
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' })
  let claims
  try {
    claims = jwt.verify(header.slice(7), getSecret())
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
  const user = await User.findOne({ id: claims.sub }).select('id tokenVersion isActive').lean()
  if (!user || !user.isActive || user.tokenVersion !== claims.ver) return res.status(401).json({ error: 'Session has been invalidated' })
  req.auth = claims
  return next()
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) return res.status(403).json({ error: 'You do not have permission for this action' })
    return next()
  }
}
