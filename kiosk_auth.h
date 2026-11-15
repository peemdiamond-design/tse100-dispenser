// ===================================================================
// TU Smart Rx — ตรวจลายเซ็นคำสั่งจ่ายยาฝั่งตู้ (ESP32)
// รูปแบบ: CMD|ID|TS|SIG   (ดู lib/core.js ฝั่งเซิร์ฟเวอร์)
// ตู้จะรับคำสั่งเฉพาะเมื่อ
//   1) ลายเซ็น HMAC-SHA256 ถูกต้อง (ต้องรู้ DISPENSE_SECRET)
//   2) เวลาในคำสั่งต่างจากนาฬิกาตู้ไม่เกิน KIOSK_CMD_WINDOW วินาที (กันเอาคำสั่งเก่ามาส่งซ้ำ)
//   3) ID ไม่เคยถูกใช้มาก่อน (กัน replay ภายในช่วงเวลา)
// เขียนด้วย C ล้วน ไม่ใช้ Arduino String เพื่อให้ทดสอบบนคอมพิวเตอร์ได้ (test/kiosk_auth_test.cpp)
// ===================================================================
#pragma once
#include <string.h>
#include <stdlib.h>
#include <stdint.h>
#include <stdio.h>
#include "mbedtls/md.h"

#ifndef KIOSK_CMD_WINDOW
#define KIOSK_CMD_WINDOW 90
#endif
#define KIOSK_RECENT_IDS 24
#define KIOSK_ID_MAX 64

enum KioskVerify {
  KV_OK = 0, KV_FORMAT, KV_CMD, KV_ID, KV_TS, KV_CLOCK, KV_EXPIRED, KV_SIGNATURE, KV_REPLAY
};

struct KioskCommand {
  char cmd[12];
  char id[KIOSK_ID_MAX + 1];
  long ts;
};

static char kiosk_recent[KIOSK_RECENT_IDS][KIOSK_ID_MAX + 1];
static int kiosk_recent_next = 0;

static inline const char* kioskVerifyText(int r) {
  static const char* t[] = {"OK", "BAD FORMAT", "BAD CMD", "BAD ID", "BAD TIME", "CLOCK NOT SYNCED", "EXPIRED", "BAD SIGNATURE", "REPLAY"};
  return (r >= 0 && r <= KV_REPLAY) ? t[r] : "?";
}

static inline void kioskHmacHex(const char* secret, const char* msg, size_t len, char out[65]) {
  unsigned char mac[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), 1);
  mbedtls_md_hmac_starts(&ctx, (const unsigned char*)secret, strlen(secret));
  mbedtls_md_hmac_update(&ctx, (const unsigned char*)msg, len);
  mbedtls_md_hmac_finish(&ctx, mac);
  mbedtls_md_free(&ctx);
  for (int i = 0; i < 32; i++) snprintf(out + 2 * i, 3, "%02x", mac[i]);
  out[64] = 0;
}

static inline bool kioskConstEq(const char* a, const char* b, size_t n) {
  uint8_t r = 0;
  for (size_t i = 0; i < n; i++) r |= (uint8_t)(a[i] ^ b[i]);
  return r == 0;
}

static inline bool kioskSeen(const char* id) {
  for (int i = 0; i < KIOSK_RECENT_IDS; i++) if (strcmp(kiosk_recent[i], id) == 0) return true;
  return false;
}

// payload ไม่จำเป็นต้องจบด้วย '\0' (มาจาก MQTT) — ใช้ len
static inline int kioskVerifyCommand(const char* secret, const char* payload, size_t len, long now, KioskCommand* out) {
  if (len < 10 || len > 200) return KV_FORMAT;
  char buf[201];
  memcpy(buf, payload, len); buf[len] = 0;

  // แยก 4 ส่วนด้วย '|'
  char* parts[4]; int n = 0; char* p = buf; parts[n++] = p;
  while (*p) { if (*p == '|') { *p = 0; if (n == 4) return KV_FORMAT; parts[n++] = p + 1; } p++; }
  if (n != 4) return KV_FORMAT;
  const char *cmd = parts[0], *id = parts[1], *tsStr = parts[2], *sig = parts[3];

  if (strcmp(cmd, "DISPENSE") != 0 && strcmp(cmd, "PENDING") != 0) return KV_CMD;
  size_t idLen = strlen(id);
  if (idLen < 1 || idLen > KIOSK_ID_MAX) return KV_ID;
  for (size_t i = 0; i < idLen; i++) {
    char c = id[i];
    if (!((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_' || c == '-')) return KV_ID;
  }
  size_t tsLen = strlen(tsStr);
  if (tsLen < 1 || tsLen > 12) return KV_TS;
  for (size_t i = 0; i < tsLen; i++) if (tsStr[i] < '0' || tsStr[i] > '9') return KV_TS;
  long ts = atol(tsStr);

  if (now < 1700000000L) return KV_CLOCK;                       // ยังไม่ได้ซิงก์เวลา NTP
  if (labs(now - ts) > KIOSK_CMD_WINDOW) return KV_EXPIRED;

  // ลายเซ็นคำนวณจาก "CMD|ID|TS" (ส่วนต้นของ payload เดิม)
  size_t signedLen = strlen(cmd) + 1 + idLen + 1 + tsLen;
  char expect[65];
  kioskHmacHex(secret, payload, signedLen, expect);
  if (strlen(sig) != 64 || !kioskConstEq(sig, expect, 64)) return KV_SIGNATURE;

  if (kioskSeen(id)) return KV_REPLAY;
  strncpy(kiosk_recent[kiosk_recent_next], id, KIOSK_ID_MAX);
  kiosk_recent[kiosk_recent_next][KIOSK_ID_MAX] = 0;
  kiosk_recent_next = (kiosk_recent_next + 1) % KIOSK_RECENT_IDS;

  if (out) {
    strncpy(out->cmd, cmd, sizeof(out->cmd) - 1); out->cmd[sizeof(out->cmd) - 1] = 0;
    strncpy(out->id, id, KIOSK_ID_MAX); out->id[KIOSK_ID_MAX] = 0;
    out->ts = ts;
  }
  return KV_OK;
}
