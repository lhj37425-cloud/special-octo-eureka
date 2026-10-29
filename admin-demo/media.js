// 后台媒体处理（方案 M2–M9）：图片裁剪压缩、视频信息与首帧、流式上传进度。
// 上限与后台服务 媒体信息.cjs 一致；这里只做浏览器端处理，真正校验仍以服务端为准。
export const MEDIA_RULES = {
  image: { exts: ['jpg', 'jpeg', 'png', 'webp'], max: 20 * 1024 * 1024, label: '图片' },
  video: { exts: ['mp4'], max: 50 * 1024 * 1024, label: '视频' },
  attachment: { exts: ['pdf', 'docx', 'xlsx', 'pptx'], max: 30 * 1024 * 1024, label: '附件' },
};
const HEIC_EXTS = ['heic', 'heif'];
const HINT_MP4 = '请用剪映导出 MP4（H.264 + AAC）后再上传。';

// M2/M3：每类图片的裁剪比例和保存尺寸
export const IMAGE_PRESETS = {
  expert: { label: '专家照片', aspect: 1, shape: 'circle', out: [1000, 1000], min: [800, 800] },
  course: { label: '课程封面', aspect: 16 / 9, shape: 'rect', out: [1600, 900], min: [1600, 900] },
  case: { label: '案例图片', aspect: 16 / 10, shape: 'rect', out: [1600, 1000], min: [1600, 1000] },
  clip: { label: '视频封面', aspect: 16 / 9, shape: 'rect', out: [1600, 900], min: [0, 0] },
  qualification: { label: '资质图片', aspect: null, shape: 'rect', out: [2400, 2400], min: [0, 0], contain: true },
};

const extOf = name => String(name || '').split('.').pop().toLowerCase();
const mb = n => Math.round(n / 1048576);

// 选文件时立刻检查（M9）：扩展名、HEIC、大小；不通过返回 {ok:false,error}
export function validateMediaFile(file, kind) {
  const rule = MEDIA_RULES[kind];
  if (!rule) return { ok: false, error: '文件类别不正确。' };
  const ext = extOf(file?.name);
  if (HEIC_EXTS.includes(ext)) return { ok: false, error: 'HEIC 照片（苹果手机格式）浏览器无法处理，请先在手机上转成 JPG 再上传。' };
  if (!rule.exts.includes(ext)) return { ok: false, error: `“${rule.label}”只支持 ${rule.exts.join('、').toUpperCase()}。` };
  if (file.size > rule.max) return { ok: false, error: `文件不能超过 ${mb(rule.max)}MB（当前 ${(file.size / 1048576).toFixed(1)}MB）。` };
  return { ok: true };
}

function loadBitmap(file) {
  if (typeof createImageBitmap === 'function') return createImageBitmap(file);
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(Error('无法读取这张图片，请换一张 JPG、PNG 或 WebP。')); };
    img.src = url;
  });
}

const toBlob = (canvas, quality) => new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(Error('图片压缩失败，请重试。')), 'image/jpeg', quality));

// 输出 JPEG（M3）：质量约 85%，超过 500KB 自动降一档
async function encodeJpeg(canvas) {
  let blob = await toBlob(canvas, 0.85);
  if (blob.size > 500 * 1024) blob = await toBlob(canvas, 0.72);
  if (blob.size > 500 * 1024) blob = await toBlob(canvas, 0.6);
  return blob;
}

let stylesReady = false;
function ensureStyles() {
  if (stylesReady) return;
  stylesReady = true;
  const style = document.createElement('style');
  style.textContent = `
  dialog.media-crop{border:0;border-radius:16px;padding:0;max-width:min(96vw,680px);box-shadow:0 24px 80px rgba(15,23,42,.35)}
  dialog.media-crop::backdrop{background:rgba(15,23,42,.55)}
  .media-crop-inner{padding:18px 20px 20px;font:14px/1.5 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;color:#0f172a}
  .media-crop-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
  .media-crop-head h2{font-size:16px;margin:0}
  .media-crop-head small{color:#64748b}
  .media-crop-stage{position:relative;display:grid;place-items:center;background:#0f172a;border-radius:12px;overflow:hidden;touch-action:none;cursor:grab}
  .media-crop-stage.is-circle{border-radius:50%;box-shadow:0 0 0 999px rgba(15,23,42,0) inset}
  .media-crop-stage canvas{display:block;width:100%;height:100%}
  .media-crop-stage.is-circle::after{content:"";position:absolute;inset:0;border-radius:50%;box-shadow:0 0 0 3px rgba(255,255,255,.9) inset;pointer-events:none}
  .media-crop-stage.is-dragging{cursor:grabbing}
  .media-crop-bar{display:flex;align-items:center;gap:12px;margin-top:12px}
  .media-crop-bar input[type=range]{flex:1;accent-color:#21785b}
  .media-crop-tip{margin:10px 0 0;color:#334155;background:#f1f5f9;border-radius:8px;padding:8px 10px;font-size:12px}
  .media-crop-warning{margin:10px 0 0;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 10px;font-size:13px}
  .media-crop-warning[hidden]{display:none}
  .media-crop-info{margin:8px 0 0;color:#64748b;font-size:12px}
  .media-crop-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:16px}
  .media-crop-actions button{border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:8px 16px;font:inherit;cursor:pointer}
  .media-crop-actions button[data-crop-confirm]{background:#21785b;border-color:#21785b;color:#fff}
  .media-crop-actions button:disabled{opacity:.5;cursor:default}
  `;
  document.head.appendChild(style);
}

// 裁剪框：整个画布就是输出画面；图片在下面拖动、缩放（M2）。确认后返回 JPEG Blob。
export function openCropper(bitmap, preset, { title } = {}) {
  ensureStyles();
  const imgW = bitmap.width || bitmap.naturalWidth, imgH = bitmap.height || bitmap.naturalHeight;
  const aspect = preset.aspect || imgW / imgH;
  const vw = Math.min(560, Math.max(280, window.innerWidth - 80));
  let frameW = vw, frameH = Math.round(vw / aspect);
  if (frameH > window.innerHeight * 0.62) { frameH = Math.round(window.innerHeight * 0.62); frameW = Math.round(frameH * aspect); }

  const dialog = document.createElement('dialog');
  dialog.className = 'media-crop';
  dialog.setAttribute('data-media-cropper', preset.label);
  dialog.innerHTML = `<div class="media-crop-inner"><div class="media-crop-head"><h2>${title || preset.label}</h2><small>${preset.contain ? '完整显示，不裁剪' : '按住图片拖动 · 滑杆缩放'}</small></div><div class="media-crop-stage${preset.shape === 'circle' ? ' is-circle' : ''}" data-crop-stage><canvas data-crop-canvas></canvas></div><p class="media-crop-tip">${preset.contain ? '图片完整显示，不裁剪，长边压到 2400 以内。' : '按住图片拖动位置；用下面的“缩放”滑杆放大或缩小。框内就是最终画面。'}</p><p class="media-crop-warning" data-crop-warning hidden></p><div class="media-crop-bar"><span>缩放</span><input type="range" min="100" max="400" value="100" data-crop-zoom ${preset.contain ? 'disabled' : ''}><span>${preset.out[0]}×${preset.out[1]}</span></div><p class="media-crop-info" data-crop-info></p><div class="media-crop-actions"><button type="button" data-crop-cancel>取消</button><button type="button" data-crop-confirm>确认使用</button></div></div>`;
  document.body.appendChild(dialog);

  const stage = dialog.querySelector('[data-crop-stage]');
  stage.style.width = frameW + 'px';
  stage.style.height = frameH + 'px';
  const canvas = dialog.querySelector('[data-crop-canvas]');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(frameW * dpr);
  canvas.height = Math.round(frameH * dpr);
  const ctx = canvas.getContext('2d');

  const warn = dialog.querySelector('[data-crop-warning]');
  const info = dialog.querySelector('[data-crop-info]');
  const small = preset.min[0] && (imgW < preset.min[0] || imgH < preset.min[1]);
  if (small) {
    warn.hidden = false;
    warn.textContent = `原图偏小（${imgW}×${imgH}，建议至少 ${preset.min[0]}×${preset.min[1]}）。仍然可以上传，但放大后可能不够清晰。`;
  }
  info.textContent = `原图 ${imgW}×${imgH}${preset.contain ? ' · 不裁剪，长边压到 2400 以内' : ' · 按住图片拖动，滑杆缩放'}`;

  const containScale = Math.min(frameW / imgW, frameH / imgH);
  const coverScale = Math.max(frameW / imgW, frameH / imgH);
  let zoom = 1, panX = 0, panY = 0;
  const scale = () => (preset.contain ? containScale : coverScale * zoom);
  // 图片左上角在画布里的位置；panX/panY 为可拖动余量的一半
  const origin = () => {
    const s = scale(), dw = imgW * s, dh = imgH * s;
    const ox = (frameW - dw) / 2 + panX, oy = (frameH - dh) / 2 + panY;
    return { s, dw, dh, ox, oy };
  };
  const clampPan = () => {
    const s = scale(), dw = imgW * s, dh = imgH * s;
    const maxX = Math.max(0, (dw - frameW) / 2), maxY = Math.max(0, (dh - frameH) / 2);
    panX = Math.min(maxX, Math.max(-maxX, panX));
    panY = Math.min(maxY, Math.max(-maxY, panY));
  };
  // M2：裁剪框默认在图片上部居中（照片一般头在上方）
  const resetPan = () => {
    const s = scale(), dh = imgH * s;
    panX = 0;
    panY = Math.max(0, (dh - frameH) / 2);
    clampPan();
  };
  const draw = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, frameW, frameH);
    const { s, dw, dh, ox, oy } = origin();
    ctx.drawImage(bitmap, ox, oy, dw, dh);
    // 裁剪框提示线（圆形预览不画）
    if (preset.shape !== 'circle') {
      ctx.strokeStyle = 'rgba(250,204,21,.95)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, frameW - 2, frameH - 2);
    }
  };
  resetPan();
  draw();

  const zoomInput = dialog.querySelector('[data-crop-zoom]');
  let dragging = null;
  const onDown = event => {
    dragging = { x: event.clientX, y: event.clientY, panX, panY };
    stage.classList.add('is-dragging');
    stage.setPointerCapture?.(event.pointerId);
  };
  const onMove = event => {
    if (!dragging || preset.contain) return;
    panX = dragging.panX + (event.clientX - dragging.x);
    panY = dragging.panY + (event.clientY - dragging.y);
    clampPan();
    draw();
  };
  const onUp = () => { dragging = null; stage.classList.remove('is-dragging'); };
  stage.addEventListener('pointerdown', onDown);
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerup', onUp);
  stage.addEventListener('pointercancel', onUp);
  stage.addEventListener('wheel', event => {
    if (preset.contain) return;
    event.preventDefault();
    zoom = Math.min(4, Math.max(1, zoom * (event.deltaY < 0 ? 1.08 : 1 / 1.08)));
    zoomInput.value = String(Math.round(zoom * 100));
    clampPan();
    draw();
  }, { passive: false });
  zoomInput.addEventListener('input', () => {
    zoom = Math.max(1, Number(zoomInput.value) / 100);
    clampPan();
    draw();
  });

  return new Promise(resolve => {
    const close = value => { try { dialog.close(); } catch { } dialog.remove(); resolve(value); };
    dialog.querySelector('[data-crop-cancel]').addEventListener('click', () => close(null));
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(null); });
    dialog.querySelector('[data-crop-confirm]').addEventListener('click', async () => {
      const button = dialog.querySelector('[data-crop-confirm]');
      button.disabled = true;
      try {
        const { s, ox, oy } = origin();
        const sx = Math.max(0, -ox / s), sy = Math.max(0, -oy / s);
        const sw = Math.min(imgW - sx, frameW / s), sh = Math.min(imgH - sy, frameH / s);
        let outW, outH;
        if (preset.contain) {
          const k = Math.min(1, preset.out[0] / Math.max(imgW, imgH));
          outW = Math.max(1, Math.round(imgW * k));
          outH = Math.max(1, Math.round(imgH * k));
        } else {
          [outW, outH] = preset.out;
        }
        const out = document.createElement('canvas');
        out.width = outW;
        out.height = outH;
        out.getContext('2d').drawImage(bitmap, sx, sy, sw, sh, 0, 0, outW, outH);
        const blob = await encodeJpeg(out);
        close({ blob, width: outW, height: outH, warn: small ? warn.textContent : '' });
      } catch (error) {
        button.disabled = false;
        warn.hidden = false;
        warn.textContent = error.message || '图片处理失败，请重试。';
      }
    });
    dialog.showModal();
  });
}

// 保留一张长边 2400 的未裁剪原图，供以后“调整位置”重新取景；JPEG 压缩后一般不到 1MB
async function makeSourceFile(bitmap, file) {
  const max = 2400, scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await toBlob(canvas, 0.82);
  const name = String(file.name || 'image').replace(/\.[^.]+$/, '') + '-原图.jpg';
  return new File([blob], name, { type: 'image/jpeg' });
}

// 图片入口（M2–M5）：检查 → 裁剪 → 压缩，返回可直接上传的 JPEG；withSource 时另带未裁剪原图
export async function prepareImage(file, { preset = 'expert', title, withSource = false } = {}) {
  const config = IMAGE_PRESETS[preset];
  if (!config) throw Error('图片用途不正确。');
  const check = validateMediaFile(file, 'image');
  if (!check.ok) throw Error(check.error);
  const bitmap = await loadBitmap(file);
  try {
    const result = await openCropper(bitmap, config, { title });
    if (!result) return null;
    const name = String(file.name || 'image').replace(/\.[^.]+$/, '') + '.jpg';
    const sourceFile = withSource ? await makeSourceFile(bitmap, file) : null;
    return { ...result, name, file: new File([result.blob], name, { type: 'image/jpeg' }), sourceFile };
  } finally {
    bitmap.close?.();
  }
}

// 读图片原始宽高（不弹裁剪框）
export async function readImageInfo(file) {
  const bitmap = await loadBitmap(file);
  const size = { width: bitmap.width || bitmap.naturalWidth, height: bitmap.height || bitmap.naturalHeight };
  bitmap.close?.();
  return size;
}

const videoError = () => Error('这个视频浏览器放不了，' + HINT_MP4);

// 视频信息（M6）：浏览器真正能解码才算通过；返回宽、高、时长
export function probeVideo(file, { timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), video = document.createElement('video');
    let done = false;
    const finish = (fn, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      video.removeAttribute('src');
      video.load?.();
      URL.revokeObjectURL(url);
      fn(value);
    };
    const timer = setTimeout(() => finish(reject, videoError()), timeout);
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      if (!video.videoWidth || !video.videoHeight) return finish(reject, videoError());
      finish(resolve, { width: video.videoWidth, height: video.videoHeight, duration: Math.round(video.duration * 100) / 100, playable: true });
    };
    video.onerror = () => finish(reject, videoError());
    video.src = url;
  });
}

// 截取视频某一秒做封面（M7）；不指定时用第 1 秒，视频更短就用中间一帧
export async function captureFrame(file, time = 1) {
  const info = await probeVideo(file);
  const at = Math.max(0, Math.min(Number(time) || 0, Math.max(0, info.duration - 0.05)));
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), video = document.createElement('video');
    let done = false;
    const finish = (fn, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      fn(value);
    };
    const timer = setTimeout(() => finish(reject, Error('读取视频画面超时，请换一个视频。')), 15000);
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    video.onloadedmetadata = () => { video.currentTime = at; };
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = info.width;
        canvas.height = info.height;
        canvas.getContext('2d').drawImage(video, 0, 0, info.width, info.height);
        canvas.toBlob(async blob => {
          if (!blob) return finish(reject, Error('视频封面生成失败，请重试。'));
          try { finish(resolve, { blob, width: info.width, height: info.height, time: at, video: info }); }
          catch (error) { finish(reject, error); }
        }, 'image/jpeg', 0.86);
      } catch (error) { finish(reject, error); }
    };
    video.onerror = () => finish(reject, videoError());
  });
}

// 视频整套准备：检查 → 探测 → 截默认封面；上传由 uploadMedia 完成
export async function prepareVideo(file, { coverTime = 1 } = {}) {
  const check = validateMediaFile(file, 'video');
  if (!check.ok) throw Error(check.error);
  const meta = await probeVideo(file);
  let cover = null;
  try { cover = await captureFrame(file, coverTime); } catch { cover = null; }
  return { file, meta, cover, coverTime: cover?.time ?? null };
}

// 上传封面图（M7 另传一张图）：裁 16:9 后返回 JPEG
export async function prepareCoverImage(file) {
  return prepareImage(file, { preset: 'clip' });
}

function csrfToken() {
  const entry = (document.cookie || '').split('; ').find(x => x.startsWith('admin_csrf='));
  return entry ? decodeURIComponent(entry.slice('admin_csrf='.length)) : '';
}

// 流式上传（M9）：直接发文件字节，带进度回调；返回服务端保存的文件信息
export function uploadMedia(fileOrBlob, { name, onProgress } = {}) {
  const fileName = name || fileOrBlob.name || (fileOrBlob.type === 'image/jpeg' ? 'image.jpg' : 'upload.bin');
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    xhr.setRequestHeader('Content-Type', fileOrBlob.type || 'application/octet-stream');
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(fileName));
    const token = csrfToken();
    if (token) xhr.setRequestHeader('X-CSRF-Token', token);
    xhr.upload.onprogress = event => {
      if (!onProgress) return;
      const percent = event.lengthComputable ? Math.round(event.loaded / event.total * 100) : 0;
      onProgress(percent, event.loaded, event.total);
    };
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText || '{}'); } catch { }
      if (xhr.status >= 200 && xhr.status < 300 && data.file) return resolve(data.file);
      reject(Error(data.error || `上传失败（${xhr.status}）。`));
    };
    xhr.onerror = () => reject(Error('网络中断，上传失败，请重试。'));
    xhr.onabort = () => reject(Error('上传已取消。'));
    xhr.send(fileOrBlob);
  });
}

// 图片一条龙：裁剪压缩后直接上传；同时存一张未裁剪原图，供以后“调整位置”（第 3、4 步表单用）
export async function prepareAndUploadImage(file, { preset = 'expert', title, onProgress } = {}) {
  const prepared = await prepareImage(file, { preset, title, withSource: true });
  if (!prepared) return null;
  const saved = await uploadMedia(prepared.file, { name: prepared.name, onProgress });
  if (prepared.sourceFile) {
    try { saved.source = await uploadMedia(prepared.sourceFile, { name: prepared.sourceFile.name }); }
    catch { /* 原图没存上也不影响已裁好的照片，只是以后不能重新取景 */ }
  }
  return { ...prepared, saved };
}

// 已上传照片重新调整位置：优先用保存的原图；没有原图时只能用当前裁好的图（移动余量有限）
export async function adjustUploadedImage(existing, { preset = 'expert' } = {}) {
  if (!existing?.id) throw Error('找不到这张照片。');
  const source = existing.source?.id ? existing.source : existing;
  const response = await fetch(`/media/${encodeURIComponent(source.id)}`);
  if (!response.ok) throw Error('读取照片失败，请重新上传。');
  const blob = await response.blob();
  const file = new File([blob], existing.name || 'image.jpg', { type: blob.type || 'image/jpeg' });
  const prepared = await prepareImage(file, { preset });
  if (!prepared) return null;
  const saved = await uploadMedia(prepared.file, { name: prepared.name });
  if (existing.source?.id) saved.source = existing.source;
  return { saved, sourceLimited: !existing.source?.id, warn: prepared.warn || '' };
}
