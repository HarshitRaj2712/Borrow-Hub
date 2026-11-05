import jwt from 'jsonwebtoken'
import { User } from '../models/User.js'

function getSecret() {
  const secret = process.env.JWT_SECRET?.trim()
  if (!secret || secret.length < 64) throw new Error('JWT_SECRET must be at least 64 characters. Configure a strong secret in backend/.env before starting the API.')
  return secret
}

function getTokenVersion(value) {
  const version = Number(value)
  return Number.isInteger(version) && version >= 0 ? version : 0
}

export function issueToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email, name: user.name, ver: getTokenVersion(user.tokenVersion) }, getSecret(), { expiresIn: '15m' })
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.get('authorization')
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' })
    let claims
    try {
      claims = jwt.verify(header.slice(7), getSecret())
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }
    const user = await User.findOne({ id: claims.sub }).select('id tokenVersion isActive role name email').lean()
    const tokenVersion = getTokenVersion(user?.tokenVersion)
    const claimVersion = getTokenVersion(claims.ver)
    if (!user || !user.isActive || tokenVersion !== claimVersion) return res.status(401).json({ error: 'Session has been invalidated' })
    req.auth = { ...claims, role: user.role === 'user' ? 'borrower' : user.role, name: user.name, email: user.email }
    return next()
  } catch (error) {
    return next(error)
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) return res.status(403).json({ error: 'You do not have permission for this action' })
    return next()
  }
}
