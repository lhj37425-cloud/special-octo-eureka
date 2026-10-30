// 部署环境相关的小工具：反向代理后面取真实访客地址、判断是否 HTTPS、识别对外主机名。
// 规则：只有当“直连方是本机回环地址”时才采信转发头（X-Real-IP / X-Forwarded-For / X-Forwarded-Proto）。
// 这样本机 Nginx 反代能正常工作，而服务如果被直接暴露到公网，外部伪造这些头也绕不过限流。
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

const isLoopback = value => LOOPBACK.has(String(value || ''));
// 请求是否经过本机反向代理（Nginx 与本服务同机时成立）
const viaProxy = req => isLoopback(req.socket && req.socket.remoteAddress);

function ip(req) {
  const peer = (req.socket && req.socket.remoteAddress) || 'local';
  if (!viaProxy(req)) return peer;
  // Nginx 用 proxy_set_header X-Real-IP $remote_addr 写入，客户端无法覆盖，优先用它
  const real = String(req.headers['x-real-ip'] || '').trim();
  if (real) return real.slice(0, 64);
  // 兜底：X-Forwarded-For 的最后一段是本机反代追加的真实来源
  const chain = String(req.headers['x-forwarded-for'] || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);
  if (chain.length) return chain[chain.length - 1].slice(0, 64);
  return peer;
}

// 浏览器看到的对外主机名（含端口）。反代如果把 Host 改写成内网地址，用 X-Forwarded-Host 兜回
function host(req) {
  if (viaProxy(req)) {
    const forwarded = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
    if (forwarded) return forwarded;
  }
  return String(req.headers.host || '');
}

// 这次请求是不是 HTTPS（反代终结 TLS 时看 X-Forwarded-Proto）
function secure(req) {
  if (req.socket && req.socket.encrypted) return true;
  if (!viaProxy(req)) return false;
  return String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase() === 'https';
}

module.exports = { ip, host, secure, isLoopback, viaProxy };
