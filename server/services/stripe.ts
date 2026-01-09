
import Stripe from 'stripe';
import { storage } from '../storage';
import { getWhatsAppBot } from '../whatsapp/whatsappBot';


if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("⚠️ STRIPE_SECRET_KEY is missing. Payment features will not work.");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-12-15.clover',
});

export class StripeService {

  async createCheckoutSession(userId: number, email?: string) {
    if (!process.env.STRIPE_PRICE_ID) {
      throw new Error("STRIPE_PRICE_ID is not configured");
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL}/cancel`,
      client_reference_id: userId.toString(),
      customer_email: email,
      metadata: {
        userId: userId.toString(),
      }
    });

    return session;
  }

  async handleWebhook(signature: string, payload: Buffer) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: any) {
      console.error(`Webhook Error: ${err.message}`);
      throw new Error(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      // Handle other events like payment_intent.succeeded if needed
    }

    return { received: true };
  }

  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    const userId = session.client_reference_id ? parseInt(session.client_reference_id) : null;

    if (!userId) {
      console.error("Warning: webhook received without userId");
      return;
    }

    // Update user subscription status
    await storage.updateUserSubscription(userId, {
      status: 'active',
      stripeCustomerId: session.customer as string,
      subscriptionEndsAt: null, // Allow null for active subscriptions (or calculate based on period)
    });

    // Record payment
    // Note: We need a method in storage.ts to create payment record
    // For now we just log it or we can add that method.
    // Assuming we update schema and storage interfaces eventually.
    console.log(`✅ Payment successful for user ${userId}`);

    // NOTIFICAÇÃO DE SUCESSO
    try {
      const user = await storage.getUser(userId);
      if (user) {
        // Tenta enviar pelo WhatsApp se o username parecer um número de telefone
        // ou se tivermos uma lógica melhor de detecção de canal.
        // Por enquanto, assumimos que se o username é números, é WhatsApp.
        if (/^\d+$/.test(user.username)) {
          const whatsappBot = getWhatsAppBot();
          // O usuário do WhatsApp é username@s.whatsapp.net (lid ou normal)
          // Precisamos do JID completo. O Bot geralmente guarda o user apenas com números.
          // getOrCreateUser: username = whatsappId (apenas numeros)
          // Para enviar msg, precisamos reconstruir o JID ou armazenar o JID completo.
          // O padrão do Baileys é numero@s.whatsapp.net.
          const jid = `${user.username}@s.whatsapp.net`;

          await whatsappBot.sendMessage(jid,
            '🎉 *Pagamento Confirmado!*\n\n' +
            'Sua assinatura está ativa e você já pode aproveitar todos os recursos do Zelar IA.\n' +
            'Obrigado por assinar! 🚀'
          );
        }
      }
    } catch (notifyError) {
      console.error('Erro ao enviar notificação de pagamento:', notifyError);
    }
  }

  async cancelSubscription(userId: number) {
    const user = await storage.getUser(userId);
    if (!user || !user.stripeCustomerId) {
      throw new Error("Usuário não possui assinatura ativa para cancelar.");
    }

    // Listar assinaturas ativas do cliente
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      throw new Error("Nenhuma assinatura ativa encontrada.");
    }

    const subscription = subscriptions.data[0];

    // Atualizar para cancelar no fim do período
    const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    });

    return {
      endsAt: new Date((updatedSubscription as any).current_period_end * 1000)
    };
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;

    console.log(`⚠️ Assinatura cancelada/finalizada: ${subscription.id} para customer ${customerId}`);

    try {
      const user = await storage.getUserByStripeId(customerId);
      if (user) {
        await storage.updateUserSubscription(user.id, {
          status: 'inactive',
          stripeCustomerId: customerId,
          subscriptionEndsAt: null
        });
        console.log(`✅ Status do usuário ${user.id} atualizado para inativo.`);
      } else {
        console.warn(`⚠️ Usuário não encontrado para o customerId ${customerId}`);
      }
    } catch (error) {
      console.error(`Erro ao atualizar status de usuário após cancelamento: ${error}`);
    }
  }
}

export const stripeService = new StripeService();
