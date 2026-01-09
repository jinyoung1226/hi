/**
 * Mock Data for Bootcamp Management Intelligence Service
 * Core Mock Data: 34 Students
 */

const NAMES = [
    "김민수", "이서준", "박지훈", "최동현", "정유진", "강수민", "조현우", "윤서연", "장민재", "임도현",
    "한지은", "오승현", "서지아", "신예은", "권민성", "황준호", "송하은", "전준영", "박도이", "김하랑",
    "이로운", "최주원", "정하윤", "강시우", "조민준", "윤아린", "장서율", "임서우", "한건우", "오연우",
    "서우진", "신민서", "권준수", "황윤우"
];

const MBTI_TYPES = ["ISTJ", "ISFJ", "INFJ", "INTJ", "ISTP", "ISFP", "INFP", "INTP", "ESTP", "ESFP", "ENFP", "ENTP", "ESTJ", "ESFJ", "ENFJ", "ENTJ"];
const SCORES = ["S", "A", "B", "C"];
const STATUSES = ["출석", "지각", "결석"];
const CAREERS = ["신입", "1년차", "2년차", "3년차"];
const RISK_FACTORS_POOL = ["과거 갈등 이력", "성적 하위권", "중도 하차 위험", "잦은 지각"];

function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateMockStudents() {
    return NAMES.map((name, index) => {
        const id = index + 1;
        let status = "출석";
        const r = Math.random();
        if (r > 0.85) status = "지각";
        if (r > 0.95) status = "결석";

        let risk_factors = [];
        if (Math.random() > 0.8) {
            risk_factors.push(getRandomItem(RISK_FACTORS_POOL));
        }

        return {
            id: id,
            name: name,
            status: status,
            mbti: getRandomItem(MBTI_TYPES),
            score: getRandomItem(SCORES),
            career: getRandomItem(CAREERS),
            risk_factors: risk_factors,
            memo: "",
            team_id: null,
            seat_index: null
        };
    });
}

// Global Store
let globalStudents = [];
const STUDENTS_STORAGE_KEY = 'skala_bootcamp_students';

// ---------------------------------------------------------
// Hybrid Data Loading Logic
// ---------------------------------------------------------

/**
 * Core function to fetch data with hybrid fallback strategy
 */
async function callApiOrFallback(endpoint, options = {}, mockFallbackFn = null) {
    // 1. Mock Mode
    if (CONFIG.ENV === 'mock') {
        console.log(`[Mock] Skipping API ${endpoint}, using fallback.`);
        return mockFallbackFn ? mockFallbackFn() : null;
    }

    // 2. Production or Hybrid -> Try API
    try {
        const url = `${CONFIG.API.BASE_URL}${endpoint}`;
        console.log(`[API] Requesting ${url}...`);

        // Timeout for faster fallback in hybrid
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

        const res = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error(`Status ${res.status}`);

        const data = await res.json();
        console.log(`[API] Success:`, data);
        return data;

    } catch (err) {
        console.warn(`[API Failed] ${err.message}`);

        // 3. Fallback if Hybrid
        if (CONFIG.ENV === 'mock-hybrid' && mockFallbackFn) {
            console.log(`[Hybrid] Recovering with Mock Data...`);
            return mockFallbackFn();
        }
        throw err; // Re-throw in production
    }
}

/**
 * Initialize Data (Async)
 * Used by all pages to load student data
 */
async function initData() {
    // Define how to get mock data
    const getLocalMock = () => {
        const stored = localStorage.getItem(STUDENTS_STORAGE_KEY);
        if (stored) return JSON.parse(stored);

        const newData = generateMockStudents();
        localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(newData));
        return newData;
    };

    // Use Hybrid Call
    // Endpoint: /students (as defined in Backend Requirements)
    const data = await callApiOrFallback('/students', {}, getLocalMock);

    globalStudents = data || [];
    console.log("Global Data Ready:", globalStudents.length, "students");
}

// NOTE: We do NOT call initData() automatically here anymore.
// Each page (HTML) must call `await initData()` at startup.
