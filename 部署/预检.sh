#!/usr/bin/env bash
# 预检（只读）：部署前在服务器上跑，全部 PASS 才进入 S02。
# 用法：bash 部署/预检.sh [数据目录，默认 /srv/evol/data]
set -u
DATA="${1:-/srv/evol/data}"
PASS=0; FAIL=0
ok(){ echo "PASS  $1"; PASS=$((PASS+1)); }
no(){ echo "FAIL  $1"; FAIL=$((FAIL+1)); }

echo "== 系统 =="
[ -r /etc/os-release ] && ok "OS: $(. /etc/os-release; echo "$PRETTY_NAME")" || no "无法识别 OS"

echo "== 依赖 =="
command -v node   >/dev/null && ok "node $(node -v)"   || no "node 未安装"
node -e 'process.exit(Number(process.versions.node.split(".")[0])>=18?0:1)' 2>/dev/null && ok "node >= 18" || no "node 版本低于 18"
command -v nginx  >/dev/null && ok "nginx $(nginx -v 2>&1 | grep -o '[0-9.]*$')" || no "nginx 未安装"
command -v curl   >/dev/null && ok "curl 可用" || no "curl 未安装"
command -v certbot >/dev/null && ok "certbot 可用" || echo "WARN  certbot 未装（S07 前装即可）"
command -v node   >/dev/null && NODE_BIN="$(command -v node)" || NODE_BIN=""
[ -n "$NODE_BIN" ] && [ -x "$NODE_BIN" ] || no "node 不可执行"
id www-data >/dev/null 2>&1 && ok "用户 www-data 存在" || no "用户 www-data 不存在"

echo "== 资源 =="
FREE=$(df -m /srv 2>/dev/null | awk 'NR==2{print $4}'); FREE=${FREE:-0}
[ "$FREE" -ge 5120 ] && ok "/srv 空闲 ${FREE}MB" || no "/srv 空闲 ${FREE}MB，不足 5GB"
for p in 80 443; do
  if ss -tln 2>/dev/null | grep -q ":$p "; then
    ss -tlnp 2>/dev/null | grep ":$p " | grep -q nginx && ok "端口 $p 由 nginx 占用（正常）" || no "端口 $p 被非 nginx 程序占用"
  else
    ok "端口 $p 空闲"
  fi
done

echo "== 数据完整性（$DATA）=="
STATE="$DATA/admin-backend/state.json"
[ -f "$STATE" ] && ok "state.json 存在" || no "state.json 不存在"
if [ -f "$STATE" ]; then
  READ=$(node -e 'const s=require(process.argv[1]);console.log([s.records.length,s.users.length,Object.keys(s.sessions||{}).length].join(" "))' "$STATE" 2>/dev/null) \
    && ok "state.json 可解析：records users sessions = $READ" || no "state.json 无法解析"
  R=$(echo "$READ" | cut -d' ' -f1); U=$(echo "$READ" | cut -d' ' -f2); S=$(echo "$READ" | cut -d' ' -f3)
  [ "$R" = "28" ] && ok "记录 28 条" || echo "WARN  记录数 $R（事实文件是 28，确认是否故意）"
  [ "$U" -ge 1 ] 2>/dev/null && ok "管理员账号存在" || no "没有管理员账号（initialized 会是 false，危险）"
  [ "$S" = "0" ] && ok "登录会话已清空" || no "state.json 还带着 $S 个会话，找交付人清空"
fi
[ -d "$DATA/admin-backend/uploads" ] && ok "uploads 目录存在（$(find "$DATA/admin-backend/uploads" -type f | wc -l) 个文件）" || no "uploads 目录不存在"
[ -f "$DATA/mvp-leads.json" ] && ok "mvp-leads.json 存在" || echo "WARN  mvp-leads.json 不存在（新站可接受）"

echo "== 权限 =="
[ "$(stat -c '%U' "$DATA" 2>/dev/null)" = "www-data" ] && ok "data 属主 www-data" || echo "WARN  data 属主是 $(stat -c '%U' "$DATA" 2>/dev/null)（S03 会 chown）"
[ "$(stat -c '%a' "$DATA/admin-backend" 2>/dev/null)" = "700" ] && ok "admin-backend 权限 700" || echo "WARN  admin-backend 权限 $(stat -c '%a' "$DATA/admin-backend" 2>/dev/null)（S03 会改 700）"

echo
echo "结果：PASS $PASS 项 / FAIL $FAIL 项"
[ "$FAIL" -eq 0 ] && echo "预检通过，可以进入 S02" || echo "有 FAIL，处理完再继续"
exit "$FAIL"
