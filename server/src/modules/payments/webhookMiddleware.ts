import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import prisma from '../../lib/prisma'

export async function verifyHmacAndIdempotency(req: Request, res: Response, next: NextFunction) {
  const signature = req.header('X-Signature') || req.header('X-Razorpay-Signature') || ''
  const idempotencyKey = req.header('Idempotency-Key') || req.header('Idempotency-Key'.toLowerCase())
  if (!signature) return res.status(400).send('Missing signature')

  const rawBody = (req as any).rawBody || JSON.stringify(req.body)
  const secret = process.env.PAYMENT_WEBHOOK_SECRET || ''
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return res.status(401).send('Invalid signature')
  }

  if (!idempotencyKey) return res.status(400).send('Missing Idempotency-Key')

  const existing = await prisma.idempotencyKey.findUnique({ where: { key: idempotencyKey } })
  if (existing) return res.status(200).send('Already processed')

  await prisma.idempotencyKey.create({ data: { key: idempotencyKey, ownerType: 'webhook' } })
  next()
}
