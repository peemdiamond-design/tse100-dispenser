// shim: แทน mbedtls ด้วย OpenSSL เพื่อทดสอบ kiosk_auth.h บนคอมพิวเตอร์
#pragma once
#include <openssl/hmac.h>
#include <string.h>
typedef int mbedtls_md_type_t; typedef int mbedtls_md_info_t;
#define MBEDTLS_MD_SHA256 6
typedef struct { unsigned char key[256]; size_t klen; unsigned char data[512]; size_t dlen; } mbedtls_md_context_t;
static inline const mbedtls_md_info_t* mbedtls_md_info_from_type(int t){ static int i; return &i; }
static inline void mbedtls_md_init(mbedtls_md_context_t* c){ memset(c,0,sizeof(*c)); }
static inline int mbedtls_md_setup(mbedtls_md_context_t*, const mbedtls_md_info_t*, int){ return 0; }
static inline int mbedtls_md_hmac_starts(mbedtls_md_context_t* c, const unsigned char* k, size_t n){ memcpy(c->key,k,n); c->klen=n; return 0; }
static inline int mbedtls_md_hmac_update(mbedtls_md_context_t* c, const unsigned char* d, size_t n){ memcpy(c->data+c->dlen,d,n); c->dlen+=n; return 0; }
static inline int mbedtls_md_hmac_finish(mbedtls_md_context_t* c, unsigned char* out){ unsigned int l=32; HMAC(EVP_sha256(), c->key, (int)c->klen, c->data, c->dlen, out, &l); return 0; }
static inline void mbedtls_md_free(mbedtls_md_context_t*){}
