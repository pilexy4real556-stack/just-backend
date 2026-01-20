// services/referral.js
import admin from "../firebase.js";
import { generateReferralCode } from "./referralCode.js";
import express from "express";

const router = express.Router();
const db = admin.firestore();

export async function getFreeDeliveryCredits(customerId) {
  const allUsers = await db.collection("users").get();
  console.log(
    "🔥 User IDs visible to backend:",
    allUsers.docs.map((d) => d.id),
  );

  console.log("🔎 Looking up referral for:", customerId);

  const ref = db.collection("users").doc(customerId);
  const snap = await ref.get();

  if (!snap.exists) {
    console.log("❌ User doc NOT FOUND");
    return 0;
  }

  const data = snap.data();
  console.log("✅ User doc FOUND:", data);

  return data.freeDeliveryCredits ?? 0;
}

export async function consumeFreeDelivery(userId) {
  const userRef = db.collection("users").doc(userId);

  await userRef.update({
    freeDeliveryCredits: admin.firestore.FieldValue.increment(-1),
  });
}

export async function ensureReferralCode(customerId) {
  const userRef = db.collection("users").doc(customerId);
  const snap = await userRef.get();

  if (!snap.exists) return;

  const data = snap.data();

  if (data.referralCode) {
    return data.referralCode;
  }

  const code = "JC-" + Math.random().toString(36).substring(2, 7).toUpperCase();

  await userRef.update({
    referralCode: code,
    referralCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log("✅ Referral code generated:", code);

  return code;
}

/**
 * Validate referral code and apply it to the user
 * NOTE: This function is kept for backward compatibility but should not be called at checkout.
 * Referral application happens in webhook handler after payment.
 */
export async function applyReferralCode({ customerId, referralCode }) {
  // Find user who owns this referral code (FIX: look in users, not referrals)
  const snap = await db
    .collection("users")
    .where("referralCode", "==", referralCode)
    .limit(1)
    .get();

  if (snap.empty) {
    throw new Error("INVALID_CODE");
  }

  const referrerDoc = snap.docs[0];
  const referrerId = referrerDoc.id;
  const referrerData = referrerDoc.data();

  // Prevent self-referral
  if (referrerId === customerId) {
    throw new Error("SELF_REFERRAL");
  }

  // Check if code has already been used
  if (referrerData.referralCodeUsed) {
    throw new Error("CODE_ALREADY_USED");
  }

  const userRef = db.collection("users").doc(customerId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new Error("USER_NOT_FOUND");
  }

  // Check if user has already used a referral code
  if (userSnap.data().referredBy) {
    throw new Error("ALREADY_USED_REFERRAL");
  }

  // Mark code as used
  await db.collection("users").doc(referrerId).update({
    referralCodeUsed: true,
    referralCodeUsedBy: customerId,
    referralCodeUsedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Mark user as referred (but DON'T give them free delivery)
  await userRef.update({
    referredBy: referrerId,
    referralUsedAt: admin.firestore.FieldValue.serverTimestamp(),
    // REMOVED: Don't give free delivery credit to new user
  });

  // Give referrer free delivery credit for NEXT order
  await db.collection("users").doc(referrerId).update({
    freeDeliveryCredits: admin.firestore.FieldValue.increment(1),
  });

  return { 
    success: true,
    referrerId,
  };
}

/**
 * POST /api/referral/validate
 * Body: { code, customerId }
 */
router.post("/referral/validate", async (req, res) => {
  try {
    const { code, customerId } = req.body;

    if (!code || !customerId) {
      return res.status(400).json({ error: "Missing code or customerId" });
    }

    // Find user who owns this referral code
    const snap = await db
      .collection("users")
      .where("referralCode", "==", code)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({ error: "Invalid referral code" });
    }

    const referrerDoc = snap.docs[0];

    // Prevent self-referral
    if (referrerDoc.id === customerId) {
      return res
        .status(400)
        .json({ error: "Cannot use your own referral code" });
    }

    return res.json({
      valid: true,
      referrerId: referrerDoc.id,
      message: "Referral code valid",
    });
  } catch (err) {
    console.error("❌ Referral validate error:", err);
    res.status(500).json({ error: "Referral validation failed" });
  }
});

export default router;
