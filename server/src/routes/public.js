const express = require('express');
const fs = require('fs');
const path = require('path');
const { db, UPLOAD_DIR } = require('../db');

const router = express.Router();

// 콘텐츠 폴더의 모든 파일(상대경로) - 클라이언트 오프라인 캐시용
function listFiles(dir, base = '') {
  let out = [];
  for (const e of fs.readdirSync(path.join(dir, base), { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out = out.concat(listFiles(dir, rel));
    else out.push(rel);
  }
  return out;
}

// 클라이언트(스크린세이버)용 플레이리스트
// GET /api/playlist  (부서는 등록 정보일 뿐 재생 여부와 무관)
router.get('/playlist', (req, res) => {
  const now = new Date();
  const rows = db.prepare('SELECT * FROM contents WHERE enabled = 1 ORDER BY display_order, id').all();
  const items = rows.filter((r) => {
    if (r.start_at && now < new Date(r.start_at)) return false;
    if (r.end_at && now > new Date(r.end_at)) return false;
    return true;
  }).map((r) => {
    const remote = r.type.endsWith('_url');
    const kind = r.type.startsWith('image') ? 'image' : r.type.startsWith('video') ? 'video' : 'web';
    return {
      id: r.id,
      title: r.title,
      kind, // image | video | web
      url: remote ? r.source : `/content/${r.id}/${encodeURI(r.source)}`,
      remote,
      entry: remote ? '' : r.source,
      files: remote ? [] : (() => { try { return listFiles(path.join(UPLOAD_DIR, String(r.id))); } catch { return []; } })(),
      duration: r.duration_sec,
      monitor: r.monitor_target,
      fit: r.fit,
      baseW: r.base_w,
      baseH: r.base_h,
      version: r.updated_at,
    };
  });
  res.json({ generatedAt: now.toISOString(), items });
});

module.exports = router;
