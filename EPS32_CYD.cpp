#include <WiFi.h>
#include <PubSubClient.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ILI9341.h>

// ---------------- 1. ตั้งค่า Wi-Fi ----------------
const char* ssid = "62/532_2.4G";      
const char* password = "09154951";     

// ---------------- 2. ตั้งค่า MQTT Broker ----------------
const char* mqtt_server = "broker.hivemq.com"; 
const char* mqtt_topic = "tse100/dispense"; 

// ---------------- 3. ตั้งค่าขาพินหน้าจอ CYD ----------------
#define TFT_MOSI 13
#define TFT_MISO 12
#define TFT_CLK  14
#define TFT_CS   15
#define TFT_DC   2
#define TFT_RST  -1  
#define TFT_BL   21  

Adafruit_ILI9341 tft = Adafruit_ILI9341(TFT_CS, TFT_DC, TFT_MOSI, TFT_CLK, TFT_RST, TFT_MISO);
WiFiClient espClient;
PubSubClient client(espClient);

// 🌟 โทนสีมหาวิทยาลัยธรรมศาสตร์ (แดงเลือดหมู - เหลืองทอง)
#define TU_RED     0xC800  // สีแดงมธ.
#define TU_YELLOW  0xFEA0  // สีเหลืองมธ.
#define WHITE_BG   0xFFFF  // สีขาว (ให้หน้าเว็บดูสะอาด)
#define BLACK_TEXT 0x0000  // สีดำ

// ฟังก์ชันวาด UI แบบคำนวณพิกัดให้ตัวหนังสืออยู่กึ่งกลางเป๊ะๆ ไม่มีล้นขอบ
void showTU_UI(String mainTitle, int mainX, String subTitle, int subX, uint16_t cardBg, uint16_t titleColor, String footerText) {
  // 1. พื้นหลังเว็บ (สีขาว)
  tft.fillScreen(WHITE_BG);

  // 2. แถบ Header ด้านบน (สีแดงมธ.)
  tft.fillRect(0, 0, 320, 35, TU_RED);
  tft.setTextColor(TU_YELLOW); // ตัวหนังสือ "TU Smart RX" สีเหลืองทอง
  tft.setTextSize(2);
  tft.setCursor(85, 10); 
  tft.print("TU Smart RX");

  // 3. กล่อง Card เนื้อหาตรงกลาง
  tft.fillRoundRect(20, 55, 280, 130, 8, cardBg);
  tft.drawRoundRect(20, 55, 280, 130, 8, TU_RED); // เส้นขอบสีแดง
  tft.drawRoundRect(21, 56, 278, 128, 8, TU_RED); // ซ้อนขอบให้หนาขึ้น 1 ชั้น

  // ข้อความหลัก (ชื่อหัวข้อในการ์ด)
  tft.setTextColor(titleColor);
  tft.setTextSize(3);
  tft.setCursor(mainX, 85);
  tft.print(mainTitle);

  // ข้อความรอง (ตัวเล็กด้านล่าง)
  tft.setTextColor(BLACK_TEXT);
  tft.setTextSize(2);
  tft.setCursor(subX, 130);
  tft.print(subTitle);

  // 4. แถบ Footer ด้านล่างสุด (สีแดงมธ.)
  tft.fillRect(0, 215, 320, 25, TU_RED);
  tft.setTextColor(WHITE_BG);
  tft.setTextSize(1);
  tft.setCursor(10, 223);
  tft.print(footerText);
}

void setup_wifi() {
  delay(10);
  // ค่า X คำนวณจากความกว้างจอ (320) ลบด้วยความกว้างของข้อความ
  showTU_UI("CONNECTING", 70, "Please wait...", 76, WHITE_BG, TU_RED, "Status: Wi-Fi Connecting");
  
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✅ เชื่อมต่อ Wi-Fi สำเร็จ!");
}

void callback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  if (message == "PAYMENT_SUCCESS") {
    Serial.println("🎉 ชำระเงินสำเร็จ!");
    
    // 🌟 ตอนจ่ายยา: การ์ดจะเปลี่ยนเป็น "สีเหลืองมธ." ตัวหนังสือ "สีแดงมธ."
    showTU_UI("DISPENSING", 70, "Take your medicine", 52, TU_YELLOW, TU_RED, "Status: Dispensing...");
    
    delay(3000); // จำลองมอเตอร์หมุน 3 วินาที
    
    // 🌟 กลับไปหน้าสแตนด์บาย: การ์ดสีขาว ตัวหนังสือสีแดง
    showTU_UI("READY TO ORDER", 34, "Scan QR to pay", 76, WHITE_BG, TU_RED, "Status: Online & Ready");
  }
}

void reconnect() {
  while (!client.connected()) {
    showTU_UI("OFFLINE", 97, "Check Connection", 64, WHITE_BG, TU_RED, "Status: MQTT Offline");
    
    String clientId = "TU-SmartRx-";
    clientId += String(random(0xffff), HEX);
    
    if (client.connect(clientId.c_str())) {
      client.subscribe(mqtt_topic);
      // เมื่อพร้อมรับคำสั่ง
      showTU_UI("READY TO ORDER", 34, "Scan QR to pay", 76, WHITE_BG, TU_RED, "Status: Online & Ready");
    } else {
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(9600);
  pinMode(TFT_BL, OUTPUT);
  digitalWrite(TFT_BL, HIGH);
  tft.begin();
  tft.setRotation(1); 
  
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