# KT 견적 신청 백엔드

KT 견적 신청 폼 데이터를 처리하는 Node.js/Express 백엔드입니다.
- Google Sheets에 데이터 저장 (KT 상담신청, 간편견적, 댓수문자 발송 시트)
- 이메일 알림 발송 (2hh9732@gmail.com, yulialee217@gmail.com)
- 새 데이터는 헤더 바로 아래(2행)에 삽입

## 지원하는 시트 구조

### KT 상담신청 (A → N)
IP주소, 시간, 화소, 연락처, 주소, 타입, 실내, 실외, IoT, 특수공사, 인터넷, 희망날짜, 희망시간, 메모

### 간편견적 (A → O)
IP주소, 시간, 화소, 실내, 실외, IoT, 특수공사, 전환(O/X), 연락처, 주소, 타입, 인터넷, 희망날짜, 희망시간, 메모

### 댓수문자 발송 (레거시)
시간, 경로, 번호, 앞4, 뒤4, TRUE, 댓수, 타입, 인터넷, 시, 동, 도

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

#### Google Sheets 설정

**방법 1: GOOGLE_CREDENTIALS (권장)**
서비스 계정 JSON 전체를 한 줄로 입력:
- `GOOGLE_SPREADSHEET_ID`: 시트 URL의 `/d/` 뒤 ID
- `GOOGLE_CREDENTIALS`: `{"type":"service_account","project_id":"...","private_key":"...","client_email":"...","...":"..."}`

**방법 2: 개별 환경변수 (레거시)**
- `GOOGLE_SPREADSHEET_ID`: 시트 URL의 `/d/` 뒤 ID
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: 서비스 계정 이메일
- `GOOGLE_PRIVATE_KEY`: JSON 키의 private_key 값

### 4. 배포 완료
배포 완료 후 제공되는 URL (예: `https://kt-estimate-api.onrender.com`)을 
프론트엔드 코드의 `scriptURL`에 입력하세요.

## API 엔드포인트

### POST /api/estimate
KT 견적 신청 폼 데이터 처리 → **KT 상담신청** 및 **댓수문자 발송** 시트에 저장

### POST /api/quick-estimate
간편견적 폼 데이터 처리 → **간편견적** 시트에 저장

### GET /api/submissions
접수된 견적 목록 조회 (메모리 백업)

### GET /api/diagnose
Google Sheets 연결 상태 및 서버 진단 정보

### POST /api/test-sheet
댓수문자 발송 시트 테스트 쓰기

### POST /api/test-kt-sheet
KT 상담신청 시트 테스트 쓰기

### GET /health
서버 상태 확인

## 로컬 테스트
```bash
npm install
npm run dev
```

서버가 http://localhost:3000 에서 실행됩니다.

## .env 파일 예시
```env
PORT=3000
EMAIL_USER=zzoomcctv@gmail.com
EMAIL_PASS=your_app_password
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id
GOOGLE_CREDENTIALS={"type":"service_account",...}
```
