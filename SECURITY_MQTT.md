# 🔒 ความปลอดภัยการสั่งตู้จ่ายยา (MQTT)

## ปัญหาเดิม
- ตู้ฟังคำสั่ง `PAYMENT_SUCCESS` บน broker สาธารณะ (`broker.emqx.io`) ใครรู้ชื่อ topic ก็สั่งตู้จ่ายยาได้ ไม่ต้องจ่ายเงิน
- แอปบนเว็บเป็นตัวส่งคำสั่งเอง ถ้าใส่รหัสผ่าน broker ไว้ในเว็บ ใครเปิดดูซอร์สก็เห็นรหัสทันที
- คีย์ Omise และรหัส Wi-Fi ถูกเขียนไว้ในโค้ดที่อยู่บน GitHub แบบสาธารณะ

## ระบบใหม่
```
แอป ──HTTPS──▶ Backend (Ubuntu) ──ตรวจกับ Omise / หักเครดิตใน Firestore──┐
                                                                       ▼
            ตู้ ESP32 ◀──MQTT over TLS + รหัสผ่าน── broker ส่วนตัว ◀── คำสั่งที่มีลายเซ็น HMAC
```
1. **มีแต่ Backend ที่ส่งคำสั่งได้:** แอปบนเว็บไม่ต่อ MQTT แล้ว
2. **สั่งตู้หลังยืนยันการจ่ายเงินแล้วเท่านั้น:** ตรวจกับ Omise ว่า charge สำเร็จ หรือหักเครดิตสำเร็จ (ทำใน transaction) แต่ละรายการจ่ายยาได้ครั้งเดียว (`dispenses/{id}` ใน Firestore)
3. **ทุกคำสั่งมีลายเซ็น:** `DISPENSE|ID|เวลา|HMAC-SHA256` ตู้ไม่รับคำสั่งที่ลายเซ็นผิด เก่าเกิน 90 วินาที หรือ ID ซ้ำ ถ้า broker หลุด คนอื่นก็ยังปลอมคำสั่งไม่ได้
4. **Broker ส่วนตัว:** ต้องใช้ username/password และเข้ารหัสด้วย TLS แยก user ของ backend กับ user ของตู้ ให้สิทธิ์เท่าที่จำเป็น
5. **ค่าลับอยู่นอก git:** ฝั่งเซิร์ฟเวอร์อยู่ใน `.env` ฝั่งตู้อยู่ใน `secrets.h`

---

## ขั้นตอนติดตั้ง (ต้องทำครบทั้ง 3 ส่วนพร้อมกัน: Backend → ตู้ → เว็บ)

### 1. สร้าง broker ส่วนตัว (HiveMQ Cloud แพ็กเกจฟรี)
1. สมัครที่ https://www.hivemq.com/cloud/ แล้วสร้าง cluster แบบ **Serverless (Free)**
2. จด **Cluster URL** (เช่น `abc123.s1.eu.hivemq.cloud`) ใช้พอร์ต **8883 (TLS)**
3. ไปที่ **Access Management** แล้วสร้าง credentials 2 ชุด:

   | user | ใช้ที่ | สิทธิ์ที่ควรตั้ง (ถ้าหน้าจอให้ตั้งรายหัวข้อได้) |
   |---|---|---|
   | `tse-backend` | ไฟล์ `.env` ของเซิร์ฟเวอร์ | publish `tse100/kiosk1/cmd` · subscribe `tse100/kiosk1/status` |
   | `tse-kiosk1` | ไฟล์ `secrets.h` ของตู้ | subscribe `tse100/kiosk1/cmd` · publish `tse100/kiosk1/status` |

   ตั้งรหัสผ่านยาวและสุ่ม เช่นสร้างด้วย `openssl rand -base64 24`

> ถ้าอยากใช้ broker ของตัวเอง (เช่น Mosquitto บน Ubuntu) ก็ได้ แค่เปลี่ยน `MQTT_URL` และ `MQTT_HOST` แต่ต้องเปิดพอร์ต 8883 ให้ตู้เข้าถึงได้จากอินเทอร์เน็ต และทำ TLS เอง HiveMQ Cloud ง่ายกว่าสำหรับตอนนี้

### 2. สร้างกุญแจเซ็นคำสั่ง
```bash
openssl rand -hex 32
```
ได้ตัวอักษร 64 ตัว ใส่เป็น `DISPENSE_SECRET` ทั้งใน `.env` (เซิร์ฟเวอร์) และ `secrets.h` (ตู้) **ต้องตรงกันทุกตัวอักษร**

### 3. เตรียมคีย์อื่น ๆ
- **Omise:** สร้างคีย์ชุดใหม่ใน dashboard.omise.co เพราะคีย์ชุดเก่าหลุดอยู่ในประวัติ git แล้ว ลบไฟล์ออกไม่ได้ช่วย
- **Firebase Admin:** Firebase Console › Project settings › Service accounts › **Generate new private key** แล้ววางไฟล์ JSON ไว้ข้าง `server.js` (ห้าม commit)

### 4. อัปเดต Backend บน Ubuntu
```bash
cd ~/tse-backend
cp server.js server.js.bak                      # สำรองของเดิม
# คัดลอกไฟล์ใหม่จาก repo: server.js, lib/, package.json, .env.example
cp .env.example .env && nano .env               # กรอกค่าจริงทั้งหมด
npm install
sudo pm2 restart tse-backend && sudo pm2 logs tse-backend --lines 20
curl http://localhost:80/api/status             # ควรเห็น "mqtt":true
```

### 5. อัปเดตเฟิร์มแวร์ตู้
1. คัดลอก `secrets.example.h` เป็น `secrets.h` แล้วกรอก Wi-Fi, ข้อมูล HiveMQ (user `tse-kiosk1`), `DISPENSE_SECRET`
2. วางใบรับรอง **ISRG Root X1** จาก https://letsencrypt.org/certs/isrgrootx1.pem ลงใน `MQTT_CA_CERT` (แนะนำให้ทำ)
3. วาง `kiosk_auth.h` และ `secrets.h` ไว้โฟลเดอร์เดียวกับไฟล์เฟิร์มแวร์ แล้วอัปโหลดลง ESP32
4. ตอนเปิดเครื่อง จอจะขึ้น "Syncing clock..." แล้วตามด้วย "Connecting MQTT..." ถ้าเชื่อมต่อสำเร็จ หน้าแอดมินจะขึ้น **ระบบ Online**

### 6. Merge Pull Request ของเว็บ
แอปเวอร์ชันใหม่จะเรียก `/api/create-qr`, `/api/check-payment`, `/api/redeem-credit`, `/api/test-dispense`, `/api/status`

---

## ✅ ทดสอบหลังติดตั้ง
- [ ] ซื้อยาแล้วจ่ายจริงหรือใช้คีย์ทดสอบของ Omise → ตู้จ่ายยา และ Firestore มี `dispenses/{chargeId}` ที่ `published: true`
- [ ] ลองส่งคำสั่งปลอม (เช่นใช้แอป MQTT Explorer ล็อกอินด้วย user ของตู้ แล้ว publish `PAYMENT_SUCCESS` หรือ `DISPENSE|x|123|abc`) → ตู้**ต้องไม่หมุน** และ Serial Monitor ขึ้น `Rejected command: ...`
- [ ] กดเช็กสถานะการจ่ายเงินซ้ำ ๆ → ตู้จ่ายยาแค่ครั้งเดียว
- [ ] ปุ่ม "ทดสอบมอเตอร์" ในหน้าแอดมินใช้ได้ แต่ถ้าเรียก `/api/test-dispense` โดยไม่ล็อกอินเป็นแอดมิน จะได้ 403
- [ ] `npm test` ผ่านทั้งหมด

## Firestore Rules ที่เกี่ยวข้อง
Backend ใช้ Admin SDK จึงไม่ติด Rules ส่วนแอปควรถูกจำกัดดังนี้:
- `dispenses`, `creditLogs`: **ห้ามแอปเขียน** (มีแต่เซิร์ฟเวอร์เขียน)
- `users/{id}.credits`: **ห้ามแอปแก้** (เซิร์ฟเวอร์หักเครดิต ส่วนแอดมินเพิ่มเครดิตตอนอนุมัติบริจาค)
