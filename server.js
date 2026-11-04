require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// የእርስዎ የተመዘገቡ የባንክ አካውንቶች
const REGISTERED_ACCOUNTS = {
    TELEBIRR_PHONE: "47655291",
    CBE_ACCOUNT_SUFFIX: "87895848" 
};

app.post('/api/verify-payment', async (req, res) => {
    const { provider, reference, amount, userAccount } = req.body;

    if (!provider || !reference || !amount) {
        return res.status(400).json({ success: false, message: "እባክዎ ሁሉንም መረጃዎች ይሙሉ" });
    }

    let requestPayload = {};
    let isCbeLink = reference.startsWith("https://mbreciept.cbe.com.et");

    if (provider === "telebirr") {
        requestPayload = {
            bank: "telebirr",
            reference: reference, 
            accountSuffix: userAccount || REGISTERED_ACCOUNTS.TELEBIRR_PHONE 
        };
    } else if (provider === "cbe") {
        requestPayload = {
            bank: "cbe",
            reference: reference 
        };
        // ✅ ማስተካከያ፡ ሊንክ ካልሆነ ብቻ ቅጥያ ይላካል
        if (!isCbeLink && userAccount) {
            requestPayload.accountSuffix = userAccount;
        }
    } else {
        return res.status(400).json({ success: false, message: "የተደገፈ ባንክ አይደለም" });
    }

    try {
        const response = await axios.post('https://verify.et/api/verify', requestPayload, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.VERIFY_ET_API_KEY
            }
        });

        const data = response.data;

        if (data.success && data.verification) {
            const verifiedAmount = parseFloat(data.verification.amount);
            
            if (verifiedAmount >= amount) {
                return res.json({ 
                    success: true, 
                    message: "ክፍያው በተሳካ ሁኔታ ተረጋግጧል!", 
                    amount: verifiedAmount,
                    transactionId: data.verification.reference 
                });
            } else {
                return res.status(400).json({ 
                    success: false, 
                    message: `የተከፈለው መጠን (${verifiedAmount} ETB) ከሚፈለገው መጠን (${amount} ETB) ያነሰ ነው።` 
                });
            }
        } else {
            return res.status(400).json({ 
                success: false, 
                message: "ክፍያው አልተረጋገጠም። እባክዎ ደረሰኙን ያረጋግጡ።",
                details: data.message || "Unknown error"
            });
        }
    } catch (error) {
        console.error("Verification Error:", error.response?.data || error.message);
        return res.status(500).json({ 
            success: false, 
            message: "የሲስተም ስህተት ተፈጥሯል። እባክዎ በኋላ ይሞክሩ።" 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ሰርቨር በፖርት ${PORT} ላይ እየሰራ ነው...`));
