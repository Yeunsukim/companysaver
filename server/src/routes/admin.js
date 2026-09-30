const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const AdmZip = require('adm-zip');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { db, UPLOAD_DIR, TMP_DIR } = require('../db');

const router = express.Router();
const upload = multer({ dest: TMP_DIR, limits: { fileSize: 500 * 1024 * 1024 } });

const TYPES = ['html', 'image', 'video', 'image_url', 'video_url', 'web_url'];
const FILE_EXT = {
  html: ['.zip', '.html', '.htm'],
  image: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'],
  video: ['.mp4', '.webm', '.ogv', '.mov'],
};

// ---------- 세션 (메모리) ----------
const sessions = new Map();
const SESSION_MS = 8 * 3600 * 1000;

function parseCookie(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((c) => {
    const i = c.indexOf('=');
    if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return out;
}
function requireAuth(req, res, next) {
  const sid = parseCookie(req).sid;
  const s = sid && sessions.get(sid);
  if (!s || s.exp < Date.now()) return res.status(401).json({ error: '로그인이 필요합니다' });
  s.exp = Date.now() + SESSION_MS;
  req.user = s.user;
  next();
}

router.post('/login', express.json(), (req, res) => {
  const { username, password } = req.body || {};
  const row = db.prepare('SELECT * FROM admins WHERE username = ?').get(String(username || ''));
  if (!row || !bcrypt.compareSync(String(password || ''), row.password_hash)) {
    return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다' });
  }
  const sid = crypto.randomBytes(24).toString('hex');
  sessions.set(sid, { user: row.username, exp: Date.now() + SESSION_MS });
  res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}`);
  res.json({ user: row.username });
});
router.post('/logout', (req, res) => {
  sessions.delete(parseCookie(req).sid);
  res.setHeader('Set-Cookie', 'sid=; Path=/; Max-Age=0');
  res.json({ ok: true });
});
router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

router.post('/password', requireAuth, express.json(), (req, res) => {
  const { current, next: nw } = req.body || {};
  const row = db.prepare('SELECT * FROM admins WHERE username = ?').get(req.user);
  if (!bcrypt.compareSync(String(current || ''), row.password_hash)) return res.status(400).json({ error: '현재 비밀번호가 다릅니다' });
  if (!nw || String(nw).length < 6) return res.status(400).json({ error: '새 비밀번호는 6자 이상이어야 합니다' });
  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(String(nw), 10), row.id);
  res.json({ ok: true });
});

// ---------- 콘텐츠 ----------
function withStatus(r) {
  const now = new Date();
  const s = r.start_at ? new Date(r.start_at) : null;
  const e = r.end_at ? new Date(r.end_at) : null;
  let status = 'active';
  if (!r.enabled) status = 'disabled';
  else if (s && now < s) status = 'scheduled';
  else if (e && now > e) status = 'expired';
  return { ...r, enabled: !!r.enabled, status };
}
function contentDir(id) { return path.join(UPLOAD_DIR, String(id)); }
function rmDirSafe(dir) { fs.rmSync(dir, { recursive: true, force: true }); }

function extractZip(zipPath, destDir) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries().filter((e) => !e.entryName.startsWith('__MACOSX/'));
  const idx = entries.filter((e) => !e.isDirectory && /(^|\/)index\.html?$/i.test(e.entryName))
    .sort((a, b) => a.entryName.split('/').length - b.entryName.split('/').length)[0];
  if (!idx) throw new Error('ZIP 안에 index.html 이 없습니다');
  const prefix = idx.entryName.replace(/index\.html?$/i, '');
  const entryFile = path.basename(idx.entryName);
  const root = path.resolve(destDir);
  for (const e of entries) {
    if (e.isDirectory || !e.entryName.startsWith(prefix)) continue;
    const rel = e.entryName.slice(prefix.length);
    const target = path.resolve(root, rel);
    if (target !== root && !target.startsWith(root + path.sep)) throw new Error('잘못된 ZIP 경로');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, e.getData());
  }
  return entryFile;
}

function storeFile(id, type, file) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!FILE_EXT[type] || !FILE_EXT[type].includes(ext)) {
    throw new Error(`허용되지 않는 파일 형식입니다 (${FILE_EXT[type] ? FILE_EXT[type].join(', ') : '-'})`);
  }
  const dir = contentDir(id);
  rmDirSafe(dir);
  fs.mkdirSync(dir, { recursive: true });
  if (type === 'html') {
    if (ext === '.zip') return extractZip(file.path, dir);
    fs.copyFileSync(file.path, path.join(dir, 'index.html'));
    return 'index.html';
  }
  const name = 'media' + ext;
  fs.copyFileSync(file.path, path.join(dir, name));
  return name;
}

function readBody(b) {
  const type = String(b.type || '');
  if (!TYPES.includes(type)) throw new Error('유형이 올바르지 않습니다');
  const title = String(b.title || '').trim();
  if (!title) throw new Error('제목을 입력하세요');
  const start_at = String(b.start_at || '');
  const end_at = String(b.end_at || '');
  if (start_at && end_at && new Date(end_at) < new Date(start_at)) throw new Error('게시 종료일이 시작일보다 빠릅니다');
  const monitor_target = ['all', 'primary', 'secondary'].includes(b.monitor_target) ? b.monitor_target : 'all';
  const fit = b.fit === 'cover' ? 'cover' : 'contain';
  // 기준 해상도는 HTML/웹페이지에서만 의미 있음 (0 = 화면 크기에 맞춰 자동/반응형)
  let base_w = parseInt(b.base_w, 10) || 0, base_h = parseInt(b.base_h, 10) || 0;
  const scalable = type === 'html' || type === 'web_url';
  if (!scalable || base_w < 100 || base_w > 10000 || base_h < 100 || base_h > 10000) { base_w = 0; base_h = 0; }
  return {
    type, title, start_at, end_at, monitor_target, fit, base_w, base_h,
    department: String(b.department || '').trim(),
    owner: String(b.owner || '').trim(),
    duration_sec: Math.min(3600, Math.max(1, parseInt(b.duration_sec, 10) || 10)),
    enabled: b.enabled === 'false' || b.enabled === false || b.enabled === '0' ? 0 : 1,
    url: String(b.url || '').trim(),
  };
}

router.use(requireAuth);
// :id 는 숫자만 허용 (파일 경로 조합에 쓰이므로 ../ 같은 값 차단)
router.param('id', (req, res, next, id) => {
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: '잘못된 ID' });
  next();
});

router.get('/contents', (req, res) => {
  const rows = db.prepare('SELECT * FROM contents ORDER BY display_order, id').all();
  res.json(rows.map(withStatus));
});
router.get('/contents/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM contents WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: '없는 콘텐츠' });
  res.json(withStatus(r));
});

router.post('/contents', upload.single('file'), (req, res) => {
  let id;
  try {
    const d = readBody(req.body);
    const isUrl = d.type.endsWith('_url');
    if (isUrl && !/^https?:\/\//i.test(d.url)) throw new Error('http(s):// 로 시작하는 URL을 입력하세요');
    if (!isUrl && !req.file) throw new Error('파일을 선택하세요');
    const order = db.prepare('SELECT COALESCE(MAX(display_order),0)+1 AS n FROM contents').get().n;
    const info = db.prepare(`INSERT INTO contents
      (title,type,source,department,owner,start_at,end_at,duration_sec,display_order,monitor_target,enabled,fit,base_w,base_h)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(d.title, d.type, isUrl ? d.url : '', d.department, d.owner, d.start_at, d.end_at, d.duration_sec, order, d.monitor_target, d.enabled, d.fit, d.base_w, d.base_h);
    id = Number(info.lastInsertRowid);
    if (!isUrl) db.prepare('UPDATE contents SET source = ? WHERE id = ?').run(storeFile(id, d.type, req.file), id);
    res.json(withStatus(db.prepare('SELECT * FROM contents WHERE id = ?').get(id)));
  } catch (e) {
    if (id) { db.prepare('DELETE FROM contents WHERE id = ?').run(id); rmDirSafe(contentDir(id)); }
    res.status(400).json({ error: e.message });
  } finally {
    if (req.file) fs.rm(req.file.path, { force: true }, () => {});
  }
});

router.put('/contents/:id', upload.single('file'), (req, res) => {
  try {
    const old = db.prepare('SELECT * FROM contents WHERE id = ?').get(req.params.id);
    if (!old) return res.status(404).json({ error: '없는 콘텐츠' });
    const d = readBody(req.body);
    const isUrl = d.type.endsWith('_url');
    let source = old.source;
    if (isUrl) {
      if (!/^https?:\/\//i.test(d.url)) throw new Error('http(s):// 로 시작하는 URL을 입력하세요');
      source = d.url;
      if (!old.type.endsWith('_url')) rmDirSafe(contentDir(old.id));
    } else if (req.file) {
      source = storeFile(old.id, d.type, req.file);
    } else if (d.type !== old.type) {
      throw new Error('유형을 바꾸려면 새 파일을 업로드하세요');
    }
    db.prepare(`UPDATE contents SET title=?,type=?,source=?,department=?,owner=?,start_at=?,end_at=?,
      duration_sec=?,monitor_target=?,enabled=?,fit=?,base_w=?,base_h=?,updated_at=datetime('now','localtime') WHERE id=?`)
      .run(d.title, d.type, source, d.department, d.owner, d.start_at, d.end_at, d.duration_sec, d.monitor_target, d.enabled, d.fit, d.base_w, d.base_h, old.id);
    res.json(withStatus(db.prepare('SELECT * FROM contents WHERE id = ?').get(old.id)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  } finally {
    if (req.file) fs.rm(req.file.path, { force: true }, () => {});
  }
});

router.patch('/contents/:id/enabled', express.json(), (req, res) => {
  db.prepare("UPDATE contents SET enabled=?, updated_at=datetime('now','localtime') WHERE id=?").run(req.body.enabled ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

router.post('/contents/reorder', express.json(), (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  const st = db.prepare('UPDATE contents SET display_order=? WHERE id=?');
  ids.forEach((id, i) => st.run(i + 1, Number(id)));
  res.json({ ok: true });
});

router.delete('/contents/:id', (req, res) => {
  db.prepare('DELETE FROM contents WHERE id = ?').run(req.params.id);
  rmDirSafe(contentDir(req.params.id));
  res.json({ ok: true });
});

module.exports = router;
