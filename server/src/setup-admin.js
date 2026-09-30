// 설치 프로그램이 호출: DB를 만들고 관리자 계정을 시드한 뒤 종료 (환경변수 DATA_DIR, ADMIN_USER, ADMIN_PASS)
require('./db');
process.exit(0);
