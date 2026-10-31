#!/usr/bin/env bash
# 预检（只读）：部署前在服务器上跑，全部 PASS 才进入 S04。
# 必须用 sudo 运行：S03 会把 data/admin-backend 设为 700/www-data，普通用户读不到 state.json。
# 用法：sudo bash 部署/预检.sh [数据目录，默认 /srv/evol/data]
set -u
DATA="${1:-/srv/evol/data}"
PASS=0; FAIL=0; WARN=0
ok(){ echo "PASS  $1"; PASS=$((PASS+1)); }
no(){ echo "FAIL  $1"; FAIL=$((FAIL+1)); }
warn(){ echo "WARN  $1"; WARN=$((WARN+1)); }

echo "== 运行身份 =="
if [ "$(id -u)" -eq 0 ]; then ok "root 运行"; else warn "非 root：如果读不到 data 会自动 FAIL，请改用 sudo"; fi

echo "== 系统 =="
[ -r /etc/os-release ] && ok "OS: $(. /etc/os-release; echo "$PRETTY_NAME")" || no "无法识别 OS"

echo "== 依赖 =="
command -v node   >/dev/null && ok "node $(node -v)"   || no "node 未安装"
node -e 'process.exit(Number(process.versions.node.split(".")[0])>=18?0:1)' 2>/dev/null && ok "node >= 18" || no "node 版本低于 18"
command -v nginx  >/dev/null && ok "nginx $(nginx -v 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)" || no "nginx 未安装"
command -v curl   >/dev/null && ok "curl 可用" || no "curl 未安装"
command -v certbot >/dev/null && ok "certbot 可用" || warn "certbot 未装（S07 前装即可）"
command -v node   >/dev/null && NODE_BIN="$(command -v node)" || NODE_BIN=""
[ -n "$NODE_BIN" ] && [ -x "$NODE_BIN" ] || no "node 不可执行"
id www-data >/dev/null 2>&1 && ok "用户 www-data 存在" || no "用户 www-data 不存在"

echo "== 资源 =="
FREE=$(df -m /srv 2>/dev/null | awk 'NR==2{print $4}'); FREE=${FREE:-0}
[ "$FREE" -ge 10240 ] && ok "/srv 空闲 ${FREE}MB（≥10GB）" || no "/srv 空闲 ${FREE}MB，不足 10GB（数据+14 天备份需要余量）"
for p in 80 443; do
  if ss -tln 2>/dev/null | grep -q ":$p "; then
    ss -tlnp 2>/dev/null | grep ":$p " | grep -q nginx && ok "端口 $p 由 nginx 占用（正常）" || no "端口 $p 被非 nginx 程序占用"
  else
    ok "端口 $p 空闲"
  fi
done
for p in 4173 4181; do
  if ss -tln 2>/dev/null | grep -q ":$p "; then
    no "端口 $p 已被占用（服务可能已在运行；首次部署应先停掉旧实例）"
  else
    ok "端口 $p 空闲"
  fi
done

echo "== 数据完整性（$DATA）=="
STATE="$DATA/admin-backend/state.json"
if [ ! -f "$STATE" ]; then
  no "state.json 不存在"
elif [ ! -r "$STATE" ]; then
  no "state.json 存在但当前用户不可读（请用 sudo 或 www-data 运行）"
else
  ok "state.json 存在"
  READ=$(node -e 'const s=require(process.argv[1]);console.log([s.records.length,s.users.length,Object.keys(s.sessions||{}).length].join(" "))' "$STATE" 2>/dev/null)
  if [ -z "$READ" ]; then
    no "state.json 无法解析"
  else
    ok "state.json 可解析：records users sessions = $READ"
    R=$(echo "$READ" | cut -d' ' -f1); U=$(echo "$READ" | cut -d' ' -f2); S=$(echo "$READ" | cut -d' ' -f3)
    [ "$R" = "28" ] && ok "记录 28 条" || warn "记录数 $R（事实文件是 28，确认是否故意）"
    if [ -n "$U" ] && [ "$U" -ge 1 ] 2>/dev/null; then ok "管理员账号存在"; else no "没有管理员账号（initialized 会是 false，危险）"; fi
    [ "$S" = "0" ] && ok "登录会话已清空" || no "state.json 还带着 $S 个会话，找交付人清空"
    TYPES=$(node -e 'const s=require(process.argv[1]);const c={};for(const r of s.records)c[r.type]=(c[r.type]||0)+1;console.log([c.experts||0,c.courses||0,c.cases||0,c.qualifications||0].join(" "))' "$STATE" 2>/dev/null)
    [ "$TYPES" = "13 2 6 7" ] && ok "类型 专家 13 / 课程 2 / 案例 6 / 资质 7" || warn "类型统计是 $TYPES（事实文件是 13 2 6 7，确认是否故意）"
  fi
fi

if [ -d "$DATA/admin-backend/uploads" ]; then
  COUNT=$(find "$DATA/admin-backend/uploads" -type f 2>/dev/null | wc -l)
  if [ "$COUNT" = "67" ]; then
    ok "uploads 目录存在（$COUNT 个被引用文件，与交付数据包一致）"
  elif [ "$COUNT" = "78" ]; then
    ok "uploads 目录有 78 个文件（原始目录；其中 11 个未引用旧图会在后台首次启动后清理）"
  else
    warn "uploads 目录有 $COUNT 个文件（交付包应为 67；原始目录 78）"
  fi
else
  no "uploads 目录不存在"
fi
if [ -f "$DATA/mvp-leads.json" ]; then
  node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$DATA/mvp-leads.json" 2>/dev/null && ok "mvp-leads.json 是合法 JSON" || no "mvp-leads.json 不是合法 JSON"
else
  warn "mvp-leads.json 不存在（新站可接受）"
fi

echo "== 权限 =="
[ "$(stat -c '%U' "$DATA" 2>/dev/null)" = "www-data" ] && ok "data 属主 www-data" || warn "data 属主是 $(stat -c '%U' "$DATA" 2>/dev/null)（S03 会 chown）"
[ "$(stat -c '%a' "$DATA/admin-backend" 2>/dev/null)" = "700" ] && ok "admin-backend 权限 700" || warn "admin-backend 权限 $(stat -c '%a' "$DATA/admin-backend" 2>/dev/null)（S03 会改 700）"

echo "== 部署事实 =="
FACT="/srv/evol/部署/部署事实.json"
if [ -f "$FACT" ]; then
  TAG=$(node -e 'const f=require(process.argv[1]);console.log(f.release?.tag||"")' "$FACT" 2>/dev/null)
  [ -n "$TAG" ] && ok "部署事实可解析：tag=$TAG" || no "部署事实无法解析或缺 release.tag"
else
  no "缺少 /srv/evol/部署/部署事实.json"
fi

echo
echo "结果：PASS $PASS 项 / WARN $WARN 项 / FAIL $FAIL 项"
[ "$FAIL" -eq 0 ] && echo "预检通过，可以进入 S04" || echo "有 FAIL，处理完再继续"
exit "$FAIL"
