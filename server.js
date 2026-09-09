const express = require('express');
const cors = require('cors');
const omise = require('omise')({
    secretKey: 'skey_test_ของคุณที่ได้จากระบบ', // เอาไว้เปลี่ยนทีหลังตอนทดสอบของจริง
    omiseVersion: '2019-05-29'
});

const app = express();
app.use(cors());
app.use(express.json());

// API สำหรับสร้าง QR Code
app.post('/api/create-qr', async (req, res) => {
    try {
        const source = await omise.sources.create({
            type: 'promptpay',
            amount: 1500, // 15.00 บาท
            currency: 'thb'
        });
        
        const charge = await omise.charges.create({
            amount: 1500,
            currency: 'thb',
            source: source.id,
            return_uri: 'http://localhost:3000'
        });

        res.json({
            chargeId: charge.id,
            qrImage: charge.source.scannable_code.image.download_uri
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API สำหรับรับ Webhook เวลามีคนสแกนจ่ายเงิน
app.post('/api/webhook', (req, res) => {
    const event = req.body;
    
    if (event.key === 'charge.complete' && event.data.status === 'successful') {
        console.log(`\n🎉 [เงินเข้าแล้ว!] ชาร์จ ID: ${event.data.id}`);
        console.log(`> ตรงนี้คือจุดที่เราจะส่งคำสั่ง MQTT ไปบอกตู้ให้ปล่อยยา! <\n`);
    }
    
    res.status(200).send('OK');
});

app.listen(3000, () => console.log('✅ Backend รันแล้วที่พอร์ต 3000'));