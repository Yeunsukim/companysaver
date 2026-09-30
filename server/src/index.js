const express = require('express');
const path = require('path');
const { UPLOAD_DIR } = require('./db');

const app = express();
const PORT = process.env.PORT || 8080;

app.disable('x-powered-by');
app.use('/api/admin', require('./routes/admin'));
app.use('/api', require('./routes/public'));
// 업로드된 콘텐츠(HTML/JS/CSS/이미지/동영상) 서빙 - 영상 Range 요청 지원
app.use('/content', express.static(UPLOAD_DIR, { index: false, dotfiles: 'deny' }));
app.use('/admin', express.static(path.join(__dirname, '..', 'public', 'admin')));
app.get('/', (req, res) => res.redirect('/admin/'));

app.listen(PORT, '0.0.0.0', () => console.log(`Screen Saver 서버: http://localhost:${PORT}/admin/`));
