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
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

// 인증 설정 - GOOGLE_CREDENTIALS JSON 또는 개별 환경변수 지원
let auth;
let sheets;

const getGoogleCredentials = () => {
  // 방법 1: GOOGLE_CREDENTIALS JSON 문자열 (권장)
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      return JSON.parse(process.env.GOOGLE_CREDENTIALS);
    } catch (e) {
      console.error('GOOGLE_CREDENTIALS JSON 파싱 실패:', e.message);
    }
  }
  
  // 방법 2: 개별 환경변수 (레거시)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    return {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
    };
  }
  
  return null;
};

const initializeSheets = () => {
  const credentials = getGoogleCredentials();
  
  if (!credentials || !SPREADSHEET_ID) {
    console.warn('⚠️ Google Sheets 설정이 완료되지 않았습니다.');
    return false;
  }
  
  auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  
  sheets = google.sheets({ version: 'v4', auth });
  console.log('✅ Google Sheets API 초기화 완료');
  return true;
};

// 서버 시작 시 초기화
initializeSheets();

// 시간 포맷팅 (한국 시간대, DD.MM.YYYY HH:mm)
const formatTime = (date = new Date()) => {
  const d = new Date(date);
  const options = { timeZone: 'Asia/Seoul' };
  const day = d.toLocaleString('en-US', { ...options, day: '2-digit' });
  const month = d.toLocaleString('en-US', { ...options, month: '2-digit' });
  const year = d.toLocaleString('en-US', { ...options, year: 'numeric' });
  const hour = d.toLocaleString('en-US', { ...options, hour: '2-digit', hour12: false });
  const minute = d.toLocaleString('en-US', { ...options, minute: '2-digit' });
  return `${day}.${month}.${year} ${hour}:${minute}`;
};

// 시트 ID 가져오기
const getSheetId = async (sheetName) => {
  try {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    const targetSheet = spreadsheet.data.sheets.find(
      s => s.properties.title === sheetName
    );
    return targetSheet ? targetSheet.properties.sheetId : 0;
  } catch (error) {
    console.error('시트 ID 조회 실패:', error.message);
    return 0;
  }
};

// 맨 위에 행 삽입 (헤더 다음, 2행에 삽입)
const insertRowAtTop = async (sheetName, rowData) => {
  if (!sheets || !SPREADSHEET_ID) {
    console.error('Google Sheets가 초기화되지 않았습니다.');
    return false;
  }
  
  try {
    const sheetId = await getSheetId(sheetName);
    
    // 2행에 빈 행 삽입
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: [{
          insertDimension: {
            range: {
              sheetId: sheetId,
              dimension: 'ROWS',
              startIndex: 1,  // 헤더(1행) 다음
              endIndex: 2
            },
            inheritFromBefore: false
          }
        }]
      }
    });
    
    // 2행에 데이터 쓰기
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [rowData] },
    });
    
    console.log(`✅ ${sheetName} 시트에 데이터 저장 완료 (맨 위)`);
    return true;
  } catch (error) {
    console.error(`${sheetName} 저장 실패:`, error.message);
    return false;
  }
};

// 맨 아래에 행 추가 (기존 방식)
const appendRow = async (sheetName, rowData) => {
  if (!sheets || !SPREADSHEET_ID) {
    console.error('Google Sheets가 초기화되지 않았습니다.');
    return false;
  }
  
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [rowData] }
    });
    console.log(`✅ ${sheetName} 시트에 데이터 저장 완료 (맨 아래)`);
    return true;
  } catch (error) {
    console.error(`${sheetName} 저장 실패:`, error.message);
    return false;
  }
};

// SALT 상담신청 시트에 데이터 추가
// 컬럼: 현황, 시간, 경로, 연락처, 타입, 주소, 희망날짜, 희망시간, 화소, 실외, 실내, IoT, 특수공사, 인터넷, 메모, 인입폼, IP
const addSALTConsultation = async (data) => {
  const rowData = [
    data.status || '대기중',          // A: 현황
    formatTime(),                     // B: 시간
    data.source || 'KT',              // C: 경로
    data.phone || '',                 // D: 연락처
    data.locationType || '',          // E: 타입
    data.address || '',               // F: 주소
    data.preferredDate || '',         // G: 희망날짜
    data.preferredTime || '',         // H: 희망시간
    data.resolution || '',            // I: 화소
    data.outdoorCount || '',          // J: 실외
    data.indoorCount || '',           // K: 실내
    data.iot || '',                   // L: IoT
    data.specialInstall || '',        // M: 특수공사
    data.hasInternet || '',           // N: 인터넷
    data.notes || '',                 // O: 메모
    data.formType || '',              // P: 인입 폼
    data.ip || ''                     // Q: IP
  ];
  
  return await insertRowAtTop('SALT 상담신청', rowData);
};

// 폼 데이터 저장용 배열 (백업용)
let formSubmissions = [];

// IP 주소 추출 헬퍼
const getClientIP = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         'unknown';
};

// 견적 신청 폼 처리 엔드포인트
app.post('/api/estimate', upload.none(), async (req, res) => {
  try {
    const formData = req.body;
    const clientIP = getClientIP(req);
    const timestamp = formatTime();
    
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
    
    // 추가 필드 (새 폼에서 사용)
    const resolution = formData.resolution || formData.hwazo || '';  // 화소
    const indoorCount = formData.indoor || formData.silnae || '';    // 실내 카메라
    const outdoorCount = formData.outdoor || formData.siloe || '';   // 실외 카메라
    const iot = formData.iot || '';              // IoT 옵션
    const specialInstall = formData.special || formData.teuksu || ''; // 특수공사
    const preferredDate = formData.preferredDate || formData.date || ''; // 희망날짜
    const preferredTime = formData.preferredTime || formData.time || ''; // 희망시간
    const notes = formData.notes || formData.memo || '';             // 메모

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
      ip: clientIP,
      rawData: formData
    };
    
    // 메모리에 저장 (백업용)
    formSubmissions.push(submission);
    
    console.log('=== 새 견적 신청 ===');
    console.log('시간:', timestamp);
    console.log('IP:', clientIP);
    console.log('전화번호:', fullPhone);
    console.log('수량:', quan);
    console.log('주소:', fullAddress);
    console.log('설치장소:', rType);
    console.log('인터넷:', rInt);
    console.log('인입경로:', ktMark);
    console.log('==================');

    // SALT 상담신청 시트에 저장 (경로: KT)
    if (SPREADSHEET_ID) {
      await addSALTConsultation({
        status: '대기중',
        source: 'KT',                     // 경로를 KT로 지정
        ip: clientIP,
        resolution: resolution,
        phone: fullPhone,
        address: fullAddress,
        locationType: rType,
        indoorCount: indoorCount || quan,  // 실내 카메라 수 또는 총 수량
        outdoorCount: outdoorCount,
        iot: iot,
        specialInstall: specialInstall,
        hasInternet: rInt,
        preferredDate: preferredDate,
        preferredTime: preferredTime,
        notes: notes,
        formType: '상담 신청형'           // 폼 타입
      });
    }

    // 이메일 발송 - 2hh9732@gmail.com, yulialee217@gmail.com로 전송
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        const emailSubject = `[KT 신규] ${subject} ${topic} ${address} ${rType} 카메라 ${quan} 견적 인터넷: ${rInt}`;
        
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
  const credentials = getGoogleCredentials();
  const hasCredentials = !!credentials;
  
  const diagnosis = {
    timestamp: new Date().toISOString(),
    server: 'running',
    email: {
      configured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS),
      user: process.env.EMAIL_USER ? process.env.EMAIL_USER.replace(/(.{3}).*(@.*)/, '$1***$2') : 'NOT SET'
    },
    googleSheets: {
      spreadsheetId: SPREADSHEET_ID ? 'SET (hidden)' : 'NOT SET',
      credentialsType: process.env.GOOGLE_CREDENTIALS ? 'JSON' : 
                       (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'LEGACY' : 'NOT SET'),
      serviceAccountEmail: credentials?.client_email || 'NOT SET',
      privateKey: credentials?.private_key ? 'SET (hidden)' : 'NOT SET',
      connectionTest: null,
      error: null
    }
  };

  // Google Sheets 연결 테스트
  if (SPREADSHEET_ID && hasCredentials) {
    try {
      const testAuth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      
      const testSheets = google.sheets({ version: 'v4', auth: testAuth });
      
      // 스프레드시트 정보 가져오기 시도
      const spreadsheetInfo = await testSheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID
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

// Google Sheets 테스트 쓰기 - SALT 상담신청
app.post('/api/test-sheet', async (req, res) => {
  if (!SPREADSHEET_ID || !sheets) {
    return res.status(400).json({ success: false, error: 'Google Sheets not configured' });
  }

  try {
    const clientIP = getClientIP(req);
    const result = await addSALTConsultation({
      status: '대기중',
      source: 'KT',
      ip: clientIP,
      resolution: '테스트',
      phone: '010-0000-0000',
      address: '테스트 주소',
      locationType: '테스트',
      indoorCount: '1',
      outdoorCount: '1',
      iot: '',
      specialInstall: '',
      hasInternet: 'Y',
      preferredDate: '',
      preferredTime: '',
      notes: '테스트 데이터',
      formType: '테스트'
    });

    res.json({ 
      success: result, 
      message: result ? 'Test row written to SALT 상담신청' : 'Failed to write test row'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행중입니다.`);
});
