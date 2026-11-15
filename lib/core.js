// ===================================================================
// TU Smart Rx — แกนหลักด้านความปลอดภัยของคำสั่งจ่ายยา (ไม่มี dependency ภายนอก)
// ใช้ร่วมกันโดย server.js และชุดทดสอบ test/core.test.js
//
// รูปแบบคำสั่งที่ส่งไปตู้ (MQTT payload):
//     CMD|ID|TS|SIG
//   CMD  = DISPENSE หรือ PENDING
//   ID   = รหัสอ้างอิงคำสั่ง (เช่น chargeId ของ Omise) ห้ามมี "|"
//   TS   = เวลา Unix (วินาที) ตอนที่เซิร์ฟเวอร์ออกคำสั่ง
//   SIG  = HMAC-SHA256( DISPENSE_SECRET , "CMD|ID|TS" ) แบบ hex ตัวเล็ก
// ตู้ (ESP32) จะตรวจลายเซ็น อายุคำสั่ง และ ID ซ้ำ ก่อนหมุนมอเตอร์
// ===================================================================
const crypto = require('crypto');

const COMMANDS = new Set(['DISPENSE', 'PENDING']);
const ID_RE = /^[A-Za-z0-9_\-]{1,64}$/;

function signCommand(secret, cmd, id, ts) {
    if (!COMMANDS.has(cmd)) throw new Error(`unknown command: ${cmd}`);
    if (!ID_RE.test(id)) throw new Error(`invalid command id: ${id}`);
    if (!Number.isInteger(ts) || ts <= 0) throw new Error('invalid timestamp');
    const sig = crypto.createHmac('sha256', secret).update(`${cmd}|${id}|${ts}`).digest('hex');
    return `${cmd}|${id}|${ts}|${sig}`;
}

// ตัวตรวจฝั่งเซิร์ฟเวอร์ (ใช้ในชุดทดสอบ เพื่อให้ตรรกะเดียวกับเฟิร์มแวร์)
function verifyCommand(secret, payload, nowSec, windowSec = 90, seen = new Set()) {
    const parts = String(payload).split('|');
    if (parts.length !== 4) return { ok: false, reason: 'format' };
    const [cmd, id, tsStr, sig] = parts;
    if (!COMMANDS.has(cmd)) return { ok: false, reason: 'cmd' };
    if (!ID_RE.test(id)) return { ok: false, reason: 'id' };
    if (!/^\d{1,12}$/.test(tsStr)) return { ok: false, reason: 'ts' };
    const ts = parseInt(tsStr, 10);
    if (Math.abs(nowSec - ts) > windowSec) return { ok: false, reason: 'expired' };
    const expect = crypto.createHmac('sha256', secret).update(`${cmd}|${id}|${ts}`).digest('hex');
    if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return { ok: false, reason: 'signature' };
    if (seen.has(id)) return { ok: false, reason: 'replay' };
    seen.add(id);
    return { ok: true, cmd, id, ts };
}

// ตรวจรายการในตะกร้าที่แอปส่งมา (กันข้อมูลแปลก ๆ / ยอดติดลบ)
function validateItems(items) {
    if (!Array.isArray(items) || items.length < 1 || items.length > 20) throw httpError(400, 'invalid_items');
    const merged = new Map();
    for (const it of items) {
        if (!it || typeof it.id !== 'string' || !/^[A-Za-z0-9_\-]{1,40}$/.test(it.id)) throw httpError(400, 'invalid_item_id');
        const qty = Number(it.qty);
        if (!Number.isInteger(qty) || qty < 1 || qty > 10) throw httpError(400, 'invalid_qty');
        merged.set(it.id, (merged.get(it.id) || 0) + qty);
    }
    return [...merged.entries()].map(([id, qty]) => ({ id, qty }));
}

// คำนวณยอดจากราคาใน Firestore (ไม่เชื่อราคาที่ส่งมาจากแอป)
function computeTotal(items, priceById) {
    let total = 0;
    for (const { id, qty } of items) {
        const price = priceById[id];
        if (!Number.isInteger(price) || price < 0) throw httpError(400, 'unknown_item');
        total += price * qty;
    }
    return total;
}

// แบ่งยอดเป็น "เครดิต" + "เงินโอน" ให้ยอดโอนไม่ต่ำกว่าขั้นต่ำของ Omise
//   ถ้ายอดโอนหลังหักเครดิตต่ำกว่าขั้นต่ำ จะลดเครดิตที่ใช้ลงให้ยอดโอนพอดีขั้นต่ำ
function splitPayment(total, requestedCredit, availableCredit, minAmount) {
    const req = Math.max(0, Math.floor(Number(requestedCredit) || 0));
    let creditUse = Math.min(req, Math.max(0, availableCredit), total);
    let payable = total - creditUse;
    if (payable > 0 && payable < minAmount) {
        creditUse = Math.max(0, total - minAmount);
        payable = total - creditUse;
    }
    if (payable > 0 && payable < minAmount) throw httpError(400, 'below_minimum', { minAmount });
    return { total, creditUse, payable };
}

function httpError(status, code, extra = {}) {
    const e = new Error(code);
    e.status = status; e.code = code; Object.assign(e, extra);
    return e;
}

module.exports = { signCommand, verifyCommand, validateItems, computeTotal, splitPayment, httpError, COMMANDS, ID_RE };
