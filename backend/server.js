const express = require('express');
const cors = require('cors');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
const upload = multer();
const PORT = process.env.PORT || 3000;

// CORS 설정 - 모든 도메인 허용
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 이메일 전송 설정 - zzoomcctv@gmail.com에서 발송
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // zzoomcctv@gmail.com
    pass: process.env.EMAIL_PASS  // Gmail 앱 비밀번호
  }
});

// Google Sheets API 설정
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID; // 2025 견적문의 시트 ID

// 폼 데이터 저장용 배열 (백업용)
let formSubmissions = [];

// Google Sheets에 데이터 추가
async function appendToSheet(rowData) {
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: '2026!A:Z', // 실제 시트 탭 이름
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [rowData]
      }
    });
    console.log('Google Sheets에 데이터 저장 완료');
    return true;
  } catch (error) {
    console.error('Google Sheets 저장 실패:', error.message);
    console.error('상세 에러:', JSON.stringify(error.errors || error.response?.data || error, null, 2));
    return false;
  }
}

// 견적 신청 폼 처리 엔드포인트
app.post('/api/estimate', upload.none(), async (req, res) => {
  try {
    const formData = req.body;
    const now = new Date();
    const timestamp = now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    
    // 폼 데이터 추출
    const subject = formData.subject || '';      // 시/도
    const topic = formData.topic || '';          // 구/군
    const address = formData.address || '';      // 상세주소
    const rType = formData.place || formData.rType || '';  // 장소 타입
    const quan = formData.quan || '';            // 수량
    const rInt = formData.intExist || formData.rInt || ''; // 인터넷
    const phoneA = formData['번호a'] || '010';   // 전화번호 앞자리
    const phoneB = formData.b || '';             // 전화번호 중간
    const phoneC = formData.c || '';             // 전화번호 뒷자리
    const ktMark = formData.ktMark || '';        // 인입경로
    const howPay = formData.howPay || '';        // 결제방식

    const fullPhone = `${phoneA}-${phoneB}-${phoneC}`;
    const fullAddress = `${subject} ${topic} ${address}`.trim();
    
    // 데이터 구조화
    const submission = {
      id: Date.now(),
      timestamp: timestamp,
      phone: fullPhone,
      quantity: quan,
      location: fullAddress,
      placeType: rType,
      internet: rInt,
      paymentMethod: howPay,
      ktMark: ktMark,
      rawData: formData
    };
    
    // 메모리에 저장 (백업용)
    formSubmissions.push(submission);
    
    console.log('=== 새 견적 신청 ===');
    console.log('시간:', timestamp);
    console.log('전화번호:', fullPhone);
    console.log('수량:', quan);
    console.log('주소:', fullAddress);
    console.log('설치장소:', rType);
    console.log('인터넷:', rInt);
    console.log('인입경로:', ktMark);
    console.log('==================');

    // Google Sheets에 저장
    const sheetRow = [
      timestamp,           // A: . (시간)
      ktMark || 'KT',      // B: 경로 (기본값: KT)
      '010',               // C: 번호
      phoneB,              // D: 앞4
      phoneC,              // E: 뒤4
      '',                  // F: TRUE (빈칸)
      quan,                // G: 댓수
      rType,               // H: 타입
      rInt,                // I: 인터넷
      topic,               // J: 시
      address,             // K: 동
      subject              // L: 도
    ];
    
    if (SPREADSHEET_ID) {
      await appendToSheet(sheetRow);
    }

    // 이메일 발송 - 2hh9732@gmail.com, yulialee217@gmail.com로 전송
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        const emailSubject = `[(new)KT 신규] ${subject} ${topic} ${address} ${rType} 카메라 ${quan} 견적 인터넷: ${rInt}`;
        
        const emailBody = `시간: ${timestamp}

번호: ${phoneA}-${phoneB}-${phoneC}

설치 희망 댓수: ${quan}

주소: ${subject} ${topic} ${address}

장소: ${rType}

인터넷: ${rInt}

인입경로: ${ktMark}`;

        await transporter.sendMail({
          from: process.env.EMAIL_USER, // zzoomcctv@gmail.com
          to: '2hh9732@gmail.com, yulialee217@gmail.com',
          subject: emailSubject,
          text: emailBody
        });
        console.log('이메일 알림 전송 완료');
      } catch (emailError) {
        console.error('이메일 전송 실패:', emailError);
      }
    }

    res.status(200).json({ 
      success: true, 
      message: '견적 신청이 접수되었습니다.',
      id: submission.id 
    });
    
  } catch (error) {
    console.error('폼 처리 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.' 
    });
  }
});

// 접수 목록 조회 (관리자용)
app.get('/api/submissions', (req, res) => {
  res.json(formSubmissions);
});

// 헬스체크 엔드포인트
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'KT 견적 신청 API 서버 실행중' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// 진단 엔드포인트 - Google Sheets 연결 상태 확인
app.get('/api/diagnose', async (req, res) => {
  const diagnosis = {
    timestamp: new Date().toISOString(),
    server: 'running',
    email: {
      configured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS),
      user: process.env.EMAIL_USER ? process.env.EMAIL_USER.replace(/(.{3}).*(@.*)/, '$1***$2') : 'NOT SET'
    },
    googleSheets: {
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID ? 'SET (hidden)' : 'NOT SET',
      serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 'NOT SET',
      privateKey: process.env.GOOGLE_PRIVATE_KEY ? 'SET (hidden)' : 'NOT SET',
      connectionTest: null,
      error: null
    }
  };

  // Google Sheets 연결 테스트
  if (process.env.GOOGLE_SPREADSHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    try {
      const testAuth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      
      const testSheets = google.sheets({ version: 'v4', auth: testAuth });
      
      // 스프레드시트 정보 가져오기 시도
      const spreadsheetInfo = await testSheets.spreadsheets.get({
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID
      });
      
      diagnosis.googleSheets.connectionTest = 'SUCCESS';
      diagnosis.googleSheets.spreadsheetTitle = spreadsheetInfo.data.properties.title;
      diagnosis.googleSheets.sheets = spreadsheetInfo.data.sheets.map(s => s.properties.title);
      
    } catch (error) {
      diagnosis.googleSheets.connectionTest = 'FAILED';
      diagnosis.googleSheets.error = {
        message: error.message,
        code: error.code,
        details: error.errors || error.response?.data?.error || null
      };
    }
  } else {
    diagnosis.googleSheets.connectionTest = 'SKIPPED - Missing credentials';
  }

  res.json(diagnosis);
});

// Google Sheets 테스트 쓰기
app.post('/api/test-sheet', async (req, res) => {
  if (!process.env.GOOGLE_SPREADSHEET_ID) {
    return res.status(400).json({ success: false, error: 'GOOGLE_SPREADSHEET_ID not set' });
  }

  try {
    const timestamp = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const testRow = [timestamp, '테스트', '010', '0000', '0000', '', '테스트', '테스트', '테스트', '테스트', '테스트', '테스트'];
    
    const result = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: '2026!A:Z',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [testRow]
      }
    });

    res.json({ 
      success: true, 
      message: 'Test row written successfully',
      updatedRange: result.data.updates?.updatedRange
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.errors || error.response?.data?.error || null
    });
  }
});

app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행중입니다.`);
});
