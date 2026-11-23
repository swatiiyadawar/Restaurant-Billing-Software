import { Router } from 'express'
import { z } from 'zod'
import { cancelBill, createBill, getBill, listBills } from '../controllers/billController.js'
import { authenticate } from '../middleware/authenticate.js'
import { adminOnly, cashierOrAdmin } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import { billInput, billQuery, idParams } from '../utils/schemas.js'

const router = Router()
router.use(authenticate, cashierOrAdmin)
router.get('/', validate(z.object({ query: billQuery })), listBills)
router.post('/', validate(z.object({ body: billInput })), createBill)
router.get('/:id', validate(z.object({ params: idParams })), getBill)
router.post('/:id/cancel', adminOnly, validate(z.object({ params: idParams })), cancelBill)
export default router
