import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import request from 'supertest'

dotenv.config()
const testUri = process.env.MONGODB_TEST_URI
if (testUri) process.env.MONGODB_URI = testUri
process.env.JWT_SECRET ||= 'integration-tests-only-secret-with-at-least-32-chars'

const { default: app } = await import('../src/app.js')
const { connectDatabase, disconnectDatabase } = await import('../src/config/database.js')
const { default: User, hashPassword } = await import('../src/models/User.js')
const { default: MenuItem } = await import('../src/models/MenuItem.js')
const { default: RestaurantTable } = await import('../src/models/RestaurantTable.js')
const { default: Order } = await import('../src/models/Order.js')
const { default: Bill } = await import('../src/models/Bill.js')

const suite = describe.skipIf(!testUri)
suite('DineFlow API integration (requires MONGODB_TEST_URI)', () => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`
  const credentials = {
    admin: { name: 'Integration Admin', username: `admin-${suffix}`, email: `admin-${suffix}@example.test`, password: 'admin-integration-password' },
    cashier: { name: 'Integration Cashier', username: `cashier-${suffix}`, email: `cashier-${suffix}@example.test`, password: 'cashier-integration-password' },
  }
  let adminToken
  let cashierToken
  let adminCookie
  let cashierCookie
  let table
  let menuItem
  let originalTableStates = []
  let createdTableNumbers = []
  let registeredUsername

  beforeAll(async () => {
    await connectDatabase()
    const firstAdmin = await request(app).post('/api/auth/register').send({ ...credentials.admin, role: 'ADMIN' })
    expect(firstAdmin.status).toBe(201)
    const admin = await User.findById(firstAdmin.body.user._id)
    const cashier = await User.create({ ...credentials.cashier, passwordHash: await hashPassword(credentials.cashier.password), role: 'CASHIER' })
    const loginAdmin = await request(app).post('/api/auth/login').send({ identity: credentials.admin.username, password: credentials.admin.password, role: 'ADMIN' })
    const loginCashier = await request(app).post('/api/auth/login').send({ identity: credentials.cashier.email, password: credentials.cashier.password, role: 'CASHIER' })
    expect(loginAdmin.body.token).toBeUndefined()
    expect(loginAdmin.headers['set-cookie']?.[0]).toContain('HttpOnly')
    expect(loginAdmin.headers['set-cookie']?.[0]).toContain('SameSite=Strict')
    adminCookie = loginAdmin.headers['set-cookie']?.[0]?.split(';')[0]
    cashierCookie = loginCashier.headers['set-cookie']?.[0]?.split(';')[0]
    adminToken = adminCookie
    cashierToken = cashierCookie
    const tableNumbers = Array.from({ length: 10 }, (_, index) => `T${index + 1}`)
    originalTableStates = await RestaurantTable.find({ tableNumber: { $in: tableNumbers } }).select('tableNumber status').lean()
    const originallyPresent = new Set(originalTableStates.map((entry) => entry.tableNumber))
    createdTableNumbers = tableNumbers.filter((tableNumber) => !originallyPresent.has(tableNumber))
    await Promise.all(tableNumbers.map((tableNumber) => {
      return RestaurantTable.updateOne({ tableNumber }, { $setOnInsert: { tableNumber, status: 'FREE' } }, { upsert: true, runValidators: true })
    }))
    table = await RestaurantTable.findOneAndUpdate({ tableNumber: 'T10' }, { $set: { status: 'FREE' } }, { returnDocument: 'after' })
    menuItem = await MenuItem.create({ name: `Test Special ${suffix}`, category: 'Starters', price: 100, foodType: 'VEG', available: true })
    expect(admin.id).toBeTruthy()
    expect(cashier.id).toBeTruthy()
  }, 30000)

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await Promise.all([
        Bill.deleteMany({ cashier: { $in: await User.find({ username: { $in: [credentials.admin.username, credentials.cashier.username] } }).distinct('_id') } }),
        Order.deleteMany({ cashier: { $in: await User.find({ username: { $in: [credentials.admin.username, credentials.cashier.username] } }).distinct('_id') } }),
        MenuItem.deleteMany({ name: `Test Special ${suffix}` }),
        User.deleteMany({ username: { $in: [credentials.admin.username, credentials.cashier.username, registeredUsername].filter(Boolean) } }),
        ...originalTableStates.map(({ tableNumber, status }) => RestaurantTable.updateOne({ tableNumber }, { $set: { status } })),
        RestaurantTable.deleteMany({ tableNumber: { $in: createdTableNumbers } }),
      ])
    }
    await disconnectDatabase()
  })

  it('connects to MongoDB and enforces authentication on protected routes', async () => {
    expect(mongoose.connection.readyState).toBe(1)
    expect((await request(app).get('/api/menu')).status).toBe(401)
    const invalid = await request(app).post('/api/auth/login').send({ identity: credentials.admin.username, password: 'incorrect', role: 'ADMIN' })
    expect(invalid.status).toBe(401)
  })

  it('registers Cashier accounts, prevents public Admin escalation, and validates the selected sign-in role', async () => {
    const registration = {
      name: 'New Integration User',
      email: `new-${suffix}@example.test`,
      username: `new-${suffix}`,
      password: 'a-long-integration-password',
      role: 'CASHIER',
    }
    const adminAttempt = await request(app).post('/api/auth/register').send({ ...registration, email: `admin-new-${suffix}@example.test`, username: `admin-new-${suffix}`, role: 'ADMIN' })
    expect(adminAttempt.status).toBe(403)
    expect(adminAttempt.body.error.message).toContain('Admin sign-up is closed')

    const created = await request(app).post('/api/auth/register').send(registration)
    expect(created.status).toBe(201)
    expect(created.body.user).toMatchObject({ name: registration.name, username: registration.username, role: 'CASHIER' })
    expect(created.body.user.passwordHash).toBeUndefined()
    expect(created.headers['set-cookie']?.[0]).toContain('HttpOnly')
    registeredUsername = registration.username

    const wrongRole = await request(app).post('/api/auth/login').send({ identity: registration.username, password: registration.password, role: 'ADMIN' })
    expect(wrongRole.status).toBe(403)
    const correctRole = await request(app).post('/api/auth/login').send({ identity: registration.email, password: registration.password, role: 'CASHIER' })
    expect(correctRole.status).toBe(200)
    const duplicate = await request(app).post('/api/auth/register').send(registration)
    expect(duplicate.status).toBe(409)
  })

  it('allows admin menu CRUD and denies cashier menu writes', async () => {
    const body = { name: `CRUD Test ${suffix}`, category: 'Desserts', price: 75, foodType: 'VEG', available: true }
    expect((await request(app).post('/api/menu').set('Cookie', cashierCookie).send(body)).status).toBe(403)
    const created = await request(app).post('/api/menu').set('Cookie', adminCookie).send(body)
    expect(created.status).toBe(201)
    const id = created.body.item._id
    expect((await request(app).get('/api/menu').set('Cookie', cashierCookie)).status).toBe(200)
    expect((await request(app).patch(`/api/menu/${id}`).set('Cookie', adminCookie).send({ price: 85 })).status).toBe(200)
    expect((await request(app).delete(`/api/menu/${id}`).set('Cookie', adminCookie)).status).toBe(204)
  })

  it('lets cashier create orders, issue a bill, and record split payments', async () => {
    const createdOrder = await request(app).post('/api/orders').set('Cookie', cashierCookie).send({ orderType: 'DINE_IN', table: String(table._id), items: [{ menuItem: String(menuItem._id), quantity: 1 }] })
    expect(createdOrder.status).toBe(201)
    const orderId = createdOrder.body.order._id
    expect((await RestaurantTable.findById(table._id)).status).toBe('RUNNING')
    expect((await request(app).patch(`/api/tables/${table._id}`).set('Cookie', adminCookie).send({ status: 'FREE' })).status).toBe(409)
    const duplicateTableOrder = await request(app).post('/api/orders').set('Cookie', cashierCookie).send({ orderType: 'DINE_IN', table: String(table._id), items: [{ menuItem: String(menuItem._id), quantity: 1 }] })
    expect(duplicateTableOrder.status).toBe(409)
    const tableResponse = await request(app).get('/api/tables').set('Cookie', cashierCookie)
    expect(tableResponse.body.tables.find((entry) => entry.tableNumber === 'T10').currentOrder._id).toBe(orderId)
    await MenuItem.findByIdAndUpdate(menuItem._id, { price: 160 })
    const editedOrder = await request(app).patch(`/api/orders/${orderId}`).set('Cookie', cashierCookie).send({ items: [{ menuItem: String(menuItem._id), quantity: 1 }] })
    expect(editedOrder.status).toBe(200)
    expect(editedOrder.body.order.items[0].price).toBe(100)
    const billResult = await request(app).post('/api/bills').set('Cookie', cashierCookie).send({ order: orderId, discountType: 'PERCENT', discountValue: 10 })
    expect(billResult.status).toBe(201)
    expect(billResult.body.bill.finalPayableAmount).toBe(95)
    const billId = billResult.body.bill._id
    const unbalanced = await request(app).post('/api/payments').set('Cookie', cashierCookie).send({ bill: billId, payments: [{ mode: 'CASH', amount: 40 }, { mode: 'UPI', amount: 54 }] })
    expect(unbalanced.status).toBe(400)
    expect((await request(app).post('/api/payments').set('Cookie', cashierCookie).send({ bill: billId, mode: 'CASH', amount: 40 })).status).toBe(201)
    expect((await request(app).post('/api/payments').set('Cookie', cashierCookie).send({ bill: billId, mode: 'CASH', amount: 56 })).status).toBe(409)
    const paid = await request(app).post('/api/payments').set('Cookie', cashierCookie).send({ bill: billId, payments: [{ mode: 'UPI', amount: 30 }, { mode: 'CARD', amount: 25 }] })
    expect(paid.status).toBe(201)
    expect(paid.body.bill.paymentStatus).toBe('PAID')
    expect(paid.body.bill.payments.map((payment) => payment.mode)).toEqual(['CASH', 'UPI', 'CARD'])
    expect((await RestaurantTable.findById(table._id)).status).toBe('FREE')
    expect((await request(app).get('/api/bills').set('Cookie', cashierCookie)).status).toBe(200)
  }, 30000)

  it('records a single cash settlement and rejects duplicate bill generation', async () => {
    const orderResponse = await request(app).post('/api/orders').set('Cookie', cashierCookie).send({ orderType: 'TAKEAWAY', table: null, items: [{ menuItem: String(menuItem._id), quantity: 1 }] })
    expect(orderResponse.status).toBe(201)
    const orderId = orderResponse.body.order._id
    const generated = await request(app).post('/api/bills').set('Cookie', cashierCookie).send({ order: orderId, discountType: 'AMOUNT', discountValue: 0 })
    expect(generated.status).toBe(201)
    expect((await request(app).post('/api/bills').set('Cookie', cashierCookie).send({ order: orderId })).status).toBe(409)
    const settled = await request(app).post('/api/payments').set('Cookie', cashierCookie).send({ bill: generated.body.bill._id, mode: 'CASH', amount: generated.body.bill.finalPayableAmount })
    expect(settled.status).toBe(201)
    expect(settled.body.bill.paymentStatus).toBe('PAID')
    expect(settled.body.bill.payments).toHaveLength(1)
  }, 30000)

  it('serves the menu, tables, orders, dashboard, reports, and payment APIs with role checks', async () => {
    const [adminSession, cashierSession, tablesResponse, menuSearch, menuCategory, menuUnavailable, orderList, dashboardResponse, reportsOverview, reportResponse] = await Promise.all([
      request(app).get('/api/auth/me').set('Cookie', adminCookie),
      request(app).get('/api/auth/session').set('Cookie', cashierCookie),
      request(app).get('/api/tables').set('Cookie', cashierCookie),
      request(app).get(`/api/menu?search=${encodeURIComponent(menuItem.name)}&limit=100`).set('Cookie', cashierCookie),
      request(app).get('/api/menu?category=Starters').set('Cookie', adminCookie),
      request(app).get('/api/menu?available=false').set('Cookie', adminCookie),
      request(app).get('/api/orders?status=OPEN').set('Cookie', cashierCookie),
      request(app).get('/api/dashboard').set('Cookie', adminCookie),
      request(app).get('/api/reports').set('Cookie', adminCookie),
      request(app).get('/api/reports/daily').set('Cookie', adminCookie),
    ])
    expect(adminSession.body.user.role).toBe('ADMIN')
    expect(cashierSession.body.user.role).toBe('CASHIER')
    expect(tablesResponse.body.tables.map((entry) => entry.tableNumber)).toEqual(Array.from({ length: 10 }, (_, index) => `T${index + 1}`))
    expect(menuSearch.body.items.some((item) => item._id === String(menuItem._id))).toBe(true)
    expect(menuCategory.body.items.every((item) => item.category === 'Starters')).toBe(true)
    expect(menuUnavailable.status).toBe(200)
    expect(orderList.status).toBe(200)
    expect(dashboardResponse.status).toBe(200)
    expect(reportsOverview.status).toBe(200)
    expect(reportResponse.status).toBe(200)
    expect((await request(app).get('/api/reports').set('Cookie', cashierCookie)).status).toBe(403)
    expect((await request(app).get('/api/payments').set('Cookie', cashierCookie)).status).toBe(403)
    expect((await request(app).patch(`/api/tables/${table._id}`).set('Cookie', cashierCookie).send({ status: 'FREE' })).status).toBe(403)
    expect((await request(app).patch(`/api/tables/${table._id}`).set('Cookie', adminCookie).send({ status: 'FREE' })).status).toBe(200)

    await MenuItem.findByIdAndUpdate(menuItem._id, { available: false })
    expect((await request(app).get(`/api/menu?search=${encodeURIComponent(menuItem.name)}&available=false`).set('Cookie', cashierCookie)).body.items.some((item) => item._id === String(menuItem._id))).toBe(true)
    await MenuItem.findByIdAndUpdate(menuItem._id, { available: true })

    const order = await request(app).post('/api/orders').set('Cookie', cashierCookie).send({ orderType: 'TAKEAWAY', table: null, items: [{ menuItem: String(menuItem._id), quantity: 1 }] })
    expect(order.status).toBe(201)
    expect((await request(app).get(`/api/orders/${order.body.order._id}`).set('Cookie', cashierCookie)).status).toBe(200)
    expect((await request(app).post(`/api/orders/${order.body.order._id}/cancel`).set('Cookie', cashierCookie)).status).toBe(403)
    const cancelled = await request(app).post(`/api/orders/${order.body.order._id}/cancel`).set('Cookie', adminCookie)
    expect(cancelled.status).toBe(200)
    expect(cancelled.body.order.status).toBe('CANCELLED')
    expect((await request(app).get('/api/payments').set('Cookie', adminCookie)).status).toBe(200)
  }, 30000)

  it('restricts reports and bill cancellation to admins', async () => {
    expect((await request(app).get('/api/dashboard').set('Cookie', cashierCookie)).status).toBe(403)
    expect((await request(app).get('/api/reports/daily').set('Cookie', cashierCookie)).status).toBe(403)
    const reportDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    const baseline = await request(app).get(`/api/reports/daily?from=${reportDate}&to=${reportDate}`).set('Cookie', adminCookie)
    expect(baseline.status).toBe(200)
    const order = await Order.create({ orderNumber: `TEST-${suffix}`, table: null, orderType: 'TAKEAWAY', items: [{ menuItem: menuItem._id, name: menuItem.name, price: menuItem.price, quantity: 1 }], cashier: (await User.findOne({ username: credentials.cashier.username }))._id })
    const bill = await Bill.create({ billNumber: `TEST-${suffix}`, order: order._id, items: [{ menuItem: menuItem._id, name: menuItem.name, price: 100, quantity: 1, amount: 100 }], subtotal: 100, discountType: 'AMOUNT', discountValue: 0, discountAmount: 0, cgst: 2.5, sgst: 2.5, grandTotal: 105, roundOff: 0, finalPayableAmount: 105, cashier: order.cashier })
    expect((await request(app).post('/api/payments').set('Cookie', cashierCookie).send({ bill: String(bill._id), mode: 'CASH', amount: 105 })).status).toBe(201)
    expect((await request(app).post(`/api/bills/${bill._id}/cancel`).set('Cookie', cashierCookie)).status).toBe(403)
    const cancelled = await request(app).post(`/api/bills/${bill._id}/cancel`).set('Cookie', adminCookie)
    expect(cancelled.status).toBe(200)
    expect(cancelled.body.bill.cancelled).toBe(true)
    expect(cancelled.body.bill.payments).toHaveLength(1)
    const history = await request(app).get(`/api/bills?from=${reportDate}&to=${reportDate}&search=${bill.billNumber}`).set('Cookie', cashierCookie)
    expect(history.status).toBe(200)
    expect(history.body.bills).toHaveLength(1)
    expect(history.body.bills[0].cancelled).toBe(true)
    expect((await request(app).get(`/api/bills?search=${bill.billNumber}&cancelled=false`).set('Cookie', adminCookie)).body.bills).toHaveLength(0)
    expect((await request(app).get(`/api/bills?search=${bill.billNumber}&cancelled=true`).set('Cookie', adminCookie)).body.bills).toHaveLength(1)
    const detail = await request(app).get(`/api/bills/${bill._id}`).set('Cookie', cashierCookie)
    expect(detail.body.bill.cancelledBy.name).toBe('Integration Admin')
    const after = await request(app).get(`/api/reports/daily?date=${reportDate}`).set('Cookie', adminCookie)
    expect(after.body.summary.sales).toBe(baseline.body.summary.sales)
    expect(after.body.summary.bills).toBe(baseline.body.summary.bills)
    expect(after.body.summary.orders).toBe(baseline.body.summary.orders)
    expect(after.body.summary.cancelledBills).toBe(baseline.body.summary.cancelledBills + 1)
    expect(after.body.paymentBreakdown).toEqual(baseline.body.paymentBreakdown)
    expect(after.body.items).toEqual(baseline.body.items)
    expect((await request(app).get(`/api/bills?from=${reportDate}&to=${reportDate}&paymentMode=CASH`).set('Cookie', cashierCookie)).status).toBe(200)
  }, 30000)
})
