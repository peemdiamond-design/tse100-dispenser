// สร้างกรณีทดสอบด้วยตัวเซ็นจริงของเซิร์ฟเวอร์ แล้วส่งให้ตัวตรวจของเฟิร์มแวร์ (C++) ตรวจ
const { signCommand } = require('../lib/core');
const S = process.argv[2], NOW = 1763200000;
const ok = (id, cmd = 'DISPENSE', ts = NOW) => signCommand(S, cmd, id, ts);
const cases = [
  ['OK', NOW, ok('chrg_test_5abc')],
  ['OK', NOW + 60, ok('credit_9f8e7d', 'DISPENSE')],
  ['OK', NOW, ok('chrg_test_pending', 'PENDING')],
  ['REPLAY', NOW, ok('chrg_test_5abc')],
  ['BAD_FORMAT', NOW, 'PAYMENT_SUCCESS'],
  ['BAD_SIGNATURE', NOW, signCommand('f'.repeat(64), 'DISPENSE', 'forged1', NOW)],
  ['BAD_SIGNATURE', NOW, ok('order1').replace('order1', 'order9')],
  ['BAD_SIGNATURE', NOW, ok('p2', 'PENDING').replace('PENDING', 'DISPENSE')],
  ['EXPIRED', NOW, ok('old1', 'DISPENSE', NOW - 91)],
  ['EXPIRED', NOW, ok('future1', 'DISPENSE', NOW + 500)],
  ['CLOCK_NOT_SYNCED', 1000, ok('x1')],
  ['BAD_CMD', NOW, 'OPEN|x|' + NOW + '|' + 'a'.repeat(64)],
  ['BAD_ID', NOW, 'DISPENSE|a/b|' + NOW + '|' + 'a'.repeat(64)],
  ['BAD_FORMAT', NOW, ok('extra') + '|more'],
];
for (const [e, now, p] of cases) console.log(e, now, p);
