# 백엔드 요구사항 명세서 (Backend Requirements Specification)

## 1. 프로젝트 개요
본 문서는 부트캠프 관리 지능화 서비스(Bootcamp Management Intelligence Service)의 MVP 모델을 실제 서비스로 구현하기 위한 백엔드 개발 명세서입니다. 이 시스템은 AI 기술을 활용하여 자리 배치, 팀 빌딩, 서류 검증 업무를 자동화하는 것을 목표로 합니다.

## 2. 제안 기술 스택
- **Language**: Python (FastAPI 또는 Django) - AI 라이브러리 연동 용이성.
- **Database**: PostgreSQL (관계형 데이터) + Redis (캐싱/세션).
- **Storage**: AWS S3 또는 Google Cloud Storage (증빙 서류 파일 저장).
- **AI/ML**: Python (Scikit-learn, PyTorch) 또는 OpenAI API (LLM 분석).

---

## 3. 데이터베이스 스키마 (Conceptual ERD)

### `users` (관리자)
- `id` (PK, UUID): 고유 ID
- `email` (Unique): 로그인 이메일
- `password_hash`: 암호화된 비밀번호
- `name`: 이름
- `role`: 권한 (ADMIN, MANAGER)

### `students` (수강생)
- `id` (PK, UUID)
- `name`: 이름
- `cohort_id` (FK): 소속 기수 ID
- `mbti`: MBTI 유형 (VARCHAR)
- `career_level`: 경력 (신입, 1년차 등)
- `status`: 출결 상태 (출석, 지각, 결석)
- `risk_factors`: 위험 요소 (JSON Array) - 예: `["과거 갈등 이력", "성적 하위권"]`
- `scores`: 과목별 성적 (JSON) - 예: `{"python": "A", "web": "B"}`
- `manager_memo`: 매니저 비고 (TEXT)

### `teams` (프로젝트 팀)
- `id` (PK, UUID)
- `name`: 팀명 (Team A)
- `members`: 팀원 ID 목록 (JSON)
- `survival_probability`: AI 예측 생존율 (Float)
- `manager_comment`: AI 분석 또는 매니저 코멘트

### `documents` (공가/병가 서류)
- `id` (PK, UUID)
- `student_id` (FK)
- `type`: 병가/공가 구분
- `file_url`: 파일 저장 경로
- `apply_date`: 신청일
- `status`: 상태 (대기, 승인, 반려, 확인필요)
- `ocr_data`: AI 추출 데이터 (날짜, 키워드)
- `rejection_reason`: 반려 사유

---

## 4. API 상세 명세 (RESTful)

### 4.1. 인증 (Authentication)

#### **1. 회원가입 (Register)**
- **Endpoint**: `POST /api/auth/register`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "email": "manager@skala.cloud",
    "password": "secure_password",
    "auth_code": "SKALA2026", // 기업 인증 코드
    "name": "홍길동"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "id": "uuid-...",
    "message": "회원가입이 완료되었습니다."
  }
  ```
- **Validation**:
  - `email`: 중복 여부 확인
  - `auth_code`: 유효한 코드인지 검증 (Server Config 관리)

#### **2. 로그인**
- **Endpoint**: `POST /api/auth/login`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "email": "manager@skala.cloud",
    "password": "secure_password"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "token_type": "bearer",
    "user_name": "홍길동"
  }
  ```

#### **2. 내 정보 조회**
- **Endpoint**: `GET /api/auth/me`
- **Headers**: 
  - `Authorization`: `Bearer <access_token>`
- **Request**: 없음
- **Response (200 OK)**:
  ```json
  {
    "id": 1,
    "email": "manager@skala.cloud",
    "name": "홍길동",
    "role": "MANAGER"
  }
  ```

---

### 4.2. 대시보드 및 수강생 관리 (Students)

#### **1. 수강생 목록 조회**
- **Endpoint**: `GET /api/students`
- **Headers**: `Authorization: Bearer <token>`
- **Request Params**: 
  - `page`: 1 (Optional)
  - `status`: "결석" (Optional, 필터링)
  - `name`: "김" (Optional, 검색)
- **Response (200 OK)**:
  ```json
  {
    "total": 34,
    "data": [
      {
        "id": 101,
        "name": "김민수",
        "status": "출석",
        "risk_factors": ["성적 하위권"],
        "mbti": "ISTJ"
      }
    ]
  }
  ```

#### **2. 수강생 상세 정보 및 메모 수정**
- **Endpoint**: `PATCH /api/students/{id}/memo`
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "memo": "면담 결과, 학습 의지가 매우 높음."
  }
  ```
- **Response (200 OK)**:
  ```json
  { "success": true, "student_id": 101, "updated_at": "2026-01-09T10:00:00Z" }
  ```
- **Validation**:
  - `memo` 키는 필수 (값은 빈 문자열 허용)

---

### 4.3. 자리 배치 관리 (Seat Management) - AI Core

#### **1. AI 자동 배치 요청**
- **Endpoint**: `POST /api/seats/auto-arrange`
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "cohort_id": 1,
    "constraints": {
      "avoid_conflict": true,  // 갈등 이력 인원 분리 여부
      "mix_gender": false      // 성별 혼합 여부 (예시)
    }
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "layout_id": "uuid-new-layout",
    "seats": [
      { "seat_index": 0, "student_id": 105, "student_name": "이서준" },
      { "seat_index": 1, "student_id": 112, "student_name": "박지훈" }
      // ... 34명 데이터
    ],
    "ai_analysis": {
      "risk_count": 0,
      "message": "갈등 이력이 있는 A와 B를 최대한 멀리 배치했습니다."
    }
  }
  ```

#### **2. 현재 배치 저장**
- **Endpoint**: `PUT /api/seats/current`
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "layout": [105, 112, 101, null, ...] // 좌석 순서대로 학생 ID 배열
  }
  ```
- **Response (200 OK)**:
  ```json
  { "success": true }
  ```

---

### 4.4. 팀 빌딩 (Team Building) - AI Core

#### **1. 팀 생존율 시뮬레이션**
- **Endpoint**: `POST /api/teams/simulate`
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "members": [101, 105, 108, 120, 125, 130] // 한 팀에 속한 학생 ID 목록
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "team_name": "Team Custom",
    "probability": 85.5,
    "grade": "SAFE", // SAFE, WARNING, DANGER
    "comment": "리더 성향(ENTJ) 학생이 있어 진행이 원활할 것으로 예상되나, 개발 경력자가 부족합니다."
  }
  ```

---

### 4.5. 서류 검증 (Document Verification) - OCR Core

#### **1. 서류 제출 (학생용)**
- **Endpoint**: `POST /api/documents/submit`
- **Headers**: `Content-Type: multipart/form-data`
- **Request**:
  - `student_name`: "홍길동"
  - `apply_date`: "2026-05-15"
  - `file`: (Binary File)
- **Response (201 Created)**:
  ```json
  { "document_id": "doc_12345", "status": "PENDING" }
  ```

#### **2. OCR 분석 결과 조회 (매니저용)**
- **Endpoint**: `GET /api/documents`
- **Headers**: `Authorization: Bearer <token>`
- **Request Params**: `status=PENDING` (처리 대기 중인 건만 조회)
- **Response (200 OK)**:
  ```json
  [
    {
      "id": "doc_12345",
      "student_name": "홍길동",
      "type": "병가",
      "ocr_result": {
        "extracted_date": "2026-05-15",
        "keywords_found": ["진단서", "병원"],
        "match_status": "MATCH" // MATCH, MISMATCH
      },
      "ai_recommendation": "GREEN", // GREEN(자동승인), RED(검토필요)
      "file_url": "https://s3.bucket..."
    }
  ]
  ```

---

## 5. AI 서비스 요구사항 상세

### 5.1. 자리 배치 엔진 (Seat AI)
- **알고리즘**: 유전 알고리즘 (Genetic Algorithm) 또는 제약 조건 충족(CSP).
- **목표 함수**: 
  - Risk 점수 최소화 (갈등 이력 인접 시 페널티).
  - 학습 효율 점수 최대화 (성적 상/하 인원 골고루 분배).

### 5.2. 팀 빌딩 예측 모델 (Team AI)
- **Features**: 
  - 리더십 유무 (MBTI E_TJ 등).
  - 기술 스택 점수 합계.
  - 남녀 성비 및 전공/비전공 비율.
- **Output**: 0~100 사이의 성공 확률 점수 및 LLM 기반의 한 줄 평.

### 5.3. 서류 OCR 검증기
- **도구**: AWS Textract / Naver Clover OCR / Google Cloud Vision.
- **로직**:
  1. 이미지에서 날짜 텍스트 추출 (YYYY-MM-DD 형식 정규식).
  2. 신청 날짜와 추출 날짜 비교 (일치 시 Pass).
  3. 금지 키워드("여행", "토익", "단순휴식")가 포함되어 있는지 검사.
  4. 위 조건에 따라 Traffic Light(Green/Red) 판정.
