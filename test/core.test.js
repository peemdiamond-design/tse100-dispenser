const test = require('node:test');
const assert = require('node:assert');
const { signCommand, verifyCommand, validateItems, computeTotal, splitPayment } = require('../lib/core');

const SECRET = 'a'.repeat(64);
const NOW = 1763200000;

test('คำสั่งที่เซ็นถูกต้องผ่านการตรวจ', () => {
    const p = signCommand(SECRET, 'DISPENSE', 'chrg_test_abc', NOW);
    assert.deepStrictEqual(verifyCommand(SECRET, p, NOW).ok, true);
});
test('คำสั่งแบบเก่า "PAYMENT_SUCCESS" ถูกปฏิเสธ', () => {
    assert.strictEqual(verifyCommand(SECRET, 'PAYMENT_SUCCESS', NOW).reason, 'format');
});
test('กุญแจผิด → ปฏิเสธ', () => {
    const p = signCommand('b'.repeat(64), 'DISPENSE', 'x1', NOW);
    assert.strictEqual(verifyCommand(SECRET, p, NOW).reason, 'signature');
});
test('แก้ ID หลังเซ็น → ปฏิเสธ', () => {
    const p = signCommand(SECRET, 'DISPENSE', 'order1', NOW).replace('order1', 'order2');
    assert.strictEqual(verifyCommand(SECRET, p, NOW).reason, 'signature');
});
test('แก้ PENDING เป็น DISPENSE → ปฏิเสธ', () => {
    const p = signCommand(SECRET, 'PENDING', 'chrg_1', NOW).replace('PENDING', 'DISPENSE');
    assert.strictEqual(verifyCommand(SECRET, p, NOW).reason, 'signature');
});
test('คำสั่งเก่าเกิน 90 วินาที → ปฏิเสธ', () => {
    const p = signCommand(SECRET, 'DISPENSE', 'old', NOW - 120);
    assert.strictEqual(verifyCommand(SECRET, p, NOW).reason, 'expired');
});
test('ส่งคำสั่งเดิมซ้ำ → ปฏิเสธ', () => {
    const seen = new Set();
    const p = signCommand(SECRET, 'DISPENSE', 'dup', NOW);
    assert.strictEqual(verifyCommand(SECRET, p, NOW, 90, seen).ok, true);
    assert.strictEqual(verifyCommand(SECRET, p, NOW, 90, seen).reason, 'replay');
});
test('ID ที่มี | ใช้ไม่ได้', () => {
    assert.throws(() => signCommand(SECRET, 'DISPENSE', 'a|b', NOW));
});
test('validateItems รวมรายการซ้ำและกันค่าแปลก', () => {
    assert.deepStrictEqual(validateItems([{ id: 'p1', qty: 1 }, { id: 'p1', qty: 2 }]), [{ id: 'p1', qty: 3 }]);
    assert.throws(() => validateItems([{ id: 'p1', qty: -1 }]));
    assert.throws(() => validateItems([{ id: 'p1', qty: 1.5 }]));
    assert.throws(() => validateItems([]));
    assert.throws(() => validateItems([{ id: '../x', qty: 1 }]));
});
test('computeTotal ใช้ราคาจากฐานข้อมูล', () => {
    assert.strictEqual(computeTotal([{ id: 'p1', qty: 2 }, { id: 'p3', qty: 1 }], { p1: 20, p3: 15 }), 55);
    assert.throws(() => computeTotal([{ id: 'zz', qty: 1 }], { p1: 20 }));
});
test('splitPayment: เครดิตไม่เกินที่มี และยอดโอนไม่ต่ำกว่าขั้นต่ำ', () => {
    assert.deepStrictEqual(splitPayment(40, 30, 30, 20), { total: 40, creditUse: 20, payable: 20 });
    assert.deepStrictEqual(splitPayment(40, 100, 5, 20), { total: 40, creditUse: 5, payable: 35 });
    assert.deepStrictEqual(splitPayment(40, 0, 50, 20), { total: 40, creditUse: 0, payable: 40 });
    assert.deepStrictEqual(splitPayment(20, 20, 20, 20), { total: 20, creditUse: 20, payable: 0 });
    assert.throws(() => splitPayment(15, 0, 0, 20), /below_minimum/);
});
