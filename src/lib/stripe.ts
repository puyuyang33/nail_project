import "server-only";
import Stripe from "stripe";
import { env } from "./env";

let client: Stripe | null = null;

export function requireStripe() {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error(
      "Stripe is not configured. Add STRIPE_SECRET_KEY to start checkout.",
    );
  }
  client ??= new Stripe(env.STRIPE_SECRET_KEY);
  return client;
}
