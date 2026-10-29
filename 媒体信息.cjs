// 上传文件的真实类型、大小上限和元信息（宽、高、时长）识别（方案 M3–M6、M8–M9）。
// 后台服务与验收测试共用；浏览器端 admin-demo/media.js 使用同样的上限。
const path = require('path');

const MB = 1024 * 1024;
// 方案 D10：单个视频不超过 50MB；图片原图 20MB；附件 30MB
const LIMITS = { image: 20 * MB, video: 50 * MB, attachment: 30 * MB };
const KIND_LABEL = { image: '图片', video: '视频', attachment: '附件' };
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
const VIDEO_EXTS = ['.mp4'];
const ATTACHMENT_EXTS = ['.pdf', '.docx', '.xlsx', '.pptx'];
const HEIC_EXTS = ['.heic', '.heif'];
const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

const extOf = name => path.extname(String(name || '')).toLowerCase();

function kindOfExt(ext) {
  const e = String(ext || '').toLowerCase();
  if (IMAGE_EXTS.includes(e)) return 'image';
  if (VIDEO_EXTS.includes(e)) return 'video';
  if (ATTACHMENT_EXTS.includes(e)) return 'attachment';
  return null;
}

const heicError = () => Error('HEIC 照片（苹果手机格式）浏览器无法处理，请先在手机上转成 JPG 再上传。');

// —— 图片尺寸（只读文件头，不依赖浏览器） ——
function jpegSize(buf) {
  let i = 2;
  while (i + 9 <= buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    if (i + 4 > buf.length) break;
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      if (i + 9 > buf.length) break;
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    if (len < 2) break;
    i += 2 + len;
  }
  return null;
}
function pngSize(buf) {
  if (buf.length < 24 || buf.toString('latin1', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}
function webpSize(buf) {
  if (buf.length < 30) return null;
  const chunk = buf.toString('latin1', 12, 16);
  if (chunk === 'VP8 ') {
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    if (buf[20] !== 0x2f) return null;
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') {
    return { width: (buf.readUIntLE(24, 3) & 0xffffff) + 1, height: (buf.readUIntLE(27, 3) & 0xffffff) + 1 };
  }
  return null;
}
function imageSize(ext, buf) {
  if (ext === '.png') return pngSize(buf);
  if (ext === '.webp') return webpSize(buf);
  return jpegSize(buf);
}
function imageMagicOk(ext, buf) {
  if (ext === '.png') return buf.length >= 8 && buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a;
  if (ext === '.webp') return buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP';
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

// —— MP4（M6：只收 H.264 + AAC；改了后缀名的非视频文件拒收） ——
function boxes(buf, start, end) {
  const list = [];
  let i = start;
  while (i + 8 <= end) {
    let size = buf.readUInt32BE(i);
    const type = buf.toString('latin1', i + 4, i + 8);
    let header = 8;
    if (size === 1) {
      if (i + 16 > end) break;
      size = Number(buf.readBigUInt64BE(i + 8));
      header = 16;
    } else if (size === 0) {
      size = end - i;
    }
    if (size < header || i + size > end) { list.push({ type, start: i + header, end }); break; }
    list.push({ type, start: i + header, end: i + size });
    i += size;
  }
  return list;
}
const findBox = (buf, start, end, type) => boxes(buf, start, end).find(b => b.type === type);
function mp4Duration(buf, moov) {
  const mvhd = findBox(buf, moov.start, moov.end, 'mvhd');
  if (!mvhd) return 0;
  const v = buf[mvhd.start];
  const timescale = v === 1 ? buf.readUInt32BE(mvhd.start + 20) : buf.readUInt32BE(mvhd.start + 12);
  const duration = v === 1 ? Number(buf.readBigUInt64BE(mvhd.start + 24)) : buf.readUInt32BE(mvhd.start + 16);
  return timescale > 0 ? duration / timescale : 0;
}
function mp4Tracks(buf, moov) {
  return boxes(buf, moov.start, moov.end).filter(b => b.type === 'trak').map(trak => {
    const mdia = findBox(buf, trak.start, trak.end, 'mdia');
    if (!mdia) return null;
    const hdlr = findBox(buf, mdia.start, mdia.end, 'hdlr');
    const handler = hdlr && hdlr.start + 12 <= hdlr.end ? buf.toString('latin1', hdlr.start + 8, hdlr.start + 12) : '';
    const minf = findBox(buf, mdia.start, mdia.end, 'minf');
    const stbl = minf && findBox(buf, minf.start, minf.end, 'stbl');
    const stsd = stbl && findBox(buf, stbl.start, stbl.end, 'stsd');
    const format = stsd && stsd.start + 16 <= stsd.end ? buf.toString('latin1', stsd.start + 12, stsd.start + 16) : '';
    const tkhd = findBox(buf, trak.start, trak.end, 'tkhd');
    let width = 0, height = 0;
    if (tkhd) {
      const o = buf[tkhd.start] === 1 ? 88 : 76;
      if (tkhd.start + o + 8 <= tkhd.end) {
        width = Math.round(buf.readUInt32BE(tkhd.start + o) / 65536);
        height = Math.round(buf.readUInt32BE(tkhd.start + o + 4) / 65536);
      }
    }
    return { handler, format, width, height };
  }).filter(Boolean);
}

// 识别上传文件：返回 {kind, ext, mime, width, height, duration}；不合格直接抛错（带用户能看懂的原因）
function inspect(name, bytes) {
  const ext = extOf(name);
  if (HEIC_EXTS.includes(ext)) throw heicError();
  const kind = kindOfExt(ext);
  if (!kind) throw Error('不支持的文件类型。图片用 JPG、PNG、WebP，视频用 MP4，附件用 PDF、DOCX、XLSX、PPTX。');
  if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(bytes || []);
  if (bytes.length > LIMITS[kind]) throw Error(`文件不能超过 ${LIMITS[kind] / MB}MB。`);
  if (!bytes.length) throw Error('文件是空的，请重新选择。');
  const mime = MIME[ext] || 'application/octet-stream';

  if (kind === 'image') {
    // 苹果手机照片改了扩展名也认出来（M5）
    if (bytes.length >= 12 && bytes.toString('latin1', 4, 8) === 'ftyp' && /^(heic|heix|hevc|hevx|mif1|msf1)$/.test(bytes.toString('latin1', 8, 12))) throw heicError();
    if (!imageMagicOk(ext, bytes)) throw Error('这个文件不是有效的图片，请重新选择 JPG、PNG 或 WebP。');
    const size = imageSize(ext, bytes) || { width: 0, height: 0 };
    return { kind, ext, mime, width: size.width || 0, height: size.height || 0, duration: 0 };
  }

  if (kind === 'video') {
    if (bytes.length < 12 || bytes.toString('latin1', 4, 8) !== 'ftyp') throw Error('这不是有效的 MP4 视频文件。请用剪映导出 MP4（H.264 + AAC）后再上传。');
    if (/^(heic|heix|hevc|hevx|mif1|msf1)$/.test(bytes.toString('latin1', 8, 12))) throw heicError();
    const top = boxes(bytes, 0, bytes.length);
    const moov = top.find(b => b.type === 'moov');
    if (!moov) throw Error('这不是完整的 MP4 视频文件。请用剪映导出 MP4（H.264 + AAC）后再上传。');
    const tracks = mp4Tracks(bytes, moov);
    const video = tracks.find(t => t.handler === 'vide');
    const audio = tracks.find(t => t.handler === 'soun');
    if (!video) throw Error('这个文件里没有视频画面。请选择 MP4 视频文件。');
    if (!['avc1', 'avc3'].includes(video.format)) throw Error('这个视频的编码浏览器可能放不了，请用剪映导出 MP4（H.264 + AAC）后再上传。');
    if (audio && !['mp4a'].includes(audio.format)) throw Error('这个视频的声音编码浏览器可能放不了，请用剪映导出 MP4（H.264 + AAC）后再上传。');
    return { kind, ext, mime, width: video.width, height: video.height, duration: Math.round(mp4Duration(bytes, moov) * 100) / 100 };
  }

  const head = bytes.subarray(0, 1024);
  if (ext === '.pdf') {
    if (head.indexOf('%PDF-') < 0) throw Error('这个文件不是有效的 PDF。');
  } else if (!(bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04)) {
    throw Error('这个文件不是有效的 Office 文档（DOCX / XLSX / PPTX）。');
  }
  return { kind, ext, mime, width: 0, height: 0, duration: 0 };
}

module.exports = { LIMITS, KIND_LABEL, MIME, IMAGE_EXTS, VIDEO_EXTS, ATTACHMENT_EXTS, HEIC_EXTS, MB, extOf, kindOfExt, inspect, imageSize, mp4Duration, mp4Tracks };
