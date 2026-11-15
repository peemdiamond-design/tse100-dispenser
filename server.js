// ===================================================================
// TU Smart Rx — Backend (Node.js + Express)
//
// หลักความปลอดภัย:
//   • เซิร์ฟเวอร์นี้เป็น "ที่เดียว" ที่สั่งตู้จ่ายยาได้ แอปบนเว็บไม่ได้ต่อ MQTT แล้ว
//   • สั่งจ่ายยาหลังตรวจกับ Omise ว่าจ่ายเงินสำเร็จจริง หรือหักเครดิตใน Firestore สำเร็จแล้วเท่านั้น
//   • ทุกคำสั่งมีลายเซ็น HMAC + เวลา + ID ไม่ซ้ำ ตู้จะไม่รับคำสั่งปลอมหรือคำสั่งเก่า
//   • คีย์ทุกตัวอ่านจากไฟล์ .env (ห้าม commit) ดูตัวอย่างใน .env.example
//   • หนึ่ง charge / หนึ่งคำสั่งซื้อ = จ่ายยาได้ครั้งเดียว (บันทึกใน Firestore: dispenses/{id})
// ===================================================================
require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');
const admin = require('firebase-admin');
const { signCommand, validateItems, computeTotal, splitPayment, httpError } = require('./lib/core');

// ---------- 1. ตั้งค่า ----------
function need(key) {
    const v = process.env[key];
    if (!v) { console.error(`❌ ไม่พบค่า ${key} ในไฟล์ .env (ดู .env.example)`); process.exit(1); }
    return v;
}
const PORT = parseInt(process.env.PORT || '80', 10);
const ADMIN_ID = process.env.ADMIN_ID || '6910616249';
const FAKE_DOMAIN = '@tse.tu.ac.th';
const DISPENSE_SECRET = need('DISPENSE_SECRET');
if (DISPENSE_SECRET.length < 32) { console.error('❌ DISPENSE_SECRET ต้องยาวอย่างน้อย 32 ตัวอักษร (ใช้: openssl rand -hex 32)'); process.exit(1); }
const TOPIC_CMD = process.env.MQTT_TOPIC_CMD || 'tse100/kiosk1/cmd';
const TOPIC_STATUS = process.env.MQTT_TOPIC_STATUS || 'tse100/kiosk1/status';
const OMISE_MIN_AMOUNT = parseInt(process.env.OMISE_MIN_AMOUNT || '20', 10); // บาท
const RETURN_URI = process.env.RETURN_URI || 'https://tuya.peemcn25.dev';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://tuya.peemcn25.dev').split(',').map(s => s.trim()).filter(Boolean);

const omise = require('omise')({
    publicKey: need('OMISE_PUBLIC_KEY'),
    secretKey: need('OMISE_SECRET_KEY'),
    omiseVersion: '2019-05-29'
});

admin.initializeApp({ credential: admin.credential.cert(require(path.resolve(need('FIREBASE_SERVICE_ACCOUNT')))) });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const app = express();
app.set('trust proxy', true); // อยู่หลัง Cloudflare
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json({ limit: '20kb' }));

// ---------- 2. MQTT (broker ส่วนตัว + username/password + TLS) ----------
const kiosk = { online: false, lastSeen: null, lastMessage: null };
const mqttClient = mqtt.connect(need('MQTT_URL'), {
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    clientId: 'tse-backend-' + crypto.randomBytes(4).toString('hex'),
    reconnectPeriod: 3000,
    connectTimeout: 10000
});
mqttClient.on('connect', () => {
    console.log(`✅ เชื่อมต่อ MQTT สำเร็จ (${process.env.MQTT_URL.replace(/\/\/.*@/, '//')})`);
    mqttClient.subscribe(TOPIC_STATUS, { qos: 1 });
});
mqttClient.on('error', err => console.error('❌ MQTT Error:', err.message));
mqttClient.on('message', (topic, buf) => {
    if (topic !== TOPIC_STATUS) return;
    const msg = buf.toString().slice(0, 120);
    kiosk.lastSeen = Date.now(); kiosk.lastMessage = msg;
    kiosk.online = msg !== 'OFFLINE';
    const m = msg.match(/^DISPENSED\|([A-Za-z0-9_\-]{1,64})$/);
    if (m) db.collection('dispenses').doc(m[1]).set({ dispensedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
});

function publishCommand(cmd, id) {
    return new Promise((resolve, reject) => {
        if (!mqttClient.connected) return reject(httpError(503, 'kiosk_unreachable'));
        const payload = signCommand(DISPENSE_SECRET, cmd, id, Math.floor(Date.now() / 1000));
        mqttClient.publish(TOPIC_CMD, payload, { qos: 1 }, err => err ? reject(httpError(503, 'publish_failed')) : resolve());
    });
}

// ---------- 3. ตัวช่วย ----------
// ตรวจ Firebase ID token ที่แอปส่งมาใน header Authorization: Bearer <token>
async function getUser(req) {
    const h = req.headers.authorization || '';
    if (!h.startsWith('Bearer ')) return null;
    try {
        const tok = await admin.auth().verifyIdToken(h.slice(7));
        const email = tok.email || '';
        if (!email.endsWith(FAKE_DOMAIN)) return null;
        const stuId = email.slice(0, -FAKE_DOMAIN.length);
        return { uid: tok.uid, stuId, isAdmin: stuId === ADMIN_ID };
    } catch { return null; }
}

async function priceMap(items) {
    const snaps = await db.getAll(...items.map(i => db.collection('inventory').doc(i.id)));
    const map = {};
    snaps.forEach(s => { if (s.exists) map[s.id] = parseInt(s.data().price, 10); });
    return map;
}

// rate limit แบบง่าย (ต่อ IP)
const hits = new Map();
function rateLimit(max, windowMs) {
    return (req, res, next) => {
        const key = req.ip + req.path.split('/').slice(0, 3).join('/');
        const now = Date.now();
        const arr = (hits.get(key) || []).filter(t => now - t < windowMs);
        if (arr.length >= max) return res.status(429).json({ error: 'too_many_requests' });
        arr.push(now); hits.set(key, arr); next();
    };
}
setInterval(() => { const now = Date.now(); for (const [k, a] of hits) if (!a.some(t => now - t < 120000)) hits.delete(k); }, 60000).unref();

const wrap = fn => (req, res) => fn(req, res).catch(err => {
    if (!err.status) console.error('❌', req.method, req.path, err);
    res.status(err.status || 500).json({ error: err.code || 'server_error', ...(err.minAmount ? { minAmount: err.minAmount } : {}) });
});

// ทำรายการจ่ายยาแบบ "ครั้งเดียวเท่านั้น": หักเครดิต (ถ้ามี) + จองสิทธิ์จ่ายยา ใน transaction เดียว
//   คืนค่า true ถ้าต้องส่งคำสั่งไปตู้ (ยังไม่เคยส่งสำเร็จ)
async function reserveDispense(id, { stuId, creditUse, type, amountPaid }) {
    const ref = db.collection('dispenses').doc(id);
    return db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        if (snap.exists) return !snap.data().published; // เคยจองแล้ว: ส่งซ้ำเฉพาะกรณีครั้งก่อนส่งไม่ออก
        if (creditUse > 0) {
            const uRef = db.collection('users').doc(stuId);
            const u = await tx.get(uRef);
            const have = u.exists ? parseInt(u.data().credits || 0, 10) : 0;
            if (have < creditUse) throw httpError(409, 'credit_insufficient');
            tx.update(uRef, { credits: FieldValue.increment(-creditUse) });
            tx.set(db.collection('creditLogs').doc(), { stuId, amount: -creditUse, reason: 'redeem', ref: id, createdAt: FieldValue.serverTimestamp() });
        }
        tx.set(ref, { type, stuId: stuId || 'guest', creditUse: creditUse || 0, amountPaid: amountPaid || 0, published: false, createdAt: FieldValue.serverTimestamp() });
        return true;
    });
}
async function dispense(id, info) {
    const mustSend = await reserveDispense(id, info);
    if (!mustSend) return { already: true };
    await publishCommand('DISPENSE', id);
    await db.collection('dispenses').doc(id).update({ published: true, publishedAt: FieldValue.serverTimestamp() });
    return { already: false };
}

// ---------- 4. API ----------
// สร้าง QR PromptPay — ยอดคำนวณจากราคาใน Firestore เท่านั้น
app.post('/api/create-qr', rateLimit(15, 60000), wrap(async (req, res) => {
    const items = validateItems(req.body.items);
    const user = await getUser(req);
    const total = computeTotal(items, await priceMap(items));
    let available = 0;
    if (user && !user.isAdmin && req.body.creditUse > 0) {
        const u = await db.collection('users').doc(user.stuId).get();
        available = u.exists ? parseInt(u.data().credits || 0, 10) : 0;
    }
    const split = splitPayment(total, user && !user.isAdmin ? req.body.creditUse : 0, available, OMISE_MIN_AMOUNT);
    if (split.payable === 0) throw httpError(400, 'use_redeem_credit');

    const source = await omise.sources.create({ type: 'promptpay', amount: split.payable * 100, currency: 'thb' });
    let charge = await omise.charges.create({
        amount: split.payable * 100, currency: 'thb', source: source.id, return_uri: RETURN_URI,
        metadata: { stuId: user ? user.stuId : 'guest', creditUse: String(split.creditUse), total: String(total), items: JSON.stringify(items) }
    });
    if (!(charge.source && charge.source.scannable_code)) charge = await omise.charges.retrieve(charge.id);
    publishCommand('PENDING', charge.id).catch(() => {}); // ให้จอตู้ขึ้น "รอชำระเงิน" (ไม่สำคัญถ้าส่งไม่ออก)
    res.json({ chargeId: charge.id, qrImage: charge.source.scannable_code.image.download_uri, ...split });
}));

// ตรวจสถานะการจ่ายเงิน — ถ้าสำเร็จ เซิร์ฟเวอร์สั่งตู้เอง (แอปสั่งตู้ไม่ได้แล้ว)
app.get('/api/check-payment/:chargeId', rateLimit(40, 60000), wrap(async (req, res) => {
    const id = req.params.chargeId;
    if (!/^chrg_[A-Za-z0-9_]{1,60}$/.test(id)) throw httpError(400, 'invalid_charge');
    const charge = await omise.charges.retrieve(id);
    if (charge.status !== 'successful') return res.json({ status: charge.status === 'pending' ? 'pending' : charge.status });
    const meta = charge.metadata || {};
    const result = await dispense(id, {
        type: 'omise', stuId: meta.stuId && meta.stuId !== 'guest' ? meta.stuId : null,
        creditUse: parseInt(meta.creditUse || '0', 10), amountPaid: charge.amount / 100
    });
    res.json({ status: 'success', creditUse: parseInt(meta.creditUse || '0', 10), ...result });
}));

// จ่ายด้วยเครดิตทั้งหมด (ต้องล็อกอิน)
app.post('/api/redeem-credit', rateLimit(10, 60000), wrap(async (req, res) => {
    const user = await getUser(req);
    if (!user || user.isAdmin) throw httpError(401, 'login_required');
    const items = validateItems(req.body.items);
    const total = computeTotal(items, await priceMap(items));
    if (total <= 0) throw httpError(400, 'invalid_total');
    const id = 'credit_' + crypto.randomBytes(9).toString('hex');
    const result = await dispense(id, { type: 'credit', stuId: user.stuId, creditUse: total, amountPaid: 0 });
    res.json({ status: 'success', ref: id, creditUse: total, ...result });
}));

// ปุ่มทดสอบมอเตอร์ของแอดมิน
app.post('/api/test-dispense', rateLimit(10, 60000), wrap(async (req, res) => {
    const user = await getUser(req);
    if (!user || !user.isAdmin) throw httpError(403, 'admin_only');
    const id = 'test_' + crypto.randomBytes(9).toString('hex');
    await dispense(id, { type: 'test', stuId: user.stuId, creditUse: 0 });
    res.json({ status: 'sent', ref: id });
}));

// สถานะระบบ (หน้าแอดมินใช้แสดง Online/Offline)
app.get('/api/status', (req, res) => {
    const fresh = kiosk.lastSeen && Date.now() - kiosk.lastSeen < 3 * 60 * 1000;
    res.json({ server: true, mqtt: mqttClient.connected, kiosk: { online: !!(kiosk.online && fresh), lastSeen: kiosk.lastSeen } });
});

app.listen(PORT, () => console.log(`✅ Backend รันแล้วที่พอร์ต ${PORT}`));
