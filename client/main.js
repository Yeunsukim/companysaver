// Windows 스크린세이버(.scr) 진입점
//   /s  스크린세이버 실행   /c  설정   /p <hwnd> 미리보기(즉시 종료)
//   --windowed  디버그: 전체화면 대신 창 모드(모니터 수만큼 나란히)
const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const { loadConfig, saveConfig, syncPlaylist } = require('./sync');

const args = process.argv.slice(1).map((a) => a.toLowerCase());
const modeArg = args.find((a) => /^[\/-](s|c|p|a)(:|$)/.test(a)) || '';
const mode = modeArg.replace(/^[\/-]/, '')[0] || 'c'; // 인자 없으면 설정
const WINDOWED = args.includes('--windowed');

let windows = [];
let playlist = { items: [], online: true };
let quitting = false;

function quitSaver() {
  if (quitting) return;
  quitting = true;
  windows.forEach((w) => { try { w.destroy(); } catch {} });
  app.quit();
}

function createSaverWindows() {
  const displays = screen.getAllDisplays();
  const primaryId = screen.getPrimaryDisplay().id;
  displays.forEach((d, i) => {
    const role = d.id === primaryId ? 'primary' : 'secondary';
    const bounds = WINDOWED
      ? { x: 40 + i * 660, y: 60, width: 640, height: 360 }
      : d.bounds;
    const win = new BrowserWindow({
      ...bounds,
      frame: false, show: false, backgroundColor: '#000000',
      skipTaskbar: true, resizable: false, movable: false, fullscreenable: !WINDOWED,
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, autoplayPolicy: 'no-user-gesture-required' },
    });
    win.__role = role;
    if (!WINDOWED) { win.setAlwaysOnTop(true, 'screen-saver'); win.setBounds(d.bounds); }
    win.once('ready-to-show', () => { win.show(); if (!WINDOWED) win.setFullScreen(true); });
    win.loadFile('player.html', { query: { role, windowed: WINDOWED ? '1' : '' } });
    if (!WINDOWED) win.webContents.on('before-input-event', () => quitSaver());
    win.on('closed', () => { windows = windows.filter((w) => w !== win); });
    windows.push(win);
  });
}

function pushPlaylist() {
  windows.forEach((w) => { if (!w.isDestroyed()) w.webContents.send('playlist', playlist.items); });
}

async function refresh(cfg) {
  try { playlist = await syncPlaylist(cfg); pushPlaylist(); } catch (e) { console.error('[refresh]', e); }
}

function openSettings() {
  const win = new BrowserWindow({
    width: 460, height: 420, resizable: false, autoHideMenuBar: true, title: '스크린세이버 설정',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });
  win.loadFile('settings.html');
  win.on('closed', () => app.quit());
}

ipcMain.handle('config:get', () => loadConfig());
ipcMain.handle('config:save', (_e, cfg) => { saveConfig({ ...loadConfig(), ...cfg }); return true; });
ipcMain.handle('config:test', async (_e, cfg) => {
  const r = await syncPlaylist({ ...loadConfig(), ...cfg });
  return { online: r.online, count: r.items.length };
});
ipcMain.handle('playlist:get', () => playlist.items);
ipcMain.on('saver:quit', () => { if (!WINDOWED) quitSaver(); });

// 재생 목록 동기화 반복: 정상이면 설정한 주기, 서버에 못 붙었으면 1분 뒤 재시도
async function pollLoop() {
  const cfg = loadConfig();
  await refresh(cfg);
  const wait = playlist.online ? Math.max(1, cfg.pollMinutes) * 60 * 1000 : 60 * 1000;
  setTimeout(pollLoop, wait);
}

// 중복 실행 방지는 화면 보호기(/s)끼리만 적용한다. 설정 창(/c)이 열려 있어도 미리 보기·대기 실행이 막히지 않도록.
if (mode === 's' && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(() => {
    if (mode === 'p' || mode === 'a') return app.quit(); // 미리보기 창/암호 설정은 지원하지 않음
    if (mode === 'c') return openSettings();
    createSaverWindows();
    pollLoop();
  });
}

app.on('window-all-closed', () => app.quit());
