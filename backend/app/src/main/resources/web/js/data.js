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
        // Weighted status: Mostly Present
        let status = "출석";
        const r = Math.random();
        if (r > 0.85) status = "지각";
        if (r > 0.95) status = "결석";

        // Random Risk Factors
        let risk_factors = [];
        if (Math.random() > 0.8) {
            risk_factors.push(getRandomItem(RISK_FACTORS_POOL));
        }

        return {
            id: id,
            name: name,
            status: status, // 출석, 지각, 결석
            mbti: getRandomItem(MBTI_TYPES),
            score: getRandomItem(SCORES),
            career: getRandomItem(CAREERS),
            risk_factors: risk_factors,
            memo: "",
            // Additional fields for simulation
            team_id: null,
            seat_index: null 
        };
    });
}

// Global Store for Mock Data
// In a real app, this would be fetched from a server. 
// For this PoC, we initialize it in localStorage if not present, to persist changes across pages.
let globalStudents = [];

const STUDENTS_STORAGE_KEY = 'skala_bootcamp_students';

function initData() {
    const stored = localStorage.getItem(STUDENTS_STORAGE_KEY);
    if (stored) {
        globalStudents = JSON.parse(stored);
    } else {
        globalStudents = generateMockStudents();
        saveData();
    }
    console.log("Mock Data Initialized:", globalStudents.length, "students");
}

function saveData() {
    localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(globalStudents));
}

// Ensure data is initialized on load
initData();

// Mock API Call Wrapper
async function mockApiCall(callback, delay = 500) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                const result = callback();
                resolve(result);
            } catch (e) {
                reject(e);
            }
        }, delay);
    });
}
