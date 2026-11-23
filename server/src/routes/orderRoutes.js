import { Router } from 'express'
import { z } from 'zod'
import { cancelOrder, createOrder, getOrder, listOrders, updateOrder } from '../controllers/orderController.js'
import { authenticate } from '../middleware/authenticate.js'
import { adminOnly, cashierOrAdmin } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import { idParams, orderInput } from '../utils/schemas.js'

const router = Router()
router.use(authenticate, cashierOrAdmin)
router.get('/', validate(z.object({ query: z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), status: z.enum(['OPEN', 'COMPLETED', 'CANCELLED']).optional() }) })), listOrders)
router.post('/', validate(z.object({ body: orderInput })), createOrder)
router.get('/:id', validate(z.object({ params: idParams })), getOrder)
router.patch('/:id', validate(z.object({ params: idParams, body: z.object({ items: orderInput.shape.items }) })), updateOrder)
router.post('/:id/cancel', adminOnly, validate(z.object({ params: idParams })), cancelOrder)
export default router
