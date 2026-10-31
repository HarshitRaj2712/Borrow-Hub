import jwt from 'jsonwebtoken'

const secret = process.env.JWT_SECRET || 'borrow-hub-development-secret'

export function issueToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, secret, { expiresIn: '2h' })
}

export function requireAuth(req, res, next) {
  const header = req.get('authorization')
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' })
  try {
    req.auth = jwt.verify(header.slice(7), secret)
    return next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) return res.status(403).json({ error: 'You do not have permission for this action' })
    return next()
  }
}
