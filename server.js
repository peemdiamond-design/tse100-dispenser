const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt'); // โมดูล MQTT
const omise = require('omise')({
    publicKey: 'pkey_test_68yjm1vzidi0j5gejzy',
    secretKey: 'skey_test_68yjsgwrdgq1ortftyk',
    omiseVersion: '2019-05-29'
});

const app = express();
app.use(cors());
app.use(express.json());

// -----------------------------------------------------
// 1. ตั้งค่าการเชื่อมต่อ MQTT
const mqttClient = mqtt.connect('mqtt://broker.hivemq.com'); 
const MQTT_TOPIC = 'tse100/dispense';

mqttClient.on('connect', () => {
    console.log('✅ เชื่อมต่อ MQTT Broker สำเร็จ พร้อมสั่งงานตู้ยา!');
});

mqttClient.on('error', (err) => {
    console.error('❌ MQTT Error:', err);
});
// -----------------------------------------------------

// API สำหรับสร้าง QR Code
app.post('/api/create-qr', async (req, res) => {
    try {
        const source = await omise.sources.create({
            type: 'promptpay',
            amount: 2000, // 20.00 บาท
            currency: 'thb'
        });
        
        const charge = await omise.charges.create({
            amount: 2000,
            currency: 'thb',
            source: source.id,
            return_uri: 'http://localhost:5000' // แก้เป็นพอร์ต 5000
        });

        res.json({
            chargeId: charge.id,
            qrImage: charge.source.scannable_code.image.download_uri
        });
    } catch (error) {
        console.error("❌ Omise Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// API สำหรับรับ Webhook เวลามีคนสแกนจ่ายเงิน
app.post('/api/webhook', (req, res) => {
    const event = req.body;
    
    if (event.key === 'charge.complete' && event.data.status === 'successful') {
        console.log(`\n🎉 [เงินเข้าแล้ว!] ชาร์จ ID: ${event.data.id}`);
        
        // ส่งคำสั่ง (Publish) ข้อความผ่าน MQTT ไปบอกบอร์ด ESP32
        mqttClient.publish(MQTT_TOPIC, 'PAYMENT_SUCCESS', () => {
            console.log(`📡 ส่งคำสั่ง 'PAYMENT_SUCCESS' ไปที่ตู้ยาสำเร็จ! (Topic: ${MQTT_TOPIC})\n`);
        });
    }
    
    res.status(200).send('OK');
});

// รันเซิร์ฟเวอร์ที่พอร์ต 5000
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Backend รันแล้วที่พอร์ต ${PORT}`));
