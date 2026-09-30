const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const TMP_DIR = path.join(DATA_DIR, 'tmp');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'screensaver.db'));
db.exec(`
CREATE TABLE IF NOT EXISTS contents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  type TEXT NOT NULL,            -- html | image | video | image_url | video_url | web_url
  source TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',   -- '' = 전사
  owner TEXT NOT NULL DEFAULT '',
  start_at TEXT NOT NULL DEFAULT '',     -- YYYY-MM-DDTHH:mm (local), '' = 제한 없음
  end_at TEXT NOT NULL DEFAULT '',
  duration_sec INTEGER NOT NULL DEFAULT 10,
  display_order INTEGER NOT NULL DEFAULT 0,
  monitor_target TEXT NOT NULL DEFAULT 'all', -- all | primary | secondary
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);
`);

// 마이그레이션: 화면 맞춤 옵션 (fit: contain=여백 / cover=꽉 채우기, base_w/base_h>0 이면 HTML을 기준 해상도로 렌더링 후 축소·확대)
const cols = db.prepare('PRAGMA table_info(contents)').all().map((c) => c.name);
for (const [name, def] of [['fit', "TEXT NOT NULL DEFAULT 'contain'"], ['base_w', 'INTEGER NOT NULL DEFAULT 0'], ['base_h', 'INTEGER NOT NULL DEFAULT 0']]) {
  if (!cols.includes(name)) db.exec(`ALTER TABLE contents ADD COLUMN ${name} ${def}`);
}

if (db.prepare('SELECT COUNT(*) AS n FROM admins').get().n === 0) {
  const user = process.env.ADMIN_USER || 'admin';
  const pass = process.env.ADMIN_PASS || 'admin1234';
  db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(user, bcrypt.hashSync(pass, 10));
  console.log(`[init] 관리자 계정 생성: ${user} / ${process.env.ADMIN_PASS ? '(환경변수)' : 'admin1234'}  -- 반드시 변경하세요`);
}

module.exports = { db, DATA_DIR, UPLOAD_DIR, TMP_DIR };
