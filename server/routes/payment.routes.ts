
import { Router } from 'express';
import { stripeService } from '../services/stripe';
import { storage } from '../storage';
import bodyParser from 'body-parser';

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
// NOTE: express.raw({ type: 'application/json' }) is often needed for webhooks signed parsing
// But since we are inside a larger app, we might check if body parser is already applied globally.
// Usually webhooks need raw body. We'll handle parsing in the service.
router.post('/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  console.log('🔔 [DEBUG] Webhook request received at /api/payments/webhook');
  console.log('📝 [DEBUG] Headers:', JSON.stringify(req.headers, null, 2));

  if (!sig) {
    console.error('❌ [DEBUG] Assinatura Stripe faltando');
    return res.status(400).send('Webhook Error: No signature');
  }

  try {
    console.log('📦 [DEBUG] Encaminhando para o serviço...');
    await stripeService.handleWebhook(sig as string, req.body);
    console.log('✅ [DEBUG] Webhook processado com sucesso');
    res.json({ received: true });
  } catch (err: any) {
    console.error(`❌ [DEBUG] Erro no catch do Webhook: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

export default router;
