export function notFound(_req, res) {
  res.status(404).json({ error: 'Route not found' })
}

export function errorHandler(error, _req, res, _next) {
  if (error.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message })) })
  console.error(error)
  res.status(500).json({ error: 'Unexpected server error' })
}
