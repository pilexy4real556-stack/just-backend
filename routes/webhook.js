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
      await db.collection("orders").add({
        customerId,
        paymentStatus: "PAID",
        stripeSessionId: session.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      /* -------------------------
         Apply referral (if used)
      ------------------------- */
      if (usedReferralCode) {
        const refSnap = await db
          .collection("users")
          .where("referralCode", "==", usedReferralCode)
          .limit(1)
          .get();

        if (!refSnap.empty) {
          const referrerId = refSnap.docs[0].id;

          // Prevent self-referral
          if (referrerId !== customerId) {
            const userDoc = await db.collection("users").doc(customerId).get();
            if (userDoc.exists && userDoc.data().referredBy) return;

            await db.collection("users").doc(customerId).update({
              referredBy: referrerId,
              referralUsedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            await db
              .collection("users")
              .doc(referrerId)
              .update({
                freeDeliveryCredits: admin.firestore.FieldValue.increment(1),
              });

            console.log("🎉 Referral applied:", usedReferralCode);
          }
        }
      }

      /* -------------------------
         Ensure referral for payer
      ------------------------- */
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
