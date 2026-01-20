import express from "express";
import admin from "firebase-admin";
import crypto from "crypto";

const router = express.Router();

router.post("/customer", async (req, res) => {
  console.log("🔥 /api/customer HIT");

  try {
    const db = admin.firestore();
    console.log("🔥 Firestore ready");

    const customerId = crypto.randomUUID();
    console.log("🔥 Generated customerId:", customerId);

    await db.collection("users").doc(customerId).set({
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      freeDeliveryCredits: 0,
    });

    console.log("✅ Customer created:", customerId);
    res.json({ customerId });
  } catch (err) {
    console.error("❌ Create customer failed:", err);
    res.status(500).json({ error: "Failed to create customer" });
  }
});

export default router;
