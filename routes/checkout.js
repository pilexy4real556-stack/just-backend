import express from "express";
import { createCheckoutSession } from "../services/stripe.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { items, deliveryFeePence } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Items are required" });
    }

    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl?.startsWith("http")) {
      return res.status(500).json({ error: "Invalid FRONTEND_URL" });
    }

    const session = await createCheckoutSession({
      items,
      deliveryFeePence,
      frontendUrl,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
