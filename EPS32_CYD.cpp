#include <WiFi.h>
#include <PubSubClient.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ILI9341.h>
#include "tu_qrcode.h" // ใช้ไลบรารีที่เปลี่ยนชื่อแล้ว

// ---------------- 1. ตั้งค่า Wi-Fi & MQTT ----------------
const char* ssid = "0800652735";      // เปลี่ยนให้ตรงกับชื่อ Hotspot 2.4GHz
const char* password = "1234567890";     // เปลี่ยนให้ตรงกับรหัสผ่าน Hotspot
const char* mqtt_server = "broker.emqx.io"; 
const char* mqtt_topic = "tse100/dispense"; 

// ---------------- 2. ตั้งค่าขาพิน (หน้าจอ & ฮาร์ดแวร์) ----------------
#define TFT_MOSI 13
#define TFT_MISO 12
#define TFT_CLK  14
#define TFT_CS   15
#define TFT_DC   2
#define TFT_RST  -1  
#define TFT_BL   21  

#define MOTOR_PIN 22     
#define LIMIT_PIN 27     

Adafruit_ILI9341 tft = Adafruit_ILI9341(TFT_CS, TFT_DC, TFT_MOSI, TFT_CLK, TFT_RST, TFT_MISO);
WiFiClient espClient;
PubSubClient client(espClient);

// ---------------- 3. โทนสี ----------------
#define TU_RED     0xC800  
#define TU_YELLOW  0xFEA0  
#define WHITE_BG   0xFFFF  
#define BLACK_TEXT 0x0000 
#define SUCCESS_GREEN 0x05E0 

// ตัวแปรสำหรับแอนิเมชัน
int loadDotCount = 0;
unsigned long lastAnimTime = 0;
bool isDispensing = false;

// ========================================================
// ฟังก์ชันช่วยคำนวณจัดข้อความให้อยู่กึ่งกลางจอเป๊ะๆ
// ========================================================
void printCentered(String text, int y, int size, uint16_t color) {
  tft.setTextSize(size);
  tft.setTextColor(color);
  int textWidth = text.length() * 6 * size; 
  int x = (320 - textWidth) / 2;
  tft.setCursor(x, y);
  tft.print(text);
}

// ========================================================
// ฟังก์ชันวาดโครงสร้างหลัก (แถบบน-ล่าง)
// ========================================================
void drawStaticUI() {
  tft.fillScreen(WHITE_BG); 
  tft.fillRect(0, 0, 320, 35, TU_RED);
  
  printCentered("TU Smart RX", 10, 2, TU_YELLOW);
  
  tft.drawRoundRect(20, 55, 280, 130, 8, TU_RED);
  tft.drawRoundRect(21, 56, 278, 128, 8, TU_RED);
}

// ========================================================
// ฟังก์ชันล้างพื้นที่ตรงกลางเพื่อวาดใหม่แบบไม่กระพริบ
// ========================================================
void clearCenterCard() {
  tft.fillRoundRect(22, 57, 276, 126, 8, WHITE_BG);
}

// ========================================================
// 1. หน้าจอ: พร้อมให้บริการ (โชว์ QR Code เว็บไซต์)
// ========================================================
void showReadyScreen() {
  clearCenterCard();
  
  // ข้อความซ้าย
  tft.setTextColor(TU_RED);
  tft.setTextSize(2);
  tft.setCursor(35, 85);
  tft.print("SCAN QR");
  
  tft.setTextColor(BLACK_TEXT);
  tft.setTextSize(2);
  tft.setCursor(35, 115);
  tft.print("TO ORDER");

  tft.setTextColor(0x7BEF);
  tft.setTextSize(1);
  tft.setCursor(35, 145);
  tft.print("TU Smart Rx App");

  // QR Code ขวา
  QRCode qrcode;
  uint8_t qrcodeData[qrcode_getBufferSize(3)];
  qrcode_initText(&qrcode, qrcodeData, 3, 0, "https://tuya.peemcn25.dev");

  int scale = 3;
  int startX = 180;
  int startY = 70;

  for (uint8_t y = 0; y < qrcode.size; y++) {
    for (uint8_t x = 0; x < qrcode.size; x++) {
      if (qrcode_getModule(&qrcode, x, y)) {
        tft.fillRect(startX + (x * scale), startY + (y * scale), scale, scale, BLACK_TEXT);
      }
    }
  }
  
  // แถบสถานะล่าง
  tft.fillRect(0, 215, 320, 25, TU_RED);
  tft.setTextColor(WHITE_BG);
  tft.setTextSize(1);
  tft.setCursor(10, 223);
  tft.print("Status: Online & Ready");
}

// ========================================================
// 2. หน้าจอ: รอชำระเงิน
// ========================================================
void showWaitingPayment() {
  clearCenterCard();
  printCentered("WAITING PAYMENT", 100, 2, TU_RED);
  
  tft.fillRect(0, 215, 320, 25, TU_YELLOW);
  tft.setTextColor(BLACK_TEXT);
  tft.setCursor(10, 223);
  tft.print("Status: Waiting for transfer...");
}

// ========================================================
// 3. หน้าจอ: ชำระเงินสำเร็จ (เครื่องหมายติ๊กถูก)
// ========================================================
void showSuccessMark() {
  clearCenterCard();
  
  tft.fillCircle(160, 100, 35, SUCCESS_GREEN);
  for(int i=-1; i<=1; i++) {
    tft.drawLine(145+i, 100, 155+i, 110, WHITE_BG);
    tft.drawLine(155+i, 110, 175+i, 85, WHITE_BG);
  }
  
  printCentered("PAYMENT SUCCESS", 150, 2, SUCCESS_GREEN);
  
  tft.fillRect(0, 215, 320, 25, SUCCESS_GREEN);
  tft.setTextColor(WHITE_BG);
  tft.setCursor(10, 223);
  tft.print("Status: Payment Confirmed!");
}

// ========================================================
// [อัปเดต] ฟังก์ชันตั้งค่า Wi-Fi (แสดงชื่อและ IP)
// ========================================================
void setup_wifi() {
  delay(10);
  clearCenterCard();
  
  // โชว์ชื่อ Wi-Fi ที่กำลังพยายามเชื่อมต่อ
  printCentered("Connecting to:", 85, 2, BLACK_TEXT);
  printCentered(String(ssid), 120, 2, TU_RED); 
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }

  // เมื่อเชื่อมต่อสำเร็จ โชว์ข้อความและ IP Address
  clearCenterCard();
  printCentered("WiFi Connected!", 90, 2, SUCCESS_GREEN);
  printCentered(WiFi.localIP().toString(), 130, 2, BLACK_TEXT); 
  
  delay(500); // หน่วงเวลาให้ผู้ใช้อ่าน
}

// ========================================================
// ฟังก์ชันรับข้อความจาก MQTT (เว็บแอป)
// ========================================================
void callback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  if (message == "PAYMENT_PENDING") {
    showWaitingPayment();
  }
  
  if (message == "PAYMENT_SUCCESS") {
    showSuccessMark();
    delay(2000); 
    
    // เปลี่ยนเป็นหน้ากำลังจ่ายยา
    clearCenterCard();
    printCentered("DISPENSING", 85, 3, TU_RED); 
    
    isDispensing = true; 
    
    // ----------- มอเตอร์ทำงาน -----------
    digitalWrite(MOTOR_PIN, HIGH);
    delay(500); 
    unsigned long startTime = millis();
    while (digitalRead(LIMIT_PIN) == HIGH) {
      if (millis() - startTime > 6000) break; // ตัดไฟถ้าติด
      
      // แอนิเมชันจุดวิ่ง
      if(millis() - lastAnimTime > 500) {
        lastAnimTime = millis();
        tft.fillRect(60, 130, 200, 30, WHITE_BG); 
        
        String dots = "";
        for(int j=0; j<=loadDotCount; j++) dots += ".";
        printCentered(dots, 130, 4, TU_RED); 
        
        loadDotCount = (loadDotCount + 1) % 4;
      }
    }
    digitalWrite(MOTOR_PIN, LOW); 
    // ------------------------------------
    
    isDispensing = false;
    delay(2000); 
    showReadyScreen(); 
  }
}

// ========================================================
// ฟังก์ชันเชื่อมต่อ MQTT
// ========================================================
void reconnect() {
  while (!client.connected()) {
    String clientId = "TU-SmartRx-";
    clientId += String(random(0xffff), HEX);
    if (client.connect(clientId.c_str())) {
      client.subscribe(mqtt_topic);
      showReadyScreen();
    } else {
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(9600);
  pinMode(MOTOR_PIN, OUTPUT);
  digitalWrite(MOTOR_PIN, LOW);
  pinMode(LIMIT_PIN, INPUT_PULLUP); 
  
  pinMode(TFT_BL, OUTPUT);
  digitalWrite(TFT_BL, HIGH);
  tft.begin();
  tft.setRotation(1); 
  
  drawStaticUI();
  setup_wifi();
  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
}
