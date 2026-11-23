import { Router } from 'express'
import { z } from 'zod'
import { dashboard, salesReport } from '../controllers/reportController.js'
import { authenticate } from '../middleware/authenticate.js'
import { adminOnly } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import { reportQuery } from '../utils/schemas.js'

const router = Router()
router.use(authenticate, adminOnly)
router.get('/daily', validate(z.object({ query: reportQuery })), salesReport)
router.get('/', dashboard)
export default router
