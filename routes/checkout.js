import express from "express";
import { createCheckoutSession } from "../services/stripe.js";
import { db, admin } from "../firebase.js"; // Adjust the import based on your project structure

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { items, deliveryFeePence, customerPhone, deliveryAddress } = req.body;

    if (!customerPhone) {
      return res.status(400).json({ error: "Customer phone is required" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Items are required" });
    }

    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl?.startsWith("http")) {
      return res.status(500).json({ error: "Invalid FRONTEND_URL" });
    }

    const session = await createCheckoutSession({
      items: items.map((item) => ({
        name: item.name,
        price: Number(item.price),
        quantity: item.quantity,
      })),
      deliveryFeePence,
      frontendUrl,
    });

    // Example Firestore order creation
    await db.collection("orders").add({
      customerId: "exampleCustomerId", // Replace with actual customer ID logic
      items,
      totalAmount: 1000, // Replace with actual total amount logic
      deliveryFee: deliveryFeePence,
      deliveryBand: "exampleDeliveryBand", // Replace with actual delivery band logic
      deliveryAddress,
      customerPhone,
      paymentStatus: "PAID",
      orderStatus: "PAID",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
