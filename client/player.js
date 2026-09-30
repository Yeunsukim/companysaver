const q = new URLSearchParams(location.search);
const role = q.get('role') || 'primary'; // 이 창이 표시되는 모니터 (primary | secondary)
const stage = document.getElementById('stage');

let items = [];
let idx = -1;
let timer = null;
let signature = '';
let current = null;

// ---- 입력 시 종료 (시작 직후 1초는 무시, 마우스는 일정 거리 이상 움직였을 때만) ----
const start = Date.now();
let lastX = null, lastY = null;
const quit = () => { if (Date.now() - start > 1000) window.saver.quit(); };
addEventListener('mousemove', (e) => {
  if (lastX === null) { lastX = e.screenX; lastY = e.screenY; return; }
  if (Math.abs(e.screenX - lastX) + Math.abs(e.screenY - lastY) > 10) quit();
});
['mousedown', 'keydown', 'wheel', 'touchstart'].forEach((t) => addEventListener(t, quit, true));

// ---- 재생 목록 ----
function mine(list) {
  // 2대 초과 모니터는 보조로 간주. monitor 값이 all 이면 모든 모니터에 표시
  return list.filter((it) => it.monitor === 'all' || it.monitor === role);
}
function setPlaylist(list) {
  const mineList = mine(list);
  const sig = JSON.stringify(mineList.map((i) => [i.id, i.version, i.duration, i.src, i.fit, i.baseW, i.baseH]));
  if (sig === signature) return;
  signature = sig;
  items = mineList;
  clearTimeout(timer);
  // 현재 표시 중인 콘텐츠가 여전히 목록에 있으면 이어서 진행, 아니면 처음부터
  const keep = current ? items.findIndex((i) => i.id === current.id) : -1;
  idx = keep >= 0 ? keep - 1 : -1;
  if (keep < 0) clear();
  next();
}
function clear() { [...stage.children].forEach((c) => c.remove()); current = null; }

function makeLayer(it) {
  let el;
  const objectFit = it.fit === 'cover' ? 'cover' : 'contain'; // 여백(contain) / 꽉 채우기(cover)
  if (it.kind === 'image') {
    el = document.createElement('img'); el.src = it.src; el.style.objectFit = objectFit;
  } else if (it.kind === 'video') {
    el = document.createElement('video');
    el.src = it.src; el.muted = true; el.autoplay = true; el.playsInline = true; el.style.objectFit = objectFit;
  } else {
    const frame = document.createElement('iframe'); frame.src = it.src; // HTML: JS/CSS 정상 실행
    frame.setAttribute('allow', 'autoplay');
    const bw = it.baseW | 0, bh = it.baseH | 0;
    if (bw > 0 && bh > 0) {
      // 기준 해상도(예: 1920x1080)로 그린 뒤 모니터 크기에 맞춰 확대/축소
      el = document.createElement('div');
      el.style.overflow = 'hidden';
      frame.style.cssText = `position:absolute;left:0;top:0;width:${bw}px;height:${bh}px;border:0;transform-origin:0 0;background:#000`;
      el.appendChild(frame);
      el.__fit = () => {
        const W = innerWidth, H = innerHeight;
        const s = it.fit === 'cover' ? Math.max(W / bw, H / bh) : Math.min(W / bw, H / bh);
        frame.style.transform = `translate(${(W - bw * s) / 2}px,${(H - bh * s) / 2}px) scale(${s})`;
      };
      el.__fit();
    } else {
      el = frame; // 반응형: 모니터 크기 그대로
    }
  }
  el.className = 'layer';
  return el;
}

function next() {
  clearTimeout(timer);
  if (!items.length) { clear(); return; }
  idx = (idx + 1) % items.length;
  const it = items[idx];
  const el = makeLayer(it);
  const advance = () => { if (items.length > 1) next(); };
  const dur = Math.max(1, it.duration || 10) * 1000;

  if (it.kind === 'video') {
    el.loop = items.length === 1;
    el.onended = advance;
    el.onerror = () => { timer = setTimeout(advance, 1000); };
    // 영상은 끝까지 재생. 메타데이터를 못 읽는 등 문제 시에도 안전장치 타이머
    el.onloadedmetadata = () => {
      const len = (el.duration || 0) * 1000;
      timer = setTimeout(advance, Math.max(dur, len) + 2000);
    };
  } else {
    el.onerror = () => { timer = setTimeout(advance, 1000); };
    timer = setTimeout(advance, dur);
  }
  if (items.length === 1) clearTimeout(timer); // 단일 항목은 계속 표시

  stage.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
  const old = current && current.el;
  if (old) { old.classList.remove('on'); setTimeout(() => old.remove(), 900); }
  current = { id: it.id, el };
}

addEventListener('resize', () => { if (current && current.el.__fit) current.el.__fit(); });

window.saver.getPlaylist().then(setPlaylist);
window.saver.onPlaylist(setPlaylist);
