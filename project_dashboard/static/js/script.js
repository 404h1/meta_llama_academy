document.addEventListener('DOMContentLoaded', function () {
    // --- Scroll Animations --- //
    const setupScrollAnimations = () => {
        const sections = document.querySelectorAll('.content-section');
        if (!sections.length) return;
        
        // 첫 번째 섹션은 바로 보이도록 처리
        sections[0].classList.add('visible');

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, { threshold: 0.1 });

        sections.forEach(section => observer.observe(section));
    };

    // --- Original Dashboard Script (No Functional Change) --- //
    let dailyReportsData = [];
    const dailyReportsElement = document.getElementById('daily-reports-data');
    if (dailyReportsElement) {
        dailyReportsData = JSON.parse(dailyReportsElement.textContent);
    }
    
    // View Toggler
    const calendarViewBtn = document.getElementById('calendarViewBtn');
    const boxViewBtn = document.getElementById('boxViewBtn');
    const calendarView = document.getElementById('calendarView');
    const boxView = document.getElementById('boxView');

    if (calendarViewBtn) {
        calendarViewBtn.addEventListener('click', () => {
            calendarView.classList.add('active');
            boxView.classList.remove('active');
            calendarViewBtn.classList.add('active');
            boxViewBtn.classList.remove('active');
        });
        boxViewBtn.addEventListener('click', () => {
            boxView.classList.add('active');
            calendarView.classList.remove('active');
            boxViewBtn.classList.add('active');
            calendarViewBtn.classList.remove('active');
        });
    }

    // Monthly Chart
    const ctx = document.getElementById('monthlyChart');
    if (ctx) {
        const chartData = JSON.parse(ctx.dataset.chart);
        new Chart(ctx, { type: 'bar', data: { labels: chartData.labels, datasets: [{ label: '업무 진행률 (%)', data: chartData.data, backgroundColor: 'rgba(0, 123, 255, 0.6)', borderColor: 'rgba(0, 123, 255, 1)', borderWidth: 1 }] }, options: { responsive: true, scales: { y: { beginAtZero: true, max: 100 } }, plugins: { legend: { display: false } } } });
    }

    // Schedule Modal
    const scheduleModal = document.getElementById('scheduleModal');
    if (scheduleModal) {
        const openBtn = document.querySelector('.add-schedule-area .btn');
        const closeBtn = document.getElementById('closeScheduleModal');
        const form = document.getElementById('addScheduleForm');
        const openModal = () => scheduleModal.classList.add('active');
        const closeModal = () => { scheduleModal.classList.remove('active'); form.reset(); };
        openBtn.addEventListener('click', openModal);
        closeBtn.addEventListener('click', closeModal);
        scheduleModal.addEventListener('click', e => { if (e.target === scheduleModal) closeModal(); });
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const scheduleData = Object.fromEntries(new FormData(e.target).entries());
            fetch('/add_schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(scheduleData) })
            .then(res => res.json()).then(data => { if (data.status === 'success') location.reload(); else alert('Error: ' + data.message); });
        });
    }

    // Calendar Logic
    const calendarGrid = document.querySelector('.calendar-grid');
    if (calendarGrid) {
        const todayElement = document.querySelector('.calendar-day.today') || document.querySelector('.calendar-day:not(.not-in-month)');
        if (todayElement) {
            todayElement.classList.add('selected');
            updateSelectedDayReport(todayElement.dataset.date);
        }
        calendarGrid.addEventListener('click', (e) => {
            const dayElement = e.target.closest('.calendar-day:not(.not-in-month)');
            if (!dayElement) return;
            document.querySelectorAll('.calendar-day.selected').forEach(el => el.classList.remove('selected'));
            dayElement.classList.add('selected');
            updateSelectedDayReport(dayElement.dataset.date);
        });
    }

    // Calendar Save Action
    if (calendarView) {
        calendarView.addEventListener('click', (e) => {
            const saveBtn = e.target.closest('.btn-save');
            if (!saveBtn) return;
            const reportId = saveBtn.dataset.reportId || '';
            const date = saveBtn.dataset.date || '';
            const tasks = document.getElementById('calendarReportTextarea').value;
            fetch('/update_report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reportId, date, tasks }) })
            .then(res => res.json()).then(data => { if (data.status === 'success') { alert('저장되었습니다.'); location.reload(); } else { alert('오류: ' + data.message); } });
        });
    }

    // Box View Report Modal
    const editReportModal = document.getElementById('editReportModal');
    if (editReportModal && boxView) {
        const closeBtn = document.getElementById('closeEditReportModal');
        const form = document.getElementById('editReportForm');
        const closeModal = () => { editReportModal.classList.remove('active'); form.reset(); };
        closeBtn.addEventListener('click', closeModal);
        editReportModal.addEventListener('click', e => { if (e.target === editReportModal) closeModal(); });
        boxView.addEventListener('click', (e) => {
            const box = e.target.closest('.report-box.editable');
            if (box) {
                const reportId = box.dataset.reportId;
                const report = dailyReportsData.find(r => r.reportId === reportId);
                const tasksText = report ? report.tasks.map(t => t.task).join('\n') : '';
                document.getElementById('editReportId').value = reportId || '';
                document.getElementById('editReportTasks').value = tasksText;
                editReportModal.classList.add('active');
            }
        });
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const reportId = document.getElementById('editReportId').value;
            const tasks = document.getElementById('editReportTasks').value;
            fetch('/update_report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reportId, tasks }) })
            .then(res => res.json()).then(data => { if (data.status === 'success') location.reload(); else alert('오류: ' + data.message); });
        });
    }

    // --- INITIALIZE --- //
    setupScrollAnimations();
});


function updateSelectedDayReport(date) {
    const dailyReports = JSON.parse(document.getElementById('daily-reports-data').textContent);
    const report = dailyReports.find(r => r.date === date);
    const container = document.querySelector('.calendar-selected-day');
    if (!container) return;
    const [year, month, day] = date.split('-');
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][new Date(date).getUTCDay()];
    let contentHtml = `<h4>${parseInt(month, 10)}월 ${parseInt(day, 10)}일 (${dayOfWeek})</h4>`;
    if (report) {
        const tasksText = report.tasks.map(t => t.task).join('\n');
        contentHtml += `<textarea id="calendarReportTextarea" placeholder="업무 내용을 입력하세요...">${tasksText}</textarea><div class="modal-footer"><button class="btn btn-primary btn-save" data-report-id="${report.reportId}">수정</button></div>`;
    } else {
        contentHtml += `<textarea id="calendarReportTextarea" placeholder="업무 내용을 입력하세요..."></textarea><div class="modal-footer"><button class="btn btn-primary btn-save" data-date="${date}">저장</button></div>`;
    }
    container.innerHTML = contentHtml;
}