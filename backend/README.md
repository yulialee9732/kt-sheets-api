# KT 견적 신청 백엔드

KT 견적 신청 폼 데이터를 처리하는 Node.js/Express 백엔드입니다.
- Google Sheets (2025 견적문의)에 데이터 저장
- 이메일 알림 발송 (2hh9732@gmail.com, yulialee217@gmail.com)

## Render 배포 방법

### 1. GitHub에 backend 폴더 업로드
```bash
cd backend
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/kt-backend.git
git push -u origin main
```

### 2. Render에서 새 Web Service 생성
1. [Render Dashboard](https://dashboard.render.com/) 접속
2. "New +" → "Web Service" 클릭
3. GitHub 저장소 연결
4. 설정:
   - **Name**: kt-estimate-api (원하는 이름)
   - **Region**: Singapore (또는 가까운 지역)
   - **Branch**: main
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free (무료)

### 3. 환경변수 설정 (필수)

Render Environment 탭에서 다음 변수를 설정하세요:

#### 이메일 설정
- `EMAIL_USER`: `zzoomcctv@gmail.com`
- `EMAIL_PASS`: Gmail 앱 비밀번호 ([여기서 생성](https://myaccount.google.com/apppasswords))

#### Google Sheets 설정 (yulialee217@gmail.com 계정 사용)
1. [Google Cloud Console](https://console.cloud.google.com/)에 yulialee217@gmail.com으로 로그인
2. 프로젝트 생성 후 Google Sheets API 활성화
3. 서비스 계정 생성 및 JSON 키 다운로드
4. "2025 견적문의" 시트를 서비스 계정 이메일과 공유 (편집자 권한)
5. 환경변수 설정:
   - `GOOGLE_SPREADSHEET_ID`: 시트 URL의 `/d/` 뒤 ID
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`: 서비스 계정 이메일
   - `GOOGLE_PRIVATE_KEY`: JSON 키의 private_key 값

### 4. 배포 완료
배포 완료 후 제공되는 URL (예: `https://kt-estimate-api.onrender.com`)을 
프론트엔드 코드의 `scriptURL`에 입력하세요.

## API 엔드포인트

### POST /api/estimate
견적 신청 폼 데이터 처리

### GET /api/submissions
접수된 견적 목록 조회

### GET /health
서버 상태 확인

## 로컬 테스트
```bash
npm install
npm run dev
```

서버가 http://localhost:3000 에서 실행됩니다.
