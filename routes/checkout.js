import express from "express";
import { createCheckoutSession } from "../services/stripe.js";
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

    const db = admin.firestore();

    // --- CHECK IF FIRST ORDER AND GENERATE REFERRAL CODE ---
    // Generate code BEFORE payment so it's available on success page
    const ordersSnap = await db
      .collection("orders")
      .where("customerId", "==", customerId)
      .get();

    const isFirstOrder = ordersSnap.size === 0;

    if (isFirstOrder) {
      // Generate referral code BEFORE payment
      const userRef = db.collection("users").doc(customerId);
      const userSnap = await userRef.get();
      
      if (userSnap.exists) {
        const userData = userSnap.data();
        if (!userData.referralCode) {
          const referralCode = "JC-" + Math.random().toString(36).substring(2, 7).toUpperCase();
          await userRef.update({
            referralCode,
            referralCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log("✅ Referral code generated at checkout (first order):", referralCode);
        }
      }
    }

    // --- REFERRAL VALIDATION (only validate, don't apply) ---
    if (referral?.code) {
      try {
        // Validate referral code inline (same logic as /api/referral/validate)
        const snap = await db
          .collection("users")
          .where("referralCode", "==", referral.code)
          .limit(1)
          .get();

        if (snap.empty) {
          return res.status(400).json({
            error: "INVALID_REFERRAL",
            reason: "INVALID_CODE",
          });
        }

        const referrerDoc = snap.docs[0];
        const referrerData = referrerDoc.data();

        // Check if code has been used
        if (referrerData.referralCodeUsed) {
          return res.status(400).json({
            error: "INVALID_REFERRAL",
            reason: "CODE_ALREADY_USED",
          });
        }

        // Prevent self-referral
        if (referrerDoc.id === customerId) {
          return res.status(400).json({
            error: "INVALID_REFERRAL",
            reason: "SELF_REFERRAL",
          });
        }

        const userSnap = await db.collection("users").doc(customerId).get();

        if (userSnap.exists && userSnap.data().referredBy) {
          return res.status(400).json({
            error: "INVALID_REFERRAL",
            reason: "ALREADY_REFERRED",
          });
        }

        // Store referrerId for webhook
        referral.referrerId = referrerDoc.id;
      } catch (error) {
        console.error("Referral validation error:", error);
        return res.status(500).json({ error: "Referral validation failed" });
      }
    }

    // Get user
    const userSnap = await db.collection("users").doc(customerId).get();
    const user = userSnap.data();

    // Final delivery fee
    let finalDeliveryFee = deliveryFeePence;

    // Apply free delivery ONLY if user has existing credits
    // NEW USER USING REFERRAL CODE PAYS NORMAL DELIVERY FEE
    if (user?.freeDeliveryCredits > 0) {
      finalDeliveryFee = 0;
    }

    // Note: New user using referral code pays normal delivery fee
    // Referrer will get credit in webhook handler

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
