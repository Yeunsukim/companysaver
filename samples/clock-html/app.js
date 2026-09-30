const cv = document.getElementById('c'), g = cv.getContext('2d');
function fit() { cv.width = innerWidth; cv.height = innerHeight; }
addEventListener('resize', fit); fit();
const dots = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - .5) * .0007, vy: (Math.random() - .5) * .0007 }));
function tick() {
  g.clearRect(0, 0, cv.width, cv.height);
  dots.forEach((d) => { d.x = (d.x + d.vx + 1) % 1; d.y = (d.y + d.vy + 1) % 1; });
  for (let i = 0; i < dots.length; i++) {
    const a = dots[i];
    g.fillStyle = 'rgba(120,180,255,.9)';
    g.beginPath(); g.arc(a.x * cv.width, a.y * cv.height, 2, 0, 7); g.fill();
    for (let j = i + 1; j < dots.length; j++) {
      const b = dots[j], dx = (a.x - b.x) * cv.width, dy = (a.y - b.y) * cv.height, dist = Math.hypot(dx, dy);
      if (dist < 160) { g.strokeStyle = `rgba(120,180,255,${(1 - dist / 160) * .4})`; g.beginPath(); g.moveTo(a.x * cv.width, a.y * cv.height); g.lineTo(b.x * cv.width, b.y * cv.height); g.stroke(); }
    }
  }
  const n = new Date();
  document.getElementById('time').textContent = n.toLocaleTimeString('ko-KR', { hour12: false });
  document.getElementById('date').textContent = n.toLocaleDateString('ko-KR', { dateStyle: 'full' });
  requestAnimationFrame(tick);
}
tick();
