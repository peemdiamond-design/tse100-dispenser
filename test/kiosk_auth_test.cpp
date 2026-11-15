// คอมไพล์: g++ -I test/shim -I . test/kiosk_auth_test.cpp -lcrypto
// อ่านกรณีทดสอบจาก stdin: <expected> <now> <payload>
#include "kiosk_auth.h"
#include <iostream>
#include <string>
int main(int argc, char** argv) {
  const char* secret = argv[1];
  std::string exp; long now; std::string payload; int fails = 0, n = 0;
  while (std::cin >> exp >> now >> payload) {
    KioskCommand c; int r = kioskVerifyCommand(secret, payload.data(), payload.size(), now, &c);
    std::string got = kioskVerifyText(r); for (auto& ch : got) if (ch == ' ') ch = '_';
    bool ok = (got == exp) || (exp == "OK" && r == KV_OK);
    n++; if (!ok) { fails++; std::cout << "FAIL expected=" << exp << " got=" << got << " payload=" << payload << "\n"; }
  }
  std::cout << n - fails << "/" << n << " firmware checks passed\n";
  return fails ? 1 : 0;
}
