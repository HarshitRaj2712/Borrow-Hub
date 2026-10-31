export function notFound(_req, res) {
  res.status(404).json({ error: 'Route not found' })
}

export function errorHandler(error, _req, res, _next) {
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON request body' })
  if (error.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message })) })
  if (error.code === 'EMAIL_NOT_CONFIGURED') return res.status(503).json({ error: error.message })
  if (error.code === 'CLOUDINARY_NOT_CONFIGURED') return res.status(503).json({ error: error.message })
  if (error.status === 400 && error.message?.startsWith('Invalid image file')) return res.status(400).json({ error: error.message })
  if (error instanceof Error && error.name === 'MulterError') return res.status(400).json({ error: error.message })
  if (error.code === 11000) return res.status(409).json({ error: 'A record with those details already exists' })
  if (error.name === 'CastError') return res.status(400).json({ error: `Invalid ${error.path}` })
  if (error.name === 'ValidationError') return res.status(400).json({ error: 'Database validation failed', details: Object.values(error.errors).map(value => value.message) })
  if (error.status) return res.status(error.status).json({ error: error.message })
  console.error(error)
  res.status(500).json({ error: 'Unexpected server error' })
}
