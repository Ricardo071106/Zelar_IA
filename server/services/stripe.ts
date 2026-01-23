
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
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      // Handle other events like payment_intent.succeeded if needed
    }

    return { received: true };
  }

  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    const userId = session.client_reference_id ? parseInt(session.client_reference_id) : null;
    console.log(`💰 Webhook: Processando checkout.session.completed para userId: ${userId}`);

    if (!userId) {
      console.error("Warning: webhook received without userId");
      return;
    }

    try {
      // Update user subscription status
      await storage.updateUserSubscription(userId, {
        status: 'active',
        stripeCustomerId: session.customer as string,
        subscriptionEndsAt: null,
      });
      console.log(`✅ Subscription updated to ACTIVE for user ${userId}`);

      // NOTIFICAÇÃO DE SUCESSO
      const user = await storage.getUser(userId);
      if (user) {
        console.log(`👤 User found: ${user.username} (Is valid phone? ${/^\d+$/.test(user.username)})`);

        if (/^\d+$/.test(user.username)) {
          const whatsappBot = getWhatsAppBot();
          const jid = `${user.username}@s.whatsapp.net`;

          console.log(`📤 Tentando enviar confirmação de pagamento para: ${jid}`);

          await whatsappBot.sendMessage(jid,
            '🎉 *Pagamento Confirmado!*\n\n' +
            'Sua assinatura está ativa e você já pode aproveitar todos os recursos do Zelar IA.\n' +
            'Obrigado por assinar! 🚀'
          );
          console.log(`✅ Mensagem de confirmação enviada!`);
        } else {
          console.warn(`⚠️ Username '${user.username}' não parece um telefone. Notificação pulada.`);
        }
      } else {
        console.error(`❌ User ${userId} not found in database.`);
      }
    } catch (error) {
      console.error('❌ Erro crítico ao processar pagamento ou enviar notificação:', error);
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

    // Validar se temos a data de término
    // Usando cast para any pois os tipos do Stripe podem variar entre versões do SDK
    const timestamp = updatedSubscription.cancel_at || (updatedSubscription as any).current_period_end;
    if (!timestamp) {
      // Fallback for immediate safety, though Stripe usually returns one
      return { endsAt: new Date() };
    }

    return {
      endsAt: new Date(timestamp * 1000)
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

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;
    console.log(`ℹ️ Assinatura atualizada: ${subscription.id} para customer ${customerId}`);

    try {
      const user = await storage.getUserByStripeId(customerId);
      if (!user) {
        console.warn(`⚠️ Usuário não encontrado para o customerId ${customerId}`);
        return;
      }

      // Se cancel_at_period_end for true, a assinatura vai acabar no futuro
      // Se for false, ela está ativa e renovando (logo, endsAt = null)
      let endsAt: Date | null = null;

      if (subscription.cancel_at_period_end) {
        const timestamp = subscription.cancel_at || (subscription as any).current_period_end;
        if (timestamp) {
          endsAt = new Date(timestamp * 1000);
        }
      }

      const status = subscription.status; // active, past_due, unpaid, canceled, incomplete...

      await storage.updateUserSubscription(user.id, {
        status: status,
        stripeCustomerId: customerId,
        subscriptionEndsAt: endsAt
      });
      console.log(`✅ Status do usuário ${user.id} atualizado via webhook (updated). Status: ${status}, EndsAt: ${endsAt}`);

    } catch (error) {
      console.error(`Erro ao processar atualização de assinatura: ${error}`);
    }
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;
    console.log(`❌ Pagamento falhou para fatura ${invoice.id}, customer ${customerId}`);

    try {
      const user = await storage.getUserByStripeId(customerId);
      if (!user) return;

      if (/^\d+$/.test(user.username)) {
        const whatsappBot = getWhatsAppBot();
        const jid = `${user.username}@s.whatsapp.net`;
        const paymentUrl = invoice.hosted_invoice_url || process.env.STRIPE_PAYMENT_LINK;

        await whatsappBot.sendMessage(jid,
          '⚠️ *Falha no Pagamento*\n\n' +
          'Não conseguimos processar a renovação da sua assinatura.\n' +
          'Seu acesso pode ser suspenso em breve.\n\n' +
          '💳 *Atualize seu pagamento aqui:*\n' +
          `${paymentUrl}\n\n` +
          'Se você já regularizou, desconsidere esta mensagem.'
        );
        console.log(`📩 Notificação de falha de pagamento enviada para ${user.username}`);
      }
    } catch (error) {
      console.error(`Erro ao processar falha de pagamento: ${error}`);
    }
  }
}

export const stripeService = new StripeService();
