const express = require("express");
const axios = require("axios");
const cors = require("cors");
const admin = require("firebase-admin");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

/* ================= FIREBASE (RENDER SAFE) ================= */

if (!process.env.FIREBASE_KEY) {
    console.error("❌ FIREBASE_KEY is missing in environment variables");
    process.exit(1);
}

let serviceAccount;

try {
    serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
} catch (err) {
    console.error("❌ Invalid FIREBASE_KEY JSON");
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

/* ================= PAYSTACK CHECK ================= */

if (!process.env.PAYSTACK_SECRET_KEY) {
    console.error("❌ PAYSTACK_SECRET_KEY is missing in environment variables");
} else {
    console.log("✅ Paystack key loaded");
}

/* ================= HEALTH CHECK ================= */

app.get("/", (req, res) => {
    res.send("Backend is live ✅");
});

/* ================= VERIFY PAYMENT ================= */

app.post("/verify-payment", async (req, res) => {
    console.log("========== VERIFY PAYMENT START ==========");

    try {
        const { reference, userId } = req.body;

        console.log("📥 Incoming body:", req.body);

        /* ===== VALIDATION ===== */

        if (!reference) {
            console.log("❌ No reference provided");
            return res.status(400).json({ error: "No reference" });
        }

        if (!userId) {
            console.log("❌ No userId provided");
            return res.status(400).json({ error: "No userId" });
        }

        /* ===== VERIFY WITH PAYSTACK ===== */

        console.log("🔍 Calling Paystack verify API...");

        const response = await axios.get(
            `https://api.paystack.co/transaction/verify/${reference}`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                },
            }
        );

        console.log("📦 Paystack response:", response.data);

        const payment = response.data.data;

        if (!payment) {
            console.log("❌ No payment data returned");
            return res.status(400).json({ error: "Invalid Paystack response" });
        }

        console.log("💳 Status:", payment.status);
        console.log("💰 Amount (kobo):", payment.amount);

        if (payment.status !== "success") {
            console.log("❌ Payment NOT successful");
            return res.status(400).json({ error: "Payment failed" });
        }

        /* ===== CONVERT AMOUNT ===== */

        const amountNaira = payment.amount / 100;
        console.log("💰 Amount (naira):", amountNaira);

        /* ===== COIN LOGIC ===== */

        const coinsToAdd = Math.floor(amountNaira / 25);
        console.log("🪙 Coins to add:", coinsToAdd);

        if (coinsToAdd <= 0) {
            console.log("❌ Coins calculated as 0");
            return res.status(400).json({ error: "Invalid coin calculation" });
        }

        /* ===== FIREBASE UPDATE ===== */

        console.log("🔥 Updating Firebase...");

        const userRef = db.collection("users").doc(userId);

        const userDoc = await userRef.get();

        console.log("📄 User exists:", userDoc.exists);

        await userRef.set(
            {
                coins: admin.firestore.FieldValue.increment(coinsToAdd),
            },
            { merge: true }
        );

        console.log("✅ Firebase update SUCCESS");

        /* ===== VERIFY WRITE ===== */

        const updatedDoc = await userRef.get();

        console.log("🆕 Updated user data:", updatedDoc.data());

        console.log("========== VERIFY PAYMENT END ==========");

        return res.json({
            success: true,
            coins: updatedDoc.data().coins || 0,
        });

    } catch (error) {
        console.log("❌ FULL ERROR:", error);
        console.log("❌ RESPONSE ERROR:", error.response?.data);
        console.log("❌ MESSAGE:", error.message);

        return res.status(500).json({
            error: error.response?.data || error.message,
        });
    }
});

/* ================= START SERVER ================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log("🚀 Server running on port " + PORT);
});