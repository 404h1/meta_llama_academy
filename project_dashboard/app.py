import json
import calendar
from flask import Flask, render_template, jsonify, request
from datetime import datetime

app = Flask(__name__)

@app.context_processor
def inject_datetime():
    return dict(datetime=datetime)

def load_data(filename):
    try:
        with open(f'data/{filename}', 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []

def save_data(filename, data):
    with open(f'data/{filename}', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

@app.route('/')
def my_page():
    current_user_id = 'metarama'
    year, month = 2025, 9
    today_str = f'{year}-{month:02d}-16'

    users = load_data('users.json')
    projects = load_data('projects.json')
    daily_reports = load_data('daily_reports.json')
    weekly_reports = load_data('weekly_reports.json')
    monthly_reports = load_data('monthly_reports.json')
    education_recommendations = load_data('education_recommendations.json')
    schedules = load_data('schedules.json')

    user_info = next((user for user in users if user['userId'] == current_user_id), None)
    if not user_info:
        return "사용자 정보를 찾을 수 없습니다.", 404

    user_projects = [p for p in projects if p['projectCode'] in user_info.get('assignedProjects', [])]
    for project in user_projects:
        project['my_tasks'] = [t['taskName'] for t in project['tasks'] if user_info['userName'] in t['assignedTo']]

    user_schedule_data = next((s for s in schedules if s['userId'] == current_user_id and s['date'] == today_str), None)
    today_schedule = { "오전": [], "오후": [] }
    if user_schedule_data:
        for item in user_schedule_data['schedules']:
            if item['period'] in today_schedule:
                today_schedule[item['period']].append(item)

    user_daily_reports = [r for r in daily_reports if r['userId'] == current_user_id]
    user_weekly_report = next((r for r in weekly_reports if r['userId'] == current_user_id), None)
    user_monthly_report = next((r for r in monthly_reports if r['userId'] == current_user_id), None)
    user_strengths = user_info.get('strengths', [])
    recommended_edu = [edu for edu in education_recommendations if edu['relatedStrength'] in user_strengths]

    calendar.setfirstweekday(calendar.MONDAY)
    cal = calendar.monthcalendar(year, month)
    reported_dates = {report['date'] for report in user_daily_reports}

    return render_template(
        'index.html', user=user_info, projects=user_projects,
        today_schedule=today_schedule, today_date=datetime.strptime(today_str, '%Y-%m-%d'),
        daily_reports=user_daily_reports, weekly_report=user_weekly_report,
        monthly_report=user_monthly_report, education=recommended_edu,
        calendar_weeks=cal, reported_dates=reported_dates,
        current_year=year, current_month=month,
        today_day=int(today_str.split('-')[2])
    )

@app.route('/project/<project_code>')
def project_detail(project_code):
    projects = load_data('projects.json')
    project = next((p for p in projects if p['projectCode'] == project_code), None)
    if project:
        return render_template('project_detail.html', project=project)
    return "프로젝트를 찾을 수 없습니다.", 404

@app.route('/add_schedule', methods=['POST'])
def add_schedule():
    current_user_id, today_str = 'metarama', '2025-09-16'
    new_item = request.json
    all_schedules = load_data('schedules.json')
    
    schedule_found = False
    for user_schedule in all_schedules:
        if user_schedule['userId'] == current_user_id and user_schedule['date'] == today_str:
            user_schedule['schedules'].append(new_item)
            user_schedule['schedules'].sort(key=lambda x: datetime.strptime(x['time'], '%H:%M'))
            schedule_found = True
            break
    if not schedule_found:
        all_schedules.append({"userId": current_user_id, "date": today_str, "schedules": [new_item]})
    
    save_data('schedules.json', all_schedules)
    return jsonify({"status": "success", "message": "일정이 추가되었습니다.", "schedule": new_item})

@app.route('/update_report', methods=['POST'])
def update_report():
    data = request.json
    report_id = data.get('reportId')
    target_date = data.get('date')
    tasks_text = data.get('tasks', '')
    current_user_id = 'metarama'

    all_reports = load_data('daily_reports.json')
    report_found = False
    
    lines = tasks_text.strip().split('\\n')

    new_tasks = []
    for line in lines:
        task_description = line.strip()
        if task_description:
            new_tasks.append({"task": task_description, "status": "Updated"})

    if report_id:
        for report in all_reports:
            if report.get('reportId') == report_id:
                report['tasks'] = new_tasks if new_tasks else []
                report_found = True
                break
    elif target_date:
        new_report_id = f"dr-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        new_report = {
            "reportId": new_report_id, "userId": current_user_id, "date": target_date,
            "projectCode": "개인", "tasks": new_tasks if new_tasks else []
        }
        all_reports.append(new_report)
        report_found = True

    if not report_found:
        return jsonify({"status": "error", "message": "요청을 처리할 수 없습니다."}), 404

    save_data('daily_reports.json', all_reports)
    return jsonify({"status": "success", "message": "보고서가 업데이트되었습니다."})

if __name__ == '__main__':
    app.run(debug=True)