export function healthController(req, res) {
  res.json({
    status: 'ok',
    service: 'borrow-hub-api',
    database: req.app.locals.database?.mode || 'starting',
    timestamp: new Date().toISOString()
  })
}
