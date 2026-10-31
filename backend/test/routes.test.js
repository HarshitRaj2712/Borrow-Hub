import test from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { app } from '../src/app.js'

test('GET /api/health returns service status', async () => {
  const response = await request(app).get('/api/health')
  assert.equal(response.status, 200)
  assert.equal(response.body.status, 'ok')
  assert.equal(response.body.service, 'borrow-hub-api')
})

test('protected item routes reject missing authentication', async () => {
  const response = await request(app).get('/api/items/mine')
  assert.equal(response.status, 401)
  assert.equal(response.body.error, 'Authentication required')
})

test('protected admin routes reject missing authentication', async () => {
  const response = await request(app).get('/api/admin/users')
  assert.equal(response.status, 401)
  assert.equal(response.body.error, 'Authentication required')
})
