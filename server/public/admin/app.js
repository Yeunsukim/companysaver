const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- 아이콘 ----------
const IC = {
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  skip: '<path d="M5 4l10 8-10 8zM19 5v14"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
  grip: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  video: '<rect x="2" y="5" width="14" height="14" rx="2"/><path d="M22 7l-6 5 6 5z"/>',
  code: '<path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>',
  link: '<path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20"/>',
  upload: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  logout: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 002 2h12a2 2 0 002-2V8M10 12h4"/>',
  off: '<circle cx="12" cy="12" r="10"/><path d="M4.9 4.9l14.2 14.2"/>',
};
const ic = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24">${IC[n] || ''}</svg>`;
const hydrateIcons = (root = document) => $$('[data-ic]', root).forEach((el) => { el.innerHTML = ic(el.dataset.ic); });

const TYPES = [
  { v: 'html', icon: 'code', name: 'HTML', desc: 'ZIP 또는 .html · JS/CSS 실행' },
  { v: 'image', icon: 'image', name: '이미지 파일', desc: 'png, jpg, gif, webp, svg' },
  { v: 'video', icon: 'video', name: '동영상 파일', desc: 'mp4, webm' },
  { v: 'image_url', icon: 'link', name: '이미지 URL', desc: '외부 이미지 주소' },
  { v: 'video_url', icon: 'link', name: '동영상 URL', desc: '외부 동영상 주소' },
  { v: 'web_url', icon: 'globe', name: '웹페이지 URL', desc: 'iframe 으로 표시' },
];
const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.v, t.name]));
const TYPE_ICON = Object.fromEntries(TYPES.map((t) => [t.v, t.icon]));
const FILE_HINT = { html: '.zip(index.html 포함) 또는 .html', image: 'png, jpg, gif, webp, svg', video: 'mp4, webm' };
const STATUS = {
  all: { label: '전체', icon: 'grid' },
  active: { label: '게시 중', icon: 'check' },
  scheduled: { label: '게시 예정', icon: 'calendar' },
  expired: { label: '기간 만료', icon: 'archive' },
  disabled: { label: '비활성', icon: 'off' },
};

let contents = [];
let editing = null;
let statusFilter = 'all';

function toast(msg, bad) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = 'toast'), 2600);
}
async function api(url, opt = {}) {
  const r = await fetch('/api/admin' + url, opt);
  if (r.status === 401) { showLogin(); throw new Error('로그인이 필요합니다'); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || '요청 실패');
  return data;
}
const jsonOpt = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// ---------- 로그인 ----------
function showLogin() { $('#login').classList.remove('hidden'); $('#app').classList.add('hidden'); }
async function boot() {
  let me;
  try { me = await api('/me'); } catch { return; }
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#userName').textContent = me.user; $('#avatar').textContent = me.user[0];
  await load();
  go(location.hash.replace('#/', '') || 'list');
}
$('#loginForm').onsubmit = async (e) => {
  e.preventDefault();
  try { await api('/login', jsonOpt('POST', Object.fromEntries(new FormData(e.target)))); $('#loginErr').textContent = ''; boot(); }
  catch (er) { $('#loginErr').textContent = er.message; }
};
$('#logoutBtn').onclick = async () => { await api('/logout', { method: 'POST' }).catch(() => {}); showLogin(); };
$('#pwBtn').onclick = () => { $('#pwErr').textContent = ''; $('#pwForm').reset(); $('#pwDlg').showModal(); };
$('#pwForm').onsubmit = async (e) => {
  if (e.submitter?.value !== 'ok') return;
  e.preventDefault();
  try { await api('/password', jsonOpt('POST', Object.fromEntries(new FormData(e.target)))); $('#pwDlg').close(); toast('비밀번호가 변경되었습니다'); }
  catch (er) { $('#pwErr').textContent = er.message; }
};

// ---------- 라우팅 ----------
function go(view, opts = {}) {
  if (!['list', 'form', 'preview'].includes(view)) view = 'list';
  if (view === 'form' && !opts.keepForm) { if (!opts.edit) editing = null; resetForm(); if (opts.edit) fillForm(opts.edit); }
  $$('[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
  ['list', 'form', 'preview'].forEach((v) => $('#view-' + v).classList.toggle('hidden', v !== view));
  if (view !== 'preview') pv.stop();
  if (view === 'preview') pv.start(opts.only);
  if (view === 'list') renderList();
  history.replaceState(null, '', '#/' + view);
  window.scrollTo(0, 0);
}
$$('[data-view]').forEach((b) => (b.onclick = () => go(b.dataset.view)));
$('#newBtn').onclick = $('#emptyNew').onclick = () => go('form');
$('#playAllBtn').onclick = () => go('preview');

// ---------- 목록 ----------
async function load() {
  contents = await api('/contents');
  const depts = [...new Set(contents.map((c) => c.department).filter(Boolean))].sort();
  const cur = $('#fDept').value;
  $('#fDept').innerHTML = '<option value="">전체 부서</option>' + depts.map((d) => `<option>${esc(d)}</option>`).join('');
  $('#fDept').value = depts.includes(cur) ? cur : '';
  $('#deptList').innerHTML = depts.map((d) => `<option value="${esc(d)}">`).join('');
  renderList();
}
const fmtDt = (s) => (s ? s.replace('T', ' ').slice(0, 16) : '');
function dday(c) {
  if (!c.end_at || c.status === 'expired' || c.status === 'scheduled') return '';
  const d = Math.ceil((new Date(c.end_at) - new Date()) / 86400000);
  return `<span class="dday ${d <= 3 ? 'late' : ''}">${d <= 0 ? '오늘 종료' : 'D-' + d}</span>`;
}
const srcOf = (c) => (c.type.endsWith('_url') ? c.source : `/content/${c.id}/${encodeURI(c.source)}`);
function thumbHtml(c) {
  if (c.type.startsWith('image')) return `<img src="${esc(srcOf(c))}" loading="lazy" alt="">`;
  if (c.type.startsWith('video')) return `<video src="${esc(srcOf(c))}#t=0.5" muted preload="metadata"></video>`;
  return ic(TYPE_ICON[c.type]);
}
const monHtml = (t) => `<span class="mon" title="${{ all: '모든 모니터', primary: '주 모니터', secondary: '보조 모니터' }[t]}"><i class="${t !== 'secondary' ? 'on' : ''}"></i><i class="${t !== 'primary' ? 'on' : ''}"></i></span>`;

function renderStats() {
  const cnt = { all: contents.length, active: 0, scheduled: 0, expired: 0, disabled: 0 };
  contents.forEach((c) => cnt[c.status]++);
  $('#stats').innerHTML = Object.entries(STATUS).map(([k, s]) => `
    <button class="stat ${statusFilter === k ? 'sel' : ''}" data-st="${k}">
      <span class="ico ${k}">${ic(s.icon)}</span><span><div class="n">${cnt[k]}</div><div class="t">${s.label}</div></span>
    </button>`).join('');
}
function filtered() {
  const q = $('#q').value.trim().toLowerCase(), d = $('#fDept').value;
  return contents.filter((c) => (statusFilter === 'all' || c.status === statusFilter)
    && (!d || c.department === d) && (!q || (c.title + c.owner + c.department).toLowerCase().includes(q)));
}
function renderList() {
  renderStats();
  const list = filtered();
  const isFiltered = list.length !== contents.length;
  $('#count').textContent = `${list.length}개 표시`;
  $('#empty').classList.toggle('hidden', list.length > 0);
  $('#rows').innerHTML = list.map((c) => `
    <tr data-id="${c.id}" draggable="${isFiltered ? 'false' : 'true'}">
      <td><span class="grip" style="${isFiltered ? 'opacity:.3;cursor:default' : ''}">${ic('grip')}</span></td>
      <td><div class="tcell"><div class="thumb">${thumbHtml(c)}</div><div><div class="tt">${esc(c.title)}</div><div class="ts">${c.updated_at.slice(0, 16)} 수정</div></div></div></td>
      <td><span class="chip">${ic(TYPE_ICON[c.type])}${TYPE_LABEL[c.type]}</span></td>
      <td>${c.department || c.owner ? `<div>${esc(c.department || '-')}</div><div class="ts muted sm">${esc(c.owner)}</div>` : '<span class="muted">-</span>'}</td>
      <td><div class="period">${c.start_at || c.end_at ? `${esc(fmtDt(c.start_at) || '즉시')}<br><span class="muted">~ ${esc(fmtDt(c.end_at) || '계속')}</span>${dday(c)}` : '<span class="muted">상시 게시</span>'}</div></td>
      <td>${monHtml(c.monitor_target)}</td>
      <td class="muted">${c.duration_sec}초</td>
      <td><span class="pill ${c.status}">${STATUS[c.status].label}</span></td>
      <td><label class="switch"><input type="checkbox" data-a="toggle" ${c.enabled ? 'checked' : ''}><span></span></label></td>
      <td><div class="acts">
        <button class="icon-btn" data-a="view" title="미리보기">${ic('eye')}</button>
        <button class="icon-btn" data-a="edit" title="수정">${ic('edit')}</button>
        <button class="icon-btn danger" data-a="del" title="삭제">${ic('trash')}</button></div></td>
    </tr>`).join('');
}
['q', 'fDept'].forEach((id) => ($('#' + id).oninput = renderList));
$('#stats').onclick = (e) => { const b = e.target.closest('[data-st]'); if (b) { statusFilter = b.dataset.st; renderList(); } };

$('#rows').onclick = async (e) => {
  const btn = e.target.closest('[data-a]'); if (!btn) return;
  const id = Number(btn.closest('tr').dataset.id), a = btn.dataset.a;
  try {
    if (a === 'toggle') { await api(`/contents/${id}/enabled`, jsonOpt('PATCH', { enabled: btn.checked })); await load(); }
    else if (a === 'edit') go('form', { edit: contents.find((c) => c.id === id) });
    else if (a === 'view') go('preview', { only: id });
    else if (a === 'del') {
      const c = contents.find((x) => x.id === id);
      if (!confirm(`'${c.title}' 콘텐츠를 삭제할까요?\n업로드된 파일도 함께 삭제됩니다.`)) return;
      await api('/contents/' + id, { method: 'DELETE' }); await load(); toast('삭제되었습니다');
    }
  } catch (er) { toast(er.message, true); await load(); }
};
// 드래그로 순서 변경
let dragId = null;
$('#rows').addEventListener('dragstart', (e) => { const tr = e.target.closest('tr'); if (!tr) return; dragId = +tr.dataset.id; tr.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
$('#rows').addEventListener('dragend', () => { $$('#rows tr').forEach((r) => r.classList.remove('dragging', 'over')); dragId = null; });
$('#rows').addEventListener('dragover', (e) => { if (!dragId) return; e.preventDefault(); $$('#rows tr').forEach((r) => r.classList.remove('over')); const tr = e.target.closest('tr'); if (tr && +tr.dataset.id !== dragId) tr.classList.add('over'); });
$('#rows').addEventListener('drop', async (e) => {
  e.preventDefault();
  const tr = e.target.closest('tr'); if (!tr || !dragId) return;
  const ids = contents.map((c) => c.id), from = ids.indexOf(dragId), to = ids.indexOf(+tr.dataset.id);
  if (from < 0 || to < 0 || from === to) return;
  ids.splice(to, 0, ids.splice(from, 1)[0]);
  try { await api('/contents/reorder', jsonOpt('POST', { ids })); await load(); toast('순서가 변경되었습니다'); } catch (er) { toast(er.message, true); }
});

// ---------- 등록/수정 ----------
const form = $('#form');
$('#types').innerHTML = TYPES.map((t) => `<button type="button" class="type" data-t="${t.v}">${ic(t.icon)}<b>${t.name}</b><small>${t.desc}</small></button>`).join('');
$('#presets').onclick = (e) => {
  const b = e.target.closest('[data-d]'); if (!b) return;
  const d = +b.dataset.d, pad = (n) => String(n).padStart(2, '0');
  const f = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  if (d === 0) { form.start_at.value = ''; form.end_at.value = ''; }
  else { const s = new Date(), en = new Date(s.getTime() + d * 86400000); en.setHours(23, 59, 0, 0); form.start_at.value = f(s); form.end_at.value = f(en); }
};
// 화면 맞춤 카드: 종류/방식에 따라 필요한 항목만 표시
const scaleFixed = () => form.scale_mode.value === 'fixed';
function syncFit() {
  const t = form.type.value, isHtml = t === 'html' || t === 'web_url';
  $('#htmlFit').classList.toggle('hidden', !isHtml);
  $('#baseBox').classList.toggle('hidden', !(isHtml && scaleFixed()));
  $('#fitField').classList.toggle('hidden', isHtml && !scaleFixed());
  $('#fitField').style.marginTop = isHtml ? '16px' : '0';
}
$('#basePreset').onchange = (e) => {
  if (e.target.value === 'custom') return;
  const [w, h] = e.target.value.split('x'); form.base_w.value = w; form.base_h.value = h;
};
function syncPreset() {
  const v = `${form.base_w.value}x${form.base_h.value}`;
  $('#basePreset').value = [...$('#basePreset').options].some((o) => o.value === v) ? v : 'custom';
}
function setType(t) {
  form.type.value = t; syncFit();
  $$('.type').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
  const isUrl = t.endsWith('_url');
  $('#fileWrap').classList.toggle('hidden', isUrl);
  $('#urlWrap').classList.toggle('hidden', !isUrl);
  $('#fileHint').textContent = FILE_HINT[t] ? ` (${FILE_HINT[t]})` : '';
  $('#dropSub').textContent = FILE_HINT[t] || '';
  updateFormPreview();
}
$('#types').onclick = (e) => {
  const b = e.target.closest('[data-t]'); if (!b) return;
  form.file.value = ''; $('#fname').textContent = ''; setType(b.dataset.t);
};
const drop = $('#drop');
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) { form.file.files = e.dataTransfer.files; onFile(); } });
form.file.onchange = onFile;
function onFile() {
  const f = form.file.files[0];
  $('#fname').textContent = f ? `${f.name} (${(f.size / 1048576).toFixed(1)}MB)` : '';
  if (f && !form.title.value) form.title.value = f.name.replace(/\.[^.]+$/, '');
  updateFormPreview();
}
function resetForm() {
  form.reset(); form.id.value = ''; editing = null;
  $('#formTitle').textContent = '콘텐츠 등록'; $('#formSub').textContent = '새 스크린세이버 콘텐츠를 등록합니다.';
  $('#formErr').textContent = ''; $('#fname').textContent = ''; $('#saveBtn').textContent = '저장';
  syncPreset();
  setType('html');
}
function fillForm(c) {
  editing = c;
  $('#formTitle').textContent = '콘텐츠 수정'; $('#formSub').textContent = c.title; $('#saveBtn').textContent = '변경 저장';
  form.id.value = c.id;
  ['title', 'department', 'owner', 'start_at', 'end_at', 'duration_sec'].forEach((k) => (form[k].value = c[k]));
  form.monitor_target.value = c.monitor_target;
  form.enabled.checked = c.enabled;
  form.url.value = c.type.endsWith('_url') ? c.source : '';
  form.fit.value = c.fit || 'contain';
  form.scale_mode.value = c.base_w > 0 ? 'fixed' : 'responsive';
  if (c.base_w > 0) { form.base_w.value = c.base_w; form.base_h.value = c.base_h; }
  syncPreset();
  setType(c.type);
  if (!c.type.endsWith('_url')) $('#fname').textContent = '현재 파일 유지 (새 파일을 선택하면 교체됩니다)';
}
form.oninput = (e) => {
  const n = e.target.name;
  if (['scale_mode', 'fit', 'base_w', 'base_h'].includes(n)) { syncFit(); if (n.startsWith('base')) syncPreset(); }
  if (['url', 'file', 'scale_mode', 'fit', 'base_w', 'base_h'].includes(n)) updateFormPreview();
};
$('#basePreset').addEventListener('change', updateFormPreview);
form.onsubmit = async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  fd.set('enabled', form.enabled.checked ? 'true' : 'false');
  if (!scaleFixed()) { fd.set('base_w', '0'); fd.set('base_h', '0'); } // 반응형 = 기준 해상도 없음
  const id = form.id.value; $('#saveBtn').disabled = true;
  try {
    await api(id ? '/contents/' + id : '/contents', { method: id ? 'PUT' : 'POST', body: fd });
    editing = null; await load(); go('list'); toast(id ? '변경되었습니다' : '등록되었습니다');
  } catch (er) { $('#formErr').textContent = er.message; }
  $('#saveBtn').disabled = false;
};
$('#cancelBtn').onclick = () => go('list');

// 실시간 미리보기 (폼)
let blobUrl = null;
function formItem() {
  const t = form.type.value, f = form.file.files[0];
  const opt = { fit: form.fit.value, baseW: scaleFixed() ? +form.base_w.value : 0, baseH: scaleFixed() ? +form.base_h.value : 0 };
  if (t.endsWith('_url')) return form.url.value.startsWith('http') ? { kind: kindOf(t), url: form.url.value, ...opt } : null;
  if (f) {
    if (t === 'html') return /\.html?$/i.test(f.name) ? { kind: 'html-blob', file: f, ...opt } : { note: 'ZIP은 저장 후 미리보기할 수 있습니다' };
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = URL.createObjectURL(f); return { kind: kindOf(t), url: blobUrl, ...opt };
  }
  if (editing && editing.type === t) return { ...toPlayItem(editing), ...opt };
  return null;
}
function updateFormPreview() {
  const it = formItem(), box = $('#formPv');
  $('#pvNote').textContent = '';
  if (!it || it.note) { box.innerHTML = `<div class="ph">${ic('monitor')}<span>${esc(it?.note || '파일 또는 URL을 지정하면 여기에 표시됩니다')}</span></div>`; return; }
  box.innerHTML = ''; box.appendChild(mediaEl(it));
  $('#pvNote').textContent = 'JS/CSS가 포함된 HTML은 실제 스크린세이버와 동일하게 실행됩니다.';
}

// ---------- 미리보기 엔진 (모니터별 독립 순환) ----------
const kindOf = (t) => (t.startsWith('image') ? 'image' : t.startsWith('video') ? 'video' : 'web');
const toPlayItem = (c) => ({ id: c.id, title: c.title, kind: kindOf(c.type), url: srcOf(c), monitor: c.monitor_target, duration: c.duration_sec, type: c.type, fit: c.fit, baseW: c.base_w, baseH: c.base_h });
// 클라이언트(player.js)와 동일한 맞춤 규칙: 이미지/영상은 contain|cover, HTML은 반응형 또는 기준 해상도 확대·축소
function mediaEl(item) {
  const fitMode = item.fit === 'cover' ? 'cover' : 'contain';
  if (item.kind === 'image') { const el = document.createElement('img'); el.src = item.url; el.style.objectFit = fitMode; return el; }
  if (item.kind === 'video') {
    const el = document.createElement('video'); Object.assign(el, { src: item.url, muted: true, autoplay: true, loop: true, playsInline: true });
    el.style.objectFit = fitMode; return el;
  }
  const frame = document.createElement('iframe'); frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  if (item.kind === 'html-blob') { const r = new FileReader(); r.onload = () => (frame.srcdoc = r.result); r.readAsText(item.file); }
  else frame.src = item.url;
  const bw = item.baseW | 0, bh = item.baseH | 0;
  if (!(bw > 0 && bh > 0)) return frame; // 반응형: 화면 크기 그대로
  const wrap = document.createElement('div'); wrap.style.overflow = 'hidden';
  frame.style.cssText = `position:absolute;left:0;top:0;width:${bw}px;height:${bh}px;border:0;transform-origin:0 0;background:#000`;
  wrap.appendChild(frame);
  const fitFrame = () => {
    const W = wrap.clientWidth, H = wrap.clientHeight; if (!W || !H) return;
    const s = fitMode === 'cover' ? Math.max(W / bw, H / bh) : Math.min(W / bw, H / bh);
    frame.style.transform = `translate(${(W - bw * s) / 2}px,${(H - bh * s) / 2}px) scale(${s})`;
  };
  new ResizeObserver(fitFrame).observe(wrap);
  return wrap;
}
const pv = {
  paused: false, mons: [], tick: null,
  start(only) {
    this.stop();
    const scope = $('#pvScope').value;
    let list = contents.filter((c) => scope === 'all' || c.status === 'active').map(toPlayItem);
    if (only) list = contents.filter((c) => c.id === only).map(toPlayItem);
    const queues = [list.filter((i) => i.monitor !== 'secondary'), list.filter((i) => i.monitor !== 'primary')];
    $('#monitors').innerHTML = queues.map((_, i) => `
      <div class="device">
        <div class="bezel"><div class="pv-screen" id="ps${i}"></div></div><div class="stand"></div><div class="base"></div>
        <div class="dlabel"><span class="badge-n">${i + 1}</span>${i ? '보조 모니터' : '주 모니터'}</div>
        <div class="now"><div><span class="muted sm">지금 재생</span><b id="pn${i}">-</b></div><span class="muted sm" id="pt${i}"></span></div>
        <div class="bar"><i id="pb${i}"></i></div>
        <div class="queue" id="pq${i}"></div>
      </div>`).join('');
    this.mons = queues.map((q, i) => ({ q, i, idx: -1, el: 0, cur: null }));
    this.mons.forEach((m) => { this.renderQueue(m); this.next(m); });
    const total = list.length;
    $('#pvInfo').textContent = only ? '선택한 콘텐츠 1개 미리보기' : `총 ${total}개 콘텐츠 · 모니터 1: ${queues[0].length}개 / 모니터 2: ${queues[1].length}개`;
    this.paused = false; this.syncToggle();
    this.tick = setInterval(() => this.step(), 100);
  },
  stop() { clearInterval(this.tick); this.tick = null; this.mons = []; },
  renderQueue(m) {
    $('#pq' + m.i).innerHTML = m.q.length ? m.q.map((it, k) => `<button type="button" class="q" data-k="${k}"><div class="thumb">${it.kind === 'image' ? `<img src="${esc(it.url)}" alt="">` : ic(it.kind === 'video' ? 'video' : it.kind === 'web' && it.type === 'html' ? 'code' : 'globe')}</div><span>${esc(it.title)}</span></button>`).join('') : '<span class="muted sm">이 모니터에 표시할 콘텐츠가 없습니다</span>';
  },
  next(m, to) {
    const scr = $('#ps' + m.i);
    if (!m.q.length) { scr.innerHTML = `<div class="ph">${ic('monitor')}<span>표시할 콘텐츠 없음</span></div>`; return; }
    m.idx = to != null ? to : (m.idx + 1) % m.q.length; m.el = 0; m.cur = m.q[m.idx];
    scr.innerHTML = ''; scr.appendChild(mediaEl(m.cur));
    $('#pn' + m.i).textContent = m.cur.title;
    $$('#pq' + m.i + ' .q').forEach((b, k) => b.classList.toggle('on', k === m.idx));
    this.paused && scr.firstChild.pause && scr.firstChild.pause();
  },
  step() {
    if (this.paused) return;
    this.mons.forEach((m) => {
      if (!m.cur) return;
      m.el += 100;
      const dur = Math.max(1, m.cur.duration) * 1000;
      $('#pb' + m.i).style.width = Math.min(100, m.el / dur * 100) + '%';
      $('#pt' + m.i).textContent = `${Math.min(Math.floor(m.el / 1000), m.cur.duration)} / ${m.cur.duration}초`;
      if (m.el >= dur) { if (m.q.length > 1) this.next(m); else m.el = dur; }
    });
  },
  syncToggle() {
    $('#pvToggle').firstChild.innerHTML = ic(this.paused ? 'play' : 'pause');
    $('#pvToggleT').textContent = this.paused ? '재생' : '일시정지';
  },
};
$('#pvToggle').onclick = () => {
  pv.paused = !pv.paused; pv.syncToggle();
  $$('#monitors video').forEach((v) => (pv.paused ? v.pause() : v.play()));
};
$('#pvNext').onclick = () => pv.mons.forEach((m) => pv.next(m));
$('#pvRestart').onclick = () => pv.start();
$('#pvScope').onchange = () => pv.start();
$('#pvAspect').onchange = (e) => $('#monitors').style.setProperty('--ar', e.target.value);
$('#monitors').onclick = (e) => {
  const b = e.target.closest('.q'); if (!b) return;
  const i = +b.parentElement.id.slice(2), m = pv.mons[i]; pv.next(m, +b.dataset.k);
};

hydrateIcons();
boot();
