import { Router } from 'express'
import { z } from 'zod'
import { addPayment, listPayments } from '../controllers/billController.js'
import { authenticate } from '../middleware/authenticate.js'
import { adminOnly, cashierOrAdmin } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import { pagination, paymentInput } from '../utils/schemas.js'

const router = Router()
router.use(authenticate)
router.post('/', cashierOrAdmin, validate(z.object({ body: paymentInput })), addPayment)
router.get('/', adminOnly, validate(z.object({ query: pagination })), listPayments)
export default router
