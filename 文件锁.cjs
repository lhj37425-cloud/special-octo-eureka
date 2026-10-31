// 跨进程文件锁：前台提交留言和后台删除留言会同时写 mvp-leads.json，
// Node 单进程内的同步写不能阻止另一个进程读到旧内容再写回，所以用 lock 文件串行化。
// 这是同步锁，适合只做几毫秒的“读-改-写”；等待超过 timeoutMs 直接报错，不无限阻塞。
const fs = require('fs'), path = require('path');
const sleepSync = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function withLock(lockFile, fn, { timeoutMs = 5000, staleMs = 15000 } = {}) {
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  const started = Date.now();
  while (true) {
    try {
      const fd = fs.openSync(lockFile, 'wx');
      try { fs.writeSync(fd, String(process.pid)); } finally { fs.closeSync(fd); }
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        const stat = fs.statSync(lockFile);
        if (Date.now() - stat.mtimeMs > staleMs) fs.rmSync(lockFile, { force: true });
      } catch { /* 锁文件刚好被释放 */ }
      if (Date.now() - started > timeoutMs) {
        throw Object.assign(Error('数据正在被另一个操作占用，请稍后重试。'), { status: 503 });
      }
      sleepSync(25);
    }
  }
  try {
    return fn();
  } finally {
    try { fs.rmSync(lockFile, { force: true }); } catch { /* 忽略清理失败 */ }
  }
}

module.exports = { withLock };
