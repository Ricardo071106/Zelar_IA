
import Stripe from 'stripe';
import { storage } from '../storage';

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
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    // Find user by stripe customer id
    // This part assumes we can lookup user by stripeCustomerId or we have to add that to storage
    // For now, let's just log. Implementing lookup would require storage update.
    console.log(`⚠️ Subscription deleted: ${subscription.id}`);
    // Ideally: find user and set status to 'inactive'
  }
}

export const stripeService = new StripeService();
