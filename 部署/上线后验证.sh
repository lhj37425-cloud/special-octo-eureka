#!/usr/bin/env bash
# 上线后验证（只读）：S10 用。遍历 sitemap 全部 URL + 关键列表页、响应头与安全检查。
# 用法：bash 部署/上线后验证.sh [站点地址，默认 https://www.evoldream.tech]
set -u
BASE="${1:-https://www.evoldream.tech}"
BASE="${BASE%/}"
PASS=0; FAIL=0
ok(){ echo "PASS  $1"; PASS=$((PASS+1)); }
no(){ echo "FAIL  $1"; FAIL=$((FAIL+1)); }
code(){ curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$1" 2>/dev/null; }

echo "== 入口 =="
C=$(code "$BASE/")
{ [ "$C" = "301" ] || [ "$C" = "302" ]; } && ok "/ 返回 $C（跳默认语言）" || no "/ 返回 $C，期望 301/302"
L=$(curl -sSI --max-time 15 "$BASE/" 2>/dev/null | awk 'tolower($1)=="location:"{print $2}' | tr -d '\r')
echo "$L" | grep -q '/vi/' && ok "/ 跳到 $L" || no "/ 的 Location 是 $L，期望含 /vi/"

echo "== 主要列表页 =="
for l in zh vi en; do
  for p in courses/ teachers/ cases/ about/ contact/; do
    C=$(code "$BASE/$l/$p")
    [ "$C" = "200" ] && ok "/$l/$p 200" || no "/$l/$p 返回 $C"
  done
done

echo "== sitemap 全量 URL =="
SM=$(curl -sS --max-time 20 "$BASE/sitemap.xml" 2>/dev/null)
echo "$SM" | head -1 | grep -q '<?xml' && ok "sitemap.xml 可访问" || no "sitemap.xml 不可访问"
for l in zh vi en; do
  for p in courses/ teachers/; do
    echo "$SM" | grep -q "<loc>$BASE/$l/$p</loc>" && ok "sitemap 包含 /$l/$p" || no "sitemap 缺 /$l/$p"
  done
done
TOTAL=0; BAD=0
for u in $(echo "$SM" | grep -o '<loc>[^<]*</loc>' | sed 's/<[^>]*>//g'); do
  TOTAL=$((TOTAL+1))
  C=$(code "$u")
  if [ "$C" != "200" ]; then BAD=$((BAD+1)); echo "  FAIL  $u → $C"; fi
done
[ "$TOTAL" -ge 80 ] && ok "sitemap 共 $TOTAL 个 URL" || echo "WARN  sitemap 只有 $TOTAL 个 URL（正式数据应 80+）"
[ "$BAD" -eq 0 ] && ok "全部 URL 返回 200" || no "$BAD 个 URL 非 200"

echo "== robots 与后台 =="
curl -sS --max-time 15 "$BASE/robots.txt" 2>/dev/null | grep -q 'Disallow: /admin/' && ok "robots.txt 禁止 /admin/" || no "robots.txt 缺 /admin/ 规则"
curl -sS --max-time 15 "$BASE/robots.txt" 2>/dev/null | grep -q 'Sitemap: https://www.evoldream.tech/sitemap.xml' && ok "robots.txt 指向 sitemap" || no "robots.txt 缺 Sitemap"
C=$(code "$BASE/admin/"); [ "$C" = "200" ] && ok "/admin/ 返回 200" || no "/admin/ 返回 $C"
curl -sSI --max-time 15 "$BASE/admin/" 2>/dev/null | grep -qi 'x-robots-tag:.*noindex' && ok "/admin/ 带 X-Robots-Tag noindex" || no "/admin/ 缺 X-Robots-Tag"
for f in demo.css demo.js store.js media.js editor.js; do
  C=$(code "$BASE/$f"); [ "$C" = "200" ] && ok "/$f 200" || no "/$f 返回 $C（后台页面会坏）"
done

echo "== 404 =="
C=$(code "$BASE/zh/__not_found_check__")
[ "$C" = "404" ] && ok "未知页面返回 404" || no "未知页面返回 $C，期望 404"

echo "== HTTP/域名跳转 =="
HOST="${BASE#https://}"; APEX=""
if [ "${HOST#www.}" != "$HOST" ]; then APEX="https://${HOST#www.}"; fi
C=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "http://$HOST/" 2>/dev/null)
{ [ "$C" = "301" ] || [ "$C" = "302" ] || [ "$C" = "308" ]; } && ok "http://$HOST 跳 HTTPS（$C）" || no "http://$HOST 返回 $C，期望 301/302/308"
if [ -n "$APEX" ]; then
  C=$(code "$APEX/")
  if { [ "$C" = "301" ] || [ "$C" = "302" ] || [ "$C" = "308" ]; } && curl -sSI --max-time 15 "$APEX/" 2>/dev/null | grep -qi "location:.*$BASE"; then
    ok "apex $APEX 跳到 $BASE"
  else
    no "apex $APEX 返回 $C 或 Location 不含 $BASE"
  fi
fi

echo "== 响应头 =="
H=$(curl -sSI --max-time 15 "$BASE/zh/" 2>/dev/null)
echo "$H" | grep -qi 'strict-transport-security' && ok "HSTS 存在" || no "缺 HSTS"
echo "$H" | grep -qi 'x-frame-options' && ok "X-Frame-Options 存在" || no "缺 X-Frame-Options"
echo "$H" | grep -qi 'x-content-type-options:.*nosniff' && ok "X-Content-Type-Options nosniff 存在" || no "缺 X-Content-Type-Options"
H2=$(curl -sSI --max-time 15 "$BASE/favicon.svg" 2>/dev/null)
echo "$H2" | grep -qi 'strict-transport-security' && ok "静态资源仍带 HSTS（add_header 重写生效）" || no "静态资源缺 HSTS（location 里 add_header 覆盖了继承）"

echo "== 接口安全 =="
C=$(code "$BASE/api/leads"); [ "$C" = "401" ] && ok "/api/leads 未登录 401" || no "/api/leads 返回 $C，期望 401"
C=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 -X POST "$BASE/api/login" -H 'Content-Type: application/json' -d '{"account":"__no_such_user__","password":"wrong-password-123"}' 2>/dev/null)
[ "$C" = "401" ] && ok "错误登录 401" || no "错误登录返回 $C，期望 401"
C=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$BASE/api/status" 2>/dev/null); [ "$C" = "200" ] || no "/api/status 返回 $C"
curl -sS --max-time 15 "$BASE/api/status" 2>/dev/null | grep -q '"initialized":true' && ok "initialized:true" || no "initialized 不是 true"
C=$(code "$BASE/healthz"); [ "$C" = "200" ] && ok "前台 /healthz 200" || no "前台 /healthz 返回 $C"
C=$(code "$BASE/admin/healthz"); [ "$C" = "200" ] && ok "后台 /admin/healthz 200" || no "后台 /admin/healthz 返回 $C"

echo
echo "结果：PASS $PASS 项 / FAIL $FAIL 项"
[ "$FAIL" -eq 0 ] && echo "全部通过" || echo "有 FAIL，按手册「八、排查表」处理"
exit "$FAIL"
