import express from "express";
import { createCheckoutSession } from "../services/stripe.js";
import { applyReferralCode } from "../services/referral.js";
import admin from "../firebase.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const {
      items,
      deliveryFeePence,
      phone,
      deliveryAddress,
      customerId,
      referral,
    } = req.body;

    if (!phone) {
      return res.status(400).json({ error: "Customer phone is required" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Items are required" });
    }

    if (!deliveryAddress) {
      return res.status(400).json({ error: "deliveryAddress is required" });
    }

    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl?.startsWith("http")) {
      return res.status(500).json({ error: "Invalid FRONTEND_URL" });
    }

    // --- REFERRAL VALIDATION ---
    if (referral?.code) {
      try {
        const referralResult = await applyReferralCode({
          customerId,
          referralCode: referral.code,
        });

        if (!referralResult.valid) {
          return res.status(400).json({
            error: "INVALID_REFERRAL",
            reason: referralResult.reason,
          });
        }
      } catch (error) {
        return res.status(500).json({ error: "Referral validation failed" });
      }
    }

    const db = admin.firestore();

    // Get user
    const userSnap = await db.collection("users").doc(customerId).get();
    const user = userSnap.data();

    // Final delivery fee
    let finalDeliveryFee = deliveryFeePence;

    if (user?.freeDeliveryCredits > 0) {
      finalDeliveryFee = 0;
    }

    console.log("Original delivery fee:", deliveryFeePence);
    console.log("Final delivery fee:", finalDeliveryFee);

    const session = await createCheckoutSession({
      items: items.map((item) => ({
        name: item.name,
        price: Number(item.price),
        quantity: item.quantity,
      })),
      deliveryFeePence: finalDeliveryFee, // ✅ now 0
      frontendUrl,
      customerId,
      referral:
        referral?.code && referral?.referrerId
          ? { code: referral.code, referrerId: referral.referrerId }
          : null,
      deliveryAddress, // ✅ REQUIRED — THIS FIXES IT
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).json({ error: "Checkout failed" });
  }
});

export default router;
