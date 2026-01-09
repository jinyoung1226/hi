/**
 * Common Logic for Bootcamp Management Service
 */

// 1. Auth Check
function checkAuth() {
    const user = localStorage.getItem('skala_user');
    if (!user) {
        window.location.href = 'login.html';
    }
    return JSON.parse(user);
}

// 2. Sidebar Injection
function renderSidebar(activePage) {
    const sidebarHtml = `
        <nav id="sidebar">
            <div class="sidebar-header">
                <div class="d-flex align-items-center gap-2">
                    <i class="fa-solid fa-layer-group fa-lg text-dark"></i>
                    <h5 class="m-0 fw-bold text-dark">부트캠프 관리 서비스</h5>
                </div>
            </div>

            <div class="px-3 py-4 text-muted border-bottom">
                <small>접속자</small>
                <div class="text-dark fw-bold mt-1" id="userNameDisplay">매니저</div>
            </div>

            <ul class="list-unstyled components">
                <li>
                    <a href="main.html" class="${activePage === 'main' ? 'active' : ''}">
                        <i class="fa-solid fa-chart-pie"></i> 대시보드
                    </a>
                </li>
                <li>
                    <a href="seats.html" class="${activePage === 'seats' ? 'active' : ''}">
                        <i class="fa-solid fa-chair"></i> 자리 배치
                    </a>
                </li>
                <li>
                    <a href="teams.html" class="${activePage === 'teams' ? 'active' : ''}">
                        <i class="fa-solid fa-users"></i> 팀 빌딩
                    </a>
                </li>
                <li>
                    <a href="check_documents.html" class="${activePage === 'docs' ? 'active' : ''}">
                        <i class="fa-solid fa-file-signature"></i> 공가 관리
                    </a>
                </li>
            </ul>

            <div class="mt-auto p-3">
                <button id="logoutBtn" class="btn btn-outline-dark w-100 btn-sm">
                    <i class="fa-solid fa-arrow-right-from-bracket me-2"></i> 로그아웃
                </button>
            </div>
        </nav>
    `;

    // Inject sidebar before content
    const wrapper = document.querySelector('.wrapper');
    if (wrapper) {
        wrapper.insertAdjacentHTML('afterbegin', sidebarHtml);
    }

    // Set user name
    const user = checkAuth();
    const userDisplay = document.getElementById('userNameDisplay');
    if (userDisplay && user) {
        userDisplay.textContent = user.name;
    }

    // Bind Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('skala_user');
        window.location.href = 'login.html';
    });

    // Mobile Sidebar Toggle
    const toggleBtn = document.getElementById('sidebarCollapse');
    const sidebar = document.getElementById('sidebar');
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 &&
            sidebar.classList.contains('active') &&
            !sidebar.contains(e.target) &&
            !toggleBtn.contains(e.target)) {
            sidebar.classList.remove('active');
        }
    });
}

// 3. Common Modal (Profile Detail)
function getStudentById(id) {
    // globalStudents is defined in data.js
    return globalStudents.find(s => s.id == id);
}

function openProfileModal(studentId) {
    const student = getStudentById(studentId);
    if (!student) return;

    // Remove existing modal if any
    const existingModal = document.getElementById('profileModal');
    if (existingModal) existingModal.remove();

    const modalHtml = `
    <div class="modal fade" id="profileModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content border-0 shadow-lg" style="border-radius: 16px; overflow: hidden;">
                <div class="modal-header bg-primary text-white border-0">
                    <h5 class="modal-title fw-bold">
                        <i class="fa-regular fa-id-card me-2"></i> 학생 상세 정보
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body p-4 bg-light">
                    <div class="text-center mb-4">
                        <div class="avatar-circle mx-auto mb-3 d-flex align-items-center justify-content-center bg-white shadow-sm" style="width: 80px; height: 80px; border-radius: 50%;">
                            <i class="fa-solid fa-user fa-2x text-primary"></i>
                        </div>
                        <h4 class="fw-bold mb-1">${student.name}</h4>
                        <span class="badge bg-dark rounded-pill px-3">${student.career}</span>
                    </div>

                    <div class="row g-3 mb-4">
                        <div class="col-6">
                            <div class="p-3 bg-white rounded shadow-sm text-center">
                                <small class="text-muted d-block mb-1">성적 등급</small>
                                <span class="fw-bold fs-5 text-primary">${student.score}</span>
                            </div>
                        </div>
                        <div class="col-6">
                            <div class="p-3 bg-white rounded shadow-sm text-center">
                                <small class="text-muted d-block mb-1">MBTI</small>
                                <span class="fw-bold fs-5 text-dark">${student.mbti}</span>
                            </div>
                        </div>
                    </div>

                    <div class="mb-4">
                        <h6 class="fw-bold text-secondary mb-2 small text-uppercase">AI 분석 태그</h6>
                        <div class="d-flex flex-wrap gap-2">
                            ${getRandomTags(student).map(tag => `<span class="badge bg-white text-secondary border border-secondary fw-normal">#${tag}</span>`).join('')}
                        </div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label fw-bold small text-secondary">매니저 코멘트</label>
                        <textarea class="form-control border-0 shadow-sm" id="managerMemo" rows="3" placeholder="메모를 입력하세요...">${student.memo || ''}</textarea>
                    </div>
                </div>
                <div class="modal-footer border-0 bg-white p-3">
                    <button type="button" class="btn btn-light text-muted" data-bs-dismiss="modal">닫기</button>
                    <button type="button" class="btn btn-primary px-4" onclick="saveStudentMemo(${student.id})">저장</button>
                </div>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('profileModal'));
    modal.show();
}

function getRandomTags(student) {
    // Deterministic pseudo-random based on ID
    const tagsPool = ["성실함", "분위기메이커", "코드리뷰어", "발표왕", "문서달인", "알고리즘고수", "질문왕"];
    const tags = [];
    const idx1 = student.id % tagsPool.length;
    const idx2 = (student.id * 3) % tagsPool.length;
    tags.push(tagsPool[idx1]);
    if (idx1 !== idx2) tags.push(tagsPool[idx2]);
    return tags;
}

function saveStudentMemo(id) {
    const text = document.getElementById('managerMemo').value;
    const student = getStudentById(id);
    if (student) {
        student.memo = text;
        saveData(); // defined in data.js
        console.log(`[Memo Saved] Student ${id}: ${text}`);

        // Visual feedback
        const btn = document.querySelector('#profileModal .btn-primary');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> 저장됨';
        btn.classList.add('btn-success');
        btn.classList.remove('btn-primary');
        setTimeout(() => {
            const modalEl = document.getElementById('profileModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            modal.hide();
        }, 800);
    }
}
