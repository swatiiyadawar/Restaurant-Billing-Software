import { Router } from 'express'
import { createMenuItem, deleteMenuItem, listMenu, updateMenuItem } from '../controllers/menuController.js'
import { authenticate } from '../middleware/authenticate.js'
import { adminOnly, cashierOrAdmin } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import { menuItemInput, menuQuery, idParams } from '../utils/schemas.js'
import { z } from 'zod'

const router = Router()
const body = (schema) => z.object({ body: schema })
const params = (schema) => z.object({ params: schema })
router.use(authenticate)
router.get('/', cashierOrAdmin, validate(z.object({ query: menuQuery })), listMenu)
router.post('/', adminOnly, validate(body(menuItemInput)), createMenuItem)
router.patch('/:id', adminOnly, validate(z.object({ params: idParams, body: menuItemInput.partial().refine((value) => Object.keys(value).length > 0, 'At least one field is required') })), updateMenuItem)
router.delete('/:id', adminOnly, validate(params(idParams)), deleteMenuItem)
export default router
