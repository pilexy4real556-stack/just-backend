import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is missing");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function createCheckoutSession({
  items,
  deliveryFeePence,
  frontendUrl,
}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("No items provided");
  }

  const lineItems = items.map((item) => ({
    price_data: {
      currency: "gbp",
      product_data: { name: item.name },
      unit_amount: Math.round(item.price * 100),
    },
    quantity: item.quantity,
  }));

  if (Number.isInteger(deliveryFeePence) && deliveryFeePence > 0) {
    lineItems.push({
      price_data: {
        currency: "gbp",
        product_data: { name: "Delivery Fee" },
        unit_amount: deliveryFeePence,
      },
      quantity: 1,
    });
  }

  return stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    success_url: `${frontendUrl}/success`,
    cancel_url: `${frontendUrl}/cart`,
  });
}
