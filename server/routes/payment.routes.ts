import { Router } from 'express';
import { stripeService } from '../services/stripe';
import { storage } from '../storage';

const router = Router();

// Middleware to Ensure Authentication (Mock or session based)
// Assuming we have some way to get user, if not we rely on provided userId for now or session
// For Telegram/WhatsApp integration, the link usually carries the user ID or is generated for them.
// The checkout endpoint might be called from a web frontend or just directly linked.

// Create Checkout Session
router.post('/checkout', async (req, res) => {
  try {
    const { userId } = req.body; // In a real web app, get this from session. 

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const session = await stripeService.createCheckoutSession(user.id, user.email || undefined);

    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Checkout Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stripe Webhook
// NOTE: express.raw({ type: 'application/json' }) is ALREADY configured in index.ts for this specific route.
// DO NOT add bodyParser here again, or it will consume the stream twice.
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  console.log('🔔 [DEBUG] Webhook request received at /api/payments/webhook');
  console.log(`📝 [DEBUG] Content-Type: ${req.headers['content-type']}`);
  console.log(`📝 [DEBUG] Body Type: ${typeof req.body}`);
  console.log(`📝 [DEBUG] Body Is Buffer? ${Buffer.isBuffer(req.body)}`);

  if (Buffer.isBuffer(req.body)) {
    console.log(`📝 [DEBUG] Body Size: ${req.body.length} bytes`);
  } else if (typeof req.body === 'object') {
    console.log(`⚠️ [WARN] Body appears to be already parsed as JSON! This will fail signature verification.`);
    console.log(`📝 [DEBUG] Body keys: ${Object.keys(req.body).join(', ')}`);
  }

  if (!sig) {
    console.error('❌ [DEBUG] Assinatura Stripe faltando');
    return res.status(400).send('Webhook Error: No signature');
  }

  try {
    console.log('📦 [DEBUG] Encaminhando para o serviço...');
    // req.body should be a Buffer here because of express.raw in index.ts
    await stripeService.handleWebhook(sig as string, req.body);
    console.log('✅ [DEBUG] Webhook processado com sucesso');
    res.json({ received: true });
  } catch (err: any) {
    console.error(`❌ [DEBUG] Erro no catch do Webhook: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

export default router;
