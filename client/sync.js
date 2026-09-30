// 서버 playlist 동기화 + 로컬 캐시 (서버 불통 시 캐시로 재생)
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { pathToFileURL } = require('url');

const ROOT = path.join(process.env.LOCALAPPDATA || app.getPath('userData'), 'CompanySaver');
const CACHE = path.join(ROOT, 'cache');
const CONFIG_FILE = path.join(ROOT, 'config.json');
const PLAYLIST_FILE = path.join(CACHE, 'playlist.json');
fs.mkdirSync(CACHE, { recursive: true });

const DEFAULTS = { serverUrl: '', pollMinutes: 10 };

function loadConfig() {
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch {}
  if (!cfg.serverUrl) {
    // 설치본에 동봉된 기본 config.json (배포 시 서버 주소 미리 지정)
    try { cfg = { ...JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')), ...cfg }; } catch {}
  }
  return { ...DEFAULTS, ...cfg };
}
function saveConfig(cfg) {
  fs.mkdirSync(ROOT, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

async function fetchTimeout(url, ms = 8000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { signal: ac.signal }); } finally { clearTimeout(t); }
}

async function download(url, dest) {
  const r = await fetchTimeout(url, 120000);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
}

// 캐시 내 콘텐츠 한 개 동기화 (버전이 바뀌었을 때만 다시 받음)
async function syncItem(server, it) {
  const dir = path.join(CACHE, String(it.id));
  const verFile = path.join(dir, '.version');
  let cur = ''; try { cur = fs.readFileSync(verFile, 'utf8'); } catch {}
  if (cur === it.version && fs.existsSync(path.join(dir, it.entry))) return true;
  const tmp = dir + '.tmp';
  fs.rmSync(tmp, { recursive: true, force: true });
  const base = `${server}/content/${it.id}/`;
  const root = path.resolve(tmp);
  for (const f of it.files) {
    const dest = path.resolve(root, f);
    if (!dest.startsWith(root + path.sep)) throw new Error('잘못된 파일 경로: ' + f); // 서버가 ../ 경로를 보내도 캐시 밖에는 쓰지 않음
    await download(base + f.split('/').map(encodeURIComponent).join('/'), dest);
  }
  fs.writeFileSync(path.join(tmp, '.version'), it.version);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.renameSync(tmp, dir);
  return true;
}

function resolvePlayable(server, it) {
  if (it.remote) return { ...it, src: it.url };
  const local = path.join(CACHE, String(it.id), it.entry);
  const src = fs.existsSync(local) ? pathToFileURL(local).href : server + it.url;
  return { ...it, src };
}

async function fetchPlaylist(server) {
  const r = await fetchTimeout(`${server}/api/playlist`);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

// 반환: { items, online, serverUrl }  - 서버 주소는 사용자가 직접 입력한 값만 사용한다(자동 검색 없음)
async function syncPlaylist(cfg) {
  const server = (cfg.serverUrl || '').replace(/\/+$/, '');
  let data = null, online = true;
  try {
    if (!server) throw new Error('서버 주소가 설정되지 않음');
    data = await fetchPlaylist(server);
    fs.writeFileSync(PLAYLIST_FILE, JSON.stringify(data));
    for (const it of data.items) {
      if (it.remote) continue;
      try { await syncItem(server, it); } catch (e) { console.error('[sync] 실패', it.id, e.message); }
    }
    // 서버에서 사라진 콘텐츠 캐시 정리
    const keep = new Set(data.items.map((i) => String(i.id)));
    for (const d of fs.readdirSync(CACHE, { withFileTypes: true })) {
      if (d.isDirectory() && !keep.has(d.name)) fs.rmSync(path.join(CACHE, d.name), { recursive: true, force: true });
    }
  } catch (e) {
    online = false;
    try { data = JSON.parse(fs.readFileSync(PLAYLIST_FILE, 'utf8')); } catch { data = { items: [] }; }
  }
  // 오프라인일 땐 마지막으로 받은 목록을 그대로 사용
  return { items: data.items.map((it) => resolvePlayable(server, it)), online, serverUrl: server };
}

module.exports = { loadConfig, saveConfig, syncPlaylist };
