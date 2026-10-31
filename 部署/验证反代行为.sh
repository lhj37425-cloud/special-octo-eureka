#!/bin/bash
# 用一个临时实例模拟 Nginx 反代，验证 P0 修复：真实 IP 限流、Origin 校验、Secure Cookie
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
FRONT_PORT=4193
ADMIN_PORT=4194

cleanup(){ kill $FPID $APID 2>/dev/null; wait 2>/dev/null; }
trap cleanup EXIT

cd "$ROOT"
mkdir -p "$TMP/data" "$TMP/admin"
PORT=$FRONT_PORT MVP_DATA_DIR="$TMP/data" ADMIN_DATA_DIR="$TMP/admin" ADMIN_BASE_PATH=/admin/ node server.js >"$TMP/front.log" 2>&1 &
FPID=$!
ADMIN_PORT=$ADMIN_PORT MVP_DATA_DIR="$TMP/data" ADMIN_DATA_DIR="$TMP/admin" node backend-server.js >"$TMP/admin.log" 2>&1 &
APID=$!

for i in $(seq 1 50); do
  curl -s -o /dev/null "http://127.0.0.1:$FRONT_PORT/vi/" && curl -s -o /dev/null "http://127.0.0.1:$ADMIN_PORT/" && break
  sleep 0.2
done

echo "=== 1. 后台首次初始化（模拟 HTTPS 反代）==="
SETUP=$(curl -s -D - -o /dev/null -X POST "http://127.0.0.1:$ADMIN_PORT/api/setup" \
  -H 'Content-Type: application/json' -H 'X-Forwarded-Proto: https' -H 'X-Real-IP: 1.1.1.1' \
  -d '{"account":"tester","name":"测试","password":"test-password-123"}')
echo "$SETUP" | grep -i '^set-cookie' | sed 's/^/  /'

echo "=== 2. 同一请求走 HTTP（本地调试）不该带 Secure ==="
curl -s -D - -o /dev/null -X POST "http://127.0.0.1:$ADMIN_PORT/api/login" \
  -H 'Content-Type: application/json' -d '{"account":"tester","password":"test-password-123"}' \
  | grep -i '^set-cookie' | sed 's/^/  /'

echo "=== 3. 登录锁定按 IP 隔离：A 连错 5 次后，B 不应被 429 ==="
for i in 1 2 3 4 5; do
  curl -s -o /dev/null -w "  A 第 $i 次: %{http_code}\n" -X POST "http://127.0.0.1:$ADMIN_PORT/api/login" \
    -H 'Content-Type: application/json' -H 'X-Real-IP: 2.2.2.2' -d '{"account":"tester","password":"wrong-password"}'
done
curl -s -o /dev/null -w "  A 第 6 次: %{http_code}（期望 429 已锁定）\n" -X POST "http://127.0.0.1:$ADMIN_PORT/api/login" \
  -H 'Content-Type: application/json' -H 'X-Real-IP: 2.2.2.2' -d '{"account":"tester","password":"test-password-123"}'
curl -s -o /dev/null -w "  B 首次: %{http_code}（期望 200，不受 A 影响）\n" -X POST "http://127.0.0.1:$ADMIN_PORT/api/login" \
  -H 'Content-Type: application/json' -H 'X-Real-IP: 3.3.3.3' -d '{"account":"tester","password":"test-password-123"}'

echo "=== 4. 前台跨站提交应被拒 ==="
curl -s -o /dev/null -w "  恶意 Origin: %{http_code}（期望 403）\n" -X POST "http://127.0.0.1:$FRONT_PORT/api/leads" \
  -H 'Content-Type: application/json' -H 'Origin: https://evil.example.com' \
  -d '{"name":"x","company":"y","contact":"a@b.com","service":"training","consent":true}'

echo "=== 5. 反代后 Host 被改写，用 X-Forwarded-Host 兜回 ==="
curl -s -o /dev/null -w "  正式域名 Origin: %{http_code}（期望 400，通过来源校验但内容不全）\n" -X POST "http://127.0.0.1:$FRONT_PORT/api/leads" \
  -H 'Content-Type: application/json' -H 'Origin: https://www.evoldream.tech' -H 'X-Forwarded-Host: www.evoldream.tech' \
  -d '{"name":"x"}'

echo "=== 6. 留言限流按 IP 隔离：A 提交 6 条，B 仍可提交 ==="
for i in $(seq 1 6); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:$FRONT_PORT/api/leads" \
    -H 'Content-Type: application/json' -H 'X-Real-IP: 9.9.9.9' \
    -d "{\"name\":\"访客$i\",\"company\":\"公司\",\"contact\":\"a$i@b.com\",\"service\":\"training\",\"consent\":true,\"requestId\":\"req-$i\"}")
  echo "  A 第 $i 条: $code"
done
curl -s -o /dev/null -w "  B 第 1 条: %{http_code}（期望 201，不被 A 拖累）\n" -X POST "http://127.0.0.1:$FRONT_PORT/api/leads" \
  -H 'Content-Type: application/json' -H 'X-Real-IP: 8.8.8.8' \
  -d '{"name":"另一个访客","company":"公司","contact":"c@d.com","service":"training","consent":true,"requestId":"req-b1"}'

echo "=== 7. 预览条“返回编辑”指向 /admin/（ADMIN_BASE_PATH）==="
COOKIE=$(curl -s -D - -o /dev/null -X POST "http://127.0.0.1:$ADMIN_PORT/api/login" \
  -H 'Content-Type: application/json' -d '{"account":"tester","password":"test-password-123"}' \
  | grep -i '^set-cookie: admin_session' | sed -E 's/^[Ss]et-[Cc]ookie: ([^;]+);.*/\1/')
curl -s "http://127.0.0.1:$FRONT_PORT/preview/zh/" -H "Cookie: $COOKIE" \
  | grep -o 'href="[^"]*">返回编辑' | sed 's/^/  /'
