import Stripe from "stripe";
import admin from "../firebase.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const db = admin.firestore();

/* =========================
   Generate referral code ONCE
========================= */
async function ensureReferralCode(customerId) {
  const userRef = db.collection("users").doc(customerId);
  const snap = await userRef.get();

  if (!snap.exists) {
    console.warn("⚠️ User not found for referral:", customerId);
    return null;
  }

  const data = snap.data();

  // Do NOT regenerate
  if (data.referralCode) {
    console.log("ℹ️ Referral already exists:", data.referralCode);
    return data.referralCode;
  }

  const referralCode =
    "JC-" + Math.random().toString(36).substring(2, 7).toUpperCase();

  await userRef.update({
    referralCode,
    referralCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log("✅ Referral code generated:", referralCode);
  return referralCode;
}

/* =========================
   Stripe Webhook Handler
========================= */
export default async function webhook(req, res) {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("❌ Webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const customerId = session.metadata?.customerId;
      const usedReferralCode = session.metadata?.referralCode ?? null;

      if (!customerId) {
        console.error("❌ Missing customerId in Stripe metadata");
        return res.json({ received: true });
      }

      /* -------------------------
         Create order
      ------------------------- */
      const orderData = {
        customerId,
        paymentStatus: "PAID",
        orderStatus: "PAID",
        stripeSessionId: session.id,
        totalAmount: session.amount_total ?? 0,
        currency: session.currency,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Store referral info in order if used
      const referrerId = session.metadata?.referrerId ?? null;
      if (usedReferralCode && referrerId) {
        orderData.referralCodeUsed = usedReferralCode;
        orderData.referrerId = referrerId;
      }

      await db.collection("orders").add(orderData);

      /* -------------------------
         Apply referral (if used) - ONLY if not already applied
      ------------------------- */
      if (usedReferralCode && referrerId) {
        const userSnap = await db.collection("users").doc(customerId).get();
        const userData = userSnap.data();

        // Only apply if user hasn't been referred yet
        if (!userData?.referredBy) {
          const referrerSnap = await db
            .collection("users")
            .doc(referrerId)
            .get();
          const referrerData = referrerSnap.data();

          // Check if code hasn't been used yet
          if (!referrerData?.referralCodeUsed) {
            // Mark code as used
            await db.collection("users").doc(referrerId).update({
              referralCodeUsed: true,
              referralCodeUsedBy: customerId,
              referralCodeUsedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // Mark user as referred (but DON'T give them free delivery credit)
            await db.collection("users").doc(customerId).update({
              referredBy: referrerId,
              referralUsedAt: admin.firestore.FieldValue.serverTimestamp(),
              // REMOVED: Don't give free delivery credit to new user
            });

            // Give referrer free delivery credit for NEXT order
            await db
              .collection("users")
              .doc(referrerId)
              .update({
                freeDeliveryCredits: admin.firestore.FieldValue.increment(1),
              });

            console.log("🎉 Referral applied:", usedReferralCode);
            console.log("✅ Referrer gets free delivery credit for next order");
          }
        }
      }

      /* -------------------------
         Ensure referral code for payer (fallback - code should already exist from checkout)
      ------------------------- */
      // Code should already be generated at checkout, but ensure it exists as fallback
      // This handles edge cases where checkout didn't generate it
      await ensureReferralCode(customerId);

      /* -------------------------
         Consume free delivery credit
      ------------------------- */
      const userSnap = await db.collection("users").doc(customerId).get();
      const user = userSnap.data();

      if (user?.freeDeliveryCredits > 0) {
        await db
          .collection("users")
          .doc(customerId)
          .update({
            freeDeliveryCredits: admin.firestore.FieldValue.increment(-1),
          });
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error("❌ Webhook processing failed:", err);
    res.status(500).send("Webhook handler failed");
  }
}
