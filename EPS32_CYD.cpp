#include <WiFi.h>
#include <PubSubClient.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ILI9341.h>
#include "tu_qrcode.h" 
#include <XPT2046_Touchscreen.h> 

// ---------------- 1. ตั้งค่า Wi-Fi & MQTT ----------------
const char* ssid = "62/532_2.4G";      
const char* password = "09154951";     
const char* mqtt_server = "broker.emqx.io"; 
const char* mqtt_topic = "tse100/dispense"; 

// ---------------- 2. ตั้งค่าขาพิน (หน้าจอ & ฮาร์ดแวร์) ----------------
// ขาของหน้าจอ (SPI วงจรที่ 1)
#define TFT_MOSI 13
#define TFT_MISO 12
#define TFT_CLK  14
#define TFT_CS   15
#define TFT_DC   2
#define TFT_RST  -1  
#define TFT_BL   21  

// [แก้ใหม่] ขาของทัชสกรีน CYD โดยเฉพาะ (SPI วงจรที่ 2)
#define TOUCH_MOSI 32
#define TOUCH_MISO 39
#define TOUCH_CLK  25
#define TOUCH_CS   33 

#define MOTOR_PIN 22     
#define LIMIT_PIN 27     

Adafruit_ILI9341 tft = Adafruit_ILI9341(TFT_CS, TFT_DC, TFT_RST);

// สร้างถนนเลนที่ 2 (HSPI) สำหรับทัชสกรีนโดยเฉพาะ
SPIClass touchSpi = SPIClass(HSPI); 
XPT2046_Touchscreen ts(TOUCH_CS); 

WiFiClient espClient;
PubSubClient client(espClient);

// ---------------- 3. โทนสี ----------------
#define TU_RED     0xC800  
#define TU_YELLOW  0xFEA0  
#define WHITE_BG   0xFFFF  
#define BLACK_TEXT 0x0000 
#define SUCCESS_GREEN 0x05E0 

int loadDotCount = 0;
unsigned long lastAnimTime = 0;
bool isDispensing = false;

// ---------------- 4. ตัวแปรสำหรับ Screen Saver ----------------
unsigned long lastActivityTime = 0;
const unsigned long SCREEN_TIMEOUT = 60000; // ตั้งไว้ 10 วินาที

// ========================================================
void printCentered(String text, int y, int size, uint16_t color) {
  tft.setTextSize(size);
  tft.setTextColor(color);
  int textWidth = text.length() * 6 * size; 
  int x = (320 - textWidth) / 2;
  tft.setCursor(x, y);
  tft.print(text);
}

void drawStaticUI() {
  tft.fillScreen(WHITE_BG); 
  tft.fillRect(0, 0, 320, 35, TU_RED);
  printCentered("TU Smart RX", 10, 2, TU_YELLOW);
  tft.drawRoundRect(20, 55, 280, 130, 8, TU_RED);
  tft.drawRoundRect(21, 56, 278, 128, 8, TU_RED);
}

void clearCenterCard() {
  tft.fillRoundRect(22, 57, 276, 126, 8, WHITE_BG);
}

void showReadyScreen() {
  clearCenterCard();
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
  
  tft.fillRect(0, 215, 320, 25, TU_RED);
  tft.setTextColor(WHITE_BG);
  tft.setTextSize(1);
  tft.setCursor(10, 223);
  tft.print("Status: Online & Ready");
}

void showWaitingPayment() {
  clearCenterCard();
  printCentered("WAITING PAYMENT", 100, 2, TU_RED);
  tft.fillRect(0, 215, 320, 25, TU_YELLOW);
  tft.setTextColor(BLACK_TEXT);
  tft.setCursor(10, 223);
  tft.print("Status: Waiting for transfer...");
}

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

void setup_wifi() {
  delay(10);
  clearCenterCard();
  printCentered("Connecting to:", 85, 2, BLACK_TEXT);
  printCentered(String(ssid), 120, 2, TU_RED); 
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); }

  clearCenterCard();
  printCentered("WiFi Connected!", 90, 2, SUCCESS_GREEN);
  printCentered(WiFi.localIP().toString(), 130, 2, BLACK_TEXT); 
  delay(2000); 
}

void callback(char* topic, byte* payload, unsigned int length) {
  lastActivityTime = millis(); 
  
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
    clearCenterCard();
    printCentered("DISPENSING", 85, 3, TU_RED); 
    isDispensing = true; 
    
    digitalWrite(MOTOR_PIN, HIGH);
    delay(500); 
    unsigned long startTime = millis();
    while (digitalRead(LIMIT_PIN) == HIGH) {
      if (millis() - startTime > 6000) break; 
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
    isDispensing = false;
    delay(2000); 
    
    showReadyScreen(); 
    lastActivityTime = millis(); 
  }
}

void reconnect() {
  while (!client.connected()) {
    clearCenterCard();
    printCentered("Connecting MQTT...", 100, 2, BLACK_TEXT);
    String clientId = "TU-SmartRx-";
    clientId += String(random(0xffff), HEX);
    if (client.connect(clientId.c_str())) {
      client.subscribe(mqtt_topic);
      showReadyScreen();
      lastActivityTime = millis(); 
    } else {
      clearCenterCard();
      printCentered("MQTT FAILED!", 90, 2, TU_RED);
      printCentered("Code: " + String(client.state()), 120, 2, BLACK_TEXT);
      printCentered("Retrying in 5s...", 150, 2, BLACK_TEXT);
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
  
  // 1. เปิดวงจรหน้าจอ
  SPI.begin(TFT_CLK, TFT_MISO, TFT_MOSI);
  tft.begin();
  tft.setRotation(1); 
  
  // 2. เปิดวงจรทัชสกรีน แยกต่างหาก!
  touchSpi.begin(TOUCH_CLK, TOUCH_MISO, TOUCH_MOSI, TOUCH_CS);
  ts.begin(touchSpi);
  ts.setRotation(1);
  
  drawStaticUI();
  setup_wifi();
  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);
  
  lastActivityTime = millis();
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // ----------------------------------------------------
  // เช็คทัชสกรีน (ตอนนี้คุยกันรู้เรื่องแล้ว!)
  // ----------------------------------------------------
  if (ts.touched()) {
    TS_Point p = ts.getPoint();
    
    // ตั้งเกณฑ์แรงกดมาตรฐาน (ตัดค่า 4095 ออก)
    if (p.z > 200 && p.z < 4000) {
      lastActivityTime = millis(); 
      delay(50); // กันแตะเบิ้ล
    }
  }

  // ----------------------------------------------------
  // กฎเหล็ก ควบคุมไฟหน้าจอ
  // ----------------------------------------------------
  if (!isDispensing && (millis() - lastActivityTime > SCREEN_TIMEOUT)) {
    digitalWrite(TFT_BL, LOW);  // ถ้าเกิน 10 วิ ปิดไฟ
  } else {
    digitalWrite(TFT_BL, HIGH); // ถ้ายังไม่ถึง เปิดไฟ
  }
}
