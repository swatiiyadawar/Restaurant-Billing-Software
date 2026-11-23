import { Router } from 'express'
import { dashboard } from '../controllers/reportController.js'
import { authenticate } from '../middleware/authenticate.js'
import { adminOnly } from '../middleware/authorize.js'

const router = Router()
router.get('/', authenticate, adminOnly, dashboard)
export default router
