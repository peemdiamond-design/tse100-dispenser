// ===================================================================
// คัดลอกไฟล์นี้เป็น secrets.h (อยู่โฟลเดอร์เดียวกับ EPS32_CYD.cpp) แล้วกรอกค่าจริง
// secrets.h อยู่ใน .gitignore แล้ว — ห้าม commit
// ===================================================================
#pragma once

// ---------- Wi-Fi ----------
#define WIFI_SSID      "your-wifi-name"
#define WIFI_PASSWORD  "your-wifi-password"

// ---------- MQTT broker ส่วนตัว (เช่น HiveMQ Cloud Serverless) ----------
// ใช้ user ของ "ตู้" (สิทธิ์: subscribe cmd, publish status) ไม่ใช่ user ของ backend
#define MQTT_HOST      "xxxxxxxx.s1.eu.hivemq.cloud"
#define MQTT_PORT      8883
#define MQTT_USERNAME  "tse-kiosk1"
#define MQTT_PASSWORD  "change-me"
#define MQTT_TOPIC_CMD     "tse100/kiosk1/cmd"
#define MQTT_TOPIC_STATUS  "tse100/kiosk1/status"
#define KIOSK_ID       "kiosk1"

// ---------- กุญแจตรวจลายเซ็นคำสั่ง ----------
// ต้องตรงกับ DISPENSE_SECRET ในไฟล์ .env ของเซิร์ฟเวอร์ทุกตัวอักษร
#define DISPENSE_SECRET "paste-the-same-64-hex-characters-as-the-server"

// ---------- ใบรับรอง Root CA ของ broker (แนะนำให้ใส่) ----------
// HiveMQ Cloud ใช้ใบรับรองของ Let's Encrypt → วาง "ISRG Root X1" จาก
// https://letsencrypt.org/certs/isrgrootx1.pem ระหว่าง R"EOF( ... )EOF"
// ถ้าเว้นว่าง ตู้จะยังเข้ารหัส TLS แต่ไม่ตรวจว่าคุยกับ broker ตัวจริง (คำสั่งปลอมยังถูกกันด้วยลายเซ็น)
static const char MQTT_CA_CERT[] = R"EOF(
)EOF";
