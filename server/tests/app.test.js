import { describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'
import { assertConfiguredMongoUri } from '../src/config/database.js'
import { calculateBillAmounts, toPaise } from '../src/utils/money.js'
import { dateRange } from '../src/utils/dateRange.js'

describe('API application smoke checks', () => {
  it('serves health status without requiring MongoDB authentication', async () => {
    const response = await request(app).get('/api/health')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok', service: 'dineflow-api' })
  })

  it('rejects unauthenticated access to protected routes', async () => {
    const privateRoutes = ['/api/dashboard', '/api/menu', '/api/tables', '/api/orders', '/api/bills', '/api/payments', '/api/reports', '/api/reports/daily', '/api/auth/me']
    for (const route of privateRoutes) expect((await request(app).get(route)).status, route).toBe(401)
    expect((await request(app).get('/api/auth/session')).body).toEqual({ user: null })
  })

  it('validates login bodies and returns consistent not-found errors', async () => {
    const invalidLogin = await request(app).post('/api/auth/login').send({ identity: '', password: '' })
    expect(invalidLogin.status).toBe(400)
    expect(invalidLogin.body.error.message).toBe('Request validation failed')
    const invalidUsername = await request(app).post('/api/auth/register').send({ name: 'New Person', email: 'new@example.test', username: 'new@example.test', password: 'a-long-enough-password', role: 'CASHIER' })
    expect(invalidUsername.status).toBe(400)
    expect(invalidUsername.body.error.details).toContainEqual(expect.objectContaining({ field: 'body.username', message: expect.stringContaining('letters') }))
    const missingRoute = await request(app).get('/api/does-not-exist')
    expect(missingRoute.status).toBe(404)
    expect(missingRoute.body.error.message).toContain('was not found')
  })

  it('clears the HttpOnly session cookie when signing out', async () => {
    const response = await request(app).post('/api/auth/logout')
    expect(response.status).toBe(204)
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly')
    expect(response.headers['set-cookie']?.[0]).toContain('Expires=Thu, 01 Jan 1970')
  })

  it('explains how to fix an unchanged Atlas URI template', () => {
    expect(() => assertConfiguredMongoUri('mongodb+srv://<username>:<password>@<cluster-url>/<database-name>')).toThrow(/replace it in server\/\.env/i)
    expect(() => assertConfiguredMongoUri('mongodb+srv://app-user:encoded%40password@cluster0.example.mongodb.net/dineflow')).not.toThrow()
  })

  it('calculates fixed and percentage discounts, GST, and rupee rounding in paise', () => {
    const percentage = calculateBillAmounts([{ price: 10.1, quantity: 3 }, { price: 0.9, quantity: 1 }], 'PERCENT', 10)
    expect(percentage).toMatchObject({ subtotal: 31.2, discountAmount: 3.12, cgst: 0.7, sgst: 0.7, grandTotal: 29.48, roundOff: -0.48, finalPayableAmount: 29 })

    const fixed = calculateBillAmounts([{ price: 19.99, quantity: 1 }], 'AMOUNT', 99)
    expect(fixed).toMatchObject({ subtotal: 19.99, discountAmount: 19.99, cgst: 0, sgst: 0, grandTotal: 0, roundOff: 0, finalPayableAmount: 0 })
    expect(toPaise(0.1) + toPaise(0.2)).toBe(30n)
    expect(calculateBillAmounts([{ price: 19.99, quantity: 1 }], 'AMOUNT', 0).finalPayableAmount).toBe(21)
  })

  it('uses an inclusive India-time date filter with an exclusive next-day boundary', () => {
    const range = dateRange({ from: '2026-02-01', to: '2026-02-02' })
    expect(range.start.toISOString()).toBe('2026-01-31T18:30:00.000Z')
    expect(range.end.toISOString()).toBe('2026-02-02T18:30:00.000Z')
    expect(() => dateRange({ from: '2026-02-02', to: '2026-02-01' })).toThrow()
  })
})
