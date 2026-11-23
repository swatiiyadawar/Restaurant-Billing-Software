import { Router } from 'express'
import { z } from 'zod'
import { listTables, updateTable } from '../controllers/tableController.js'
import { authenticate } from '../middleware/authenticate.js'
import { adminOnly, cashierOrAdmin } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import { idParams } from '../utils/schemas.js'

const router = Router()
router.use(authenticate)
router.get('/', cashierOrAdmin, listTables)
router.patch('/:id', adminOnly, validate(z.object({ params: idParams, body: z.object({ status: z.enum(['FREE', 'RUNNING']) }) })), updateTable)
export default router
