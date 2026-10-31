#!/usr/bin/env bash
# 生成交付包：代码包 + 数据包 + SHA256SUMS + 交付清单。
# 用法：bash 部署/打包.sh [tag] [输出目录]
# 默认 tag=v1.0-deploy，输出到 部署/发布包/（已在 .gitignore 中忽略）
set -eu
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TAG="${1:-v1.0-deploy}"
OUT="${2:-$ROOT/部署/发布包}"
STATE="$ROOT/data/admin-backend/state.json"
UPLOADS="$ROOT/data/admin-backend/uploads"

cd "$ROOT"
git rev-parse -q --verify "refs/tags/$TAG" >/dev/null || { echo "找不到 tag：$TAG"; exit 1; }
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "工作区有未提交的受跟踪改动，先提交再打包："
  git status --short --untracked-files=no
  exit 1
fi
[ -f "$STATE" ] || { echo "缺少 $STATE"; exit 1; }

# 数据快照安全检查：会话必须为 0；1 个管理员
node -e '
const s=require(process.argv[1]);
if(!Array.isArray(s.records)||!Array.isArray(s.users)) throw Error("state.json 结构不对");
if(Object.keys(s.sessions||{}).length!==0) throw Error("state.json 还有登录会话，先清空再打包");
if(s.users.length<1) throw Error("没有管理员账号");
console.log("data snapshot ok: records="+s.records.length+" users="+s.users.length);
' "$STATE"

mkdir -p "$OUT"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/data/admin-backend/uploads"

# 只打被草稿/发布版引用到的上传文件；未引用旧图不放进交付包
USED="$(ADMIN_DATA_DIR="$ROOT/data/admin-backend" MVP_DATA_DIR="$ROOT/data" \
  node -e 'const c=require("./后台服务.cjs");process.stdout.write([...c.usedFileIds()].join("\n"))')"
COUNT=0
while IFS= read -r id; do
  [ -z "$id" ] && continue
  if [ -f "$UPLOADS/$id" ]; then
    cp -p "$UPLOADS/$id" "$STAGE/data/admin-backend/uploads/$id"
    COUNT=$((COUNT+1))
  else
    echo "WARN 引用文件不存在：$id" >&2
  fi
done <<< "$USED"

cp -p "$STATE" "$STAGE/data/admin-backend/state.json"
if [ -f "$ROOT/data/admin-backend/lead-status.json" ]; then
  cp -p "$ROOT/data/admin-backend/lead-status.json" "$STAGE/data/admin-backend/lead-status.json"
fi
if [ -f "$ROOT/data/mvp-leads.json" ]; then
  cp -p "$ROOT/data/mvp-leads.json" "$STAGE/data/mvp-leads.json"
fi

APP="$OUT/evol-app-$TAG.tar.gz"
DATA="$OUT/evol-data-$TAG.tar.gz"
git archive --format=tar.gz --prefix='' -o "$APP" "$TAG"
# 注意：打 data 目录的内容，不要把它自己再套一层；
# 手册 S00 是 tar xzf ... -C data，包里必须是 admin-backend/、mvp-leads.json
tar czf "$DATA" -C "$STAGE/data" .

if tar tzf "$DATA" | grep -q '^data/'; then
  echo "数据包多套了一层 data/，手册会解成 data/data/；打包脚本有误" >&2
  exit 1
fi

( cd "$OUT" && sha256sum "$(basename "$APP")" "$(basename "$DATA")" > SHA256SUMS )

COMMIT="$(git rev-parse --short "$TAG^{}")"
cat > "$OUT/交付清单.txt" <<EOF
EVOL DREAM 交付清单
tag：$TAG
commit：$COMMIT
打包时间：$(date -u +%Y-%m-%dT%H:%M:%SZ)
代码包：$(basename "$APP")
数据包：$(basename "$DATA")
上传文件：$COUNT（仅被草稿/发布版引用；未引用旧图未打包）
校验：SHA256SUMS

数据包含 state.json（管理员密码哈希）、留言和上传文件，只走加密/可信渠道，不要提交 git。
EOF

echo "已生成："
echo "  $APP"
echo "  $DATA"
echo "  $OUT/SHA256SUMS"
echo "  $OUT/交付清单.txt"
echo "上传文件：$COUNT"
echo "下一步：用最终包在干净 Linux 容器/测试机按 S00–S12 再跑一遍。"
