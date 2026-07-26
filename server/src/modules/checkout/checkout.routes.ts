import { Router } from 'express'
import { checkoutController } from './checkout.controller'
import { authenticate } from '../../middleware/auth'

const router = Router()
router.use(authenticate)

router.post('/commit', checkoutController.commit)

export default router
