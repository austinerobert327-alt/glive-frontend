const express = require("express");
const axios = require("axios");
const cors = require("cors");
const admin = require("firebase-admin");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

/* 🔥 LOAD FIREBASE KEY */
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

/* ================= VERIFY PAYMENT ================= */

app.post("/verify-payment", async (req, res) => {
    const { reference, userId, amount } = req.body;

    console.log("📥 Incoming request:", { reference, userId, amount });

    if (!reference || !userId || !amount) {
        console.log("❌ Missing fields");
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        console.log("🔍 Verifying payment with Paystack...");

        const response = await axios.get(
            `https://api.paystack.co/transaction/verify/${reference}`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                },
            }
        );

        const data = response.data.data;

        console.log("💳 Paystack status:", data.status);
        console.log("💰 Paid amount (kobo):", data.amount);

        if (data.status === "success") {

            /* 🔥 EXTRA SAFETY CHECK */
            const expectedAmount = amount * 100;

            if (data.amount !== expectedAmount) {
                console.log("❌ Amount mismatch!");
                return res.status(400).json({ error: "Amount mismatch" });
            }

            const coinsToAdd = Math.floor(amount / 25);

            console.log("🪙 Adding coins:", coinsToAdd);

            await db.collection("users").doc(userId).set(
                {
                    coins: admin.firestore.FieldValue.increment(coinsToAdd),
                },
                { merge: true }
            );

            console.log("✅ Wallet updated successfully");

            return res.json({ success: true });
        }

        console.log("❌ Payment not successful");
        return res.status(400).json({ success: false });

    } catch (err) {
        console.error("🔥 ERROR:", err.message);
        return res.status(500).json({ error: "Verification failed" });
    }
});

/* ================= START SERVER ================= */

app.listen(5000, () => {
    console.log("🚀 Server running on port 5000");
});