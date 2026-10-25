"""
CO-PO Attainment Web Application
Backend: Python Flask
Features: Multi-format file parsing (CSV, TSV, XLSX, Pasted), strict OBE validations,
Direct & Indirect Assessment, CO-PO Correlation Mapping, Multi-sheet Excel & Word exports.
"""

import os
import io
import re
import csv
import json
import secrets
import tempfile
from typing import Dict, Any, List, Tuple
from flask import (
    Flask, render_template, request, jsonify, session,
    send_file, redirect, url_for, abort, send_from_directory
)
from werkzeug.utils import secure_filename
import openpyxl

from calculations import (
    validate_and_compute_direct,
    validate_and_compute_indirect,
    compute_weighted_co_attainment,
    compute_po_attainment,
    parse_delimited_or_matrix_text,
    categorize_slow_fast_learners
)
from excel_export import (
    create_complete_excel_report,
    create_direct_only_excel,
    create_indirect_only_excel,
    create_copo_only_excel,
    create_students_only_excel
)
from docx_export import create_word_report
from pdf_export import create_pdf_report, create_slow_fast_learners_pdf

import mimetypes
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('application/javascript', '.js')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, 'templates'),
    static_folder=os.path.join(BASE_DIR, 'static'),
    static_url_path='/static'
)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "co_po_attainment_secret_key_2026")
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB limit
app.config['ALLOWED_EXTENSIONS'] = {'csv', 'tsv', 'txt', 'xlsx', 'xls'}


class VercelPathMiddleware:
    """Ensures incoming Vercel rewritten requests maintain their original URL path."""
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        matched_path = environ.get('HTTP_X_MATCHED_PATH') or environ.get('HTTP_X_VERCEL_FORWARDED_PATH')
        if matched_path:
            if '?' in matched_path:
                matched_path = matched_path.split('?', 1)[0]
            environ['PATH_INFO'] = matched_path
        return self.wsgi_app(environ, start_response)


app.wsgi_app = VercelPathMiddleware(app.wsgi_app)

# Session store with disk backing for serverless (e.g. Vercel) persistence across invocations
SESSION_STORAGE_DIR = os.path.join(tempfile.gettempdir(), 'co_po_sessions')
os.makedirs(SESSION_STORAGE_DIR, exist_ok=True)
TEMP_DATA_STORE: Dict[str, Dict[str, Any]] = {}


def load_session_state(sid: str) -> Dict[str, Any]:
    """Retrieves session state from memory or disk cache."""
    if sid in TEMP_DATA_STORE:
        return TEMP_DATA_STORE[sid]
    fpath = os.path.join(SESSION_STORAGE_DIR, f"{sid}.json")
    if os.path.exists(fpath):
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                TEMP_DATA_STORE[sid] = data
                return data
        except Exception:
            pass
    default_state = {
        'teacher': {
            'faculty_name': '',
            'subject': '',
            'course_type': 'theory',
            'batch': '',
            'class_name': '',
            'division': '',
            'semester': '',
            'academic_year': ''
        },
        'direct_raw': None,
        'direct_computed': None,
        'indirect_raw': None,
        'indirect_computed': None,
        'weighted_computed': None,
        'copo_mapping': None,
        'copo_computed': None
    }
    TEMP_DATA_STORE[sid] = default_state
    return default_state


def save_session_state(sid: str):
    """Saves session state to disk cache."""
    data = TEMP_DATA_STORE.get(sid)
    if data:
        fpath = os.path.join(SESSION_STORAGE_DIR, f"{sid}.json")
        try:
            with open(fpath, 'w', encoding='utf-8') as f:
                json.dump(data, f)
        except Exception:
            pass


@app.after_request
def persist_session_state(response):
    """Automatically persists modified session state after every request."""
    if 'sid' in session:
        save_session_state(session['sid'])
    return response


def get_session_id() -> str:
    if 'sid' not in session:
        session['sid'] = secrets.token_hex(16)
    sid = session['sid']
    state = load_session_state(sid)
    # If session has teacher cookie info, ensure state mirrors it
    if 'teacher' in session and isinstance(session['teacher'], dict) and session['teacher'].get('faculty_name'):
        state['teacher'] = session['teacher']
    return sid


def allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']


def parse_uploaded_file(file_obj, filename: str) -> Tuple[List[str], List[List[str]]]:
    """Parses uploaded file (CSV, TSV, TXT, XLSX) into headers and rows of strings."""
    ext = filename.rsplit('.', 1)[1].lower()
    
    if ext in ['xlsx', 'xls']:
        wb = openpyxl.load_workbook(file_obj, data_only=True)
        sheet = wb.active
        raw_rows = []
        for row in sheet.iter_rows(values_only=True):
            if any(cell is not None and str(cell).strip() != "" for cell in row):
                raw_rows.append([str(c).strip() if c is not None else "" for c in row])
        if not raw_rows:
            return [], []
        return raw_rows[0], raw_rows[1:]
    else:
        content = file_obj.read()
        for encoding in ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']:
            try:
                text = content.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        else:
            text = content.decode('utf-8', errors='ignore')
        return parse_delimited_or_matrix_text(text)


@app.route('/static/<path:filename>')
def serve_static(filename):
    """Fallback static asset server guaranteeing correct CSS/JS MIME types on serverless runtimes."""
    static_dir = os.path.join(BASE_DIR, 'static')
    mimetype = None
    if filename.endswith('.css'):
        mimetype = 'text/css'
    elif filename.endswith('.js'):
        mimetype = 'application/javascript'
    return send_from_directory(static_dir, filename, mimetype=mimetype)


# =========================================================================
# PAGE ROUTES
# =========================================================================

@app.route('/api')
@app.route('/api/index')
@app.route('/teacher')
@app.route('/')
def page1_teacher():
    """Page 1: Teacher & Course information (NO NAVBAR). Restarts session fresh by default."""
    session.clear()
    session['sid'] = secrets.token_hex(16)
    sid = session['sid']
    TEMP_DATA_STORE[sid] = {
        'teacher': {'faculty_name': '', 'subject': '', 'course_type': 'theory', 'batch': '', 'class_name': '', 'division': '', 'semester': '', 'academic_year': ''},
        'direct_raw': None, 'direct_computed': None, 'indirect_raw': None, 'indirect_computed': None,
        'weighted_computed': None, 'copo_mapping': None, 'copo_computed': None
    }
    save_session_state(sid)
    return render_template('page1_teacher.html', teacher={}, page_step=1)


@app.route('/assessment')
def page2_assessment():
    """Page 2: Direct and indirect assessment data for Theory courses."""
    sid = get_session_id()
    teacher = TEMP_DATA_STORE[sid].get('teacher', {})
    if not teacher.get('faculty_name') and 'teacher' in session:
        teacher = session['teacher']
        TEMP_DATA_STORE[sid]['teacher'] = teacher
    if teacher.get('course_type') == 'practical':
        return redirect(url_for('page2_practical'))
    return render_template('page2_assessment.html', teacher=teacher, page_step=2)


@app.route('/practical-assessment')
def page2_practical():
    """Page 2 (Practical): Dedicated Laboratory Assessment data, scratch experiment builder, and attainment."""
    sid = get_session_id()
    teacher = TEMP_DATA_STORE[sid].get('teacher', {})
    if not teacher.get('faculty_name') and 'teacher' in session:
        teacher = session['teacher']
        TEMP_DATA_STORE[sid]['teacher'] = teacher
    if teacher.get('course_type') and teacher.get('course_type') != 'practical':
        return redirect(url_for('page2_assessment'))
    return render_template('page2_practical.html', teacher=teacher, page_step=2)


@app.route('/copo')
def page3_copo():
    """Page 3: CO-PO mapping and PO attainment calculation."""
    sid = get_session_id()
    teacher = TEMP_DATA_STORE[sid].get('teacher', {})
    if not teacher.get('faculty_name') and 'teacher' in session:
        teacher = session['teacher']
        TEMP_DATA_STORE[sid]['teacher'] = teacher
    return render_template('page3_copo.html', teacher=teacher, page_step=3)


@app.route('/report')
def page4_report():
    """Page 4: Final Comprehensive Report & Downloads."""
    sid = get_session_id()
    teacher = TEMP_DATA_STORE[sid].get('teacher', {})
    if not teacher.get('faculty_name') and 'teacher' in session:
        teacher = session['teacher']
        TEMP_DATA_STORE[sid]['teacher'] = teacher
    return render_template('page4_report.html', teacher=teacher, page_step=4)


# =========================================================================
# API ENDPOINTS
# =========================================================================

@app.route('/api/reset-session', methods=['POST'])
def api_reset_session():
    """Clears current user session and in-memory/disk state."""
    session.clear()
    session['sid'] = secrets.token_hex(16)
    sid = session['sid']
    TEMP_DATA_STORE[sid] = {
        'teacher': {'faculty_name': '', 'subject': '', 'course_type': 'theory', 'batch': '', 'class_name': '', 'division': '', 'semester': '', 'academic_year': ''},
        'direct_raw': None, 'direct_computed': None, 'indirect_raw': None, 'indirect_computed': None,
        'weighted_computed': None, 'copo_mapping': None, 'copo_computed': None
    }
    save_session_state(sid)
    return jsonify({'success': True, 'message': 'Session cleared successfully.'})

@app.route('/api/save-teacher', methods=['POST'])
def api_save_teacher():
    sid = get_session_id()
    data = request.get_json(silent=True) or request.form.to_dict()
    
    faculty_name = data.get('faculty_name', '').strip()
    subject = data.get('subject', '').strip()
    
    if not faculty_name or not subject:
        return jsonify({'success': False, 'message': 'Faculty name and Subject are required.'}), 400

    course_type = data.get('course_type', 'theory').strip().lower()
    if course_type not in ['theory', 'practical']:
        course_type = 'theory'
    batch = data.get('batch', '').strip() if course_type == 'practical' else ''

    teacher_info = {
        'faculty_name': faculty_name,
        'subject': subject,
        'course_type': course_type,
        'batch': batch,
        'class_name': data.get('class_name', '').strip(),
        'division': data.get('division', '').strip(),
        'semester': data.get('semester', '').strip(),
        'academic_year': data.get('academic_year', '').strip()
    }
    TEMP_DATA_STORE[sid]['teacher'] = teacher_info
    session['teacher'] = teacher_info
    save_session_state(sid)
    target_redirect = url_for('page2_practical') if course_type == 'practical' else url_for('page2_assessment')
    return jsonify({'success': True, 'teacher': teacher_info, 'redirect': target_redirect})


@app.route('/api/sync-state', methods=['POST'])
def api_sync_state():
    """Syncs client-side state into backend session store for cross-lambda persistence."""
    sid = get_session_id()
    state_payload = request.get_json(silent=True) or {}
    
    current_state = TEMP_DATA_STORE[sid]
    if 'teacher' in state_payload and state_payload['teacher']:
        current_state['teacher'] = state_payload['teacher']
        session['teacher'] = state_payload['teacher']
    if 'direct' in state_payload and state_payload['direct']:
        current_state['direct_computed'] = state_payload['direct']
    if 'indirect' in state_payload and state_payload['indirect']:
        current_state['indirect_computed'] = state_payload['indirect']
    if 'indirect_raw' in state_payload and state_payload['indirect_raw']:
        current_state['indirect_raw'] = state_payload['indirect_raw']
    if 'weighted' in state_payload and state_payload['weighted']:
        current_state['weighted_computed'] = state_payload['weighted']
    if 'copo' in state_payload and state_payload['copo']:
        current_state['copo_computed'] = state_payload['copo']
    if 'learners' in state_payload and state_payload['learners']:
        current_state['learners_data'] = state_payload['learners']
        
    save_session_state(sid)
    return jsonify({'success': True, 'message': 'Session state synchronized successfully.'})


@app.route('/api/upload-direct', methods=['POST'])
def api_upload_direct():
    """Parses uploaded file or pasted text for direct marks."""
    sid = get_session_id()
    
    headers = []
    rows = []
    
    if 'file' in request.files and request.files['file'].filename:
        file = request.files['file']
        if not allowed_file(file.filename):
            return jsonify({'success': False, 'message': 'Unsupported file format. Please upload CSV, TSV, or XLSX.'}), 400
        headers, rows = parse_uploaded_file(file.stream, secure_filename(file.filename))
    elif 'pasted_text' in request.form and request.form['pasted_text'].strip():
        headers, rows = parse_delimited_or_matrix_text(request.form['pasted_text'])
    else:
        return jsonify({'success': False, 'message': 'No file or pasted data provided.'}), 400

    if not headers or not rows:
        return jsonify({'success': False, 'message': 'The uploaded file or text is empty.'}), 400

    # Clean headers
    headers = [str(h).strip() for h in headers]

    # Check if header row is actually numbers (headerless file)
    def _is_number(s):
        try:
            float(str(s).strip())
            return True
        except (ValueError, TypeError):
            return False

    if headers and all(_is_number(h) for h in headers if h):
        rows = [headers] + rows
        headers = [f"Assessment_{i+1}" for i in range(len(headers))]

    # Keyword lists for detection
    roll_keywords = ['roll', 'seat', 'prn', 'reg', 'serial', 'urn', 'enroll', 'srno', 'rollno', 'student_id', 'ar_no', 'arno', 'ar.no']
    roll_exact = {'sr', 'sr.', 's.no', 's.no.', 'sno', 'no', '#', 'id', 'sr no', 'sr. no', 'roll no', 'roll no.', 'seat no', 'roll_no', 'ar', 'ar no', 'ar.', 'ar. no', 'ar no.'}
    name_keywords = ['name', 'student', 'candidate']
    exam_keywords = ['test', 'exam', 'cce', 'ut', 'quiz', 'mark', 'score', 'assess', 'insem', 'prelim', 'sem', 'endsem', 'midsem', 'theory', 'practical', 'practicle', 'prac', 'pracs', 'pr', 'exp', 'expt', 'experiment', 'lab', 'oral', 'tw', 'termwork', 'co']

    h_lower = [h.lower() for h in headers]
    is_long_format = False
    if len(headers) in [3, 4] and any(any(kw in h for kw in ['assess', 'exam', 'test']) for h in h_lower) and any(any(kw in h for kw in ['mark', 'score']) for h in h_lower):
        is_long_format = True

    column_configs = []
    students_list = []

    if is_long_format:
        # Long format: find roll, name, exam, mark columns
        roll_col = next((i for i, h in enumerate(h_lower) if any(kw in h for kw in roll_keywords) or h in roll_exact), None)
        name_col = next((i for i, h in enumerate(h_lower) if any(kw in h for kw in name_keywords) and not any(kw in h for kw in exam_keywords)), None)
        exam_col = next((i for i, h in enumerate(h_lower) if any(kw in h for kw in exam_keywords)), 1)
        mark_col = next((i for i, h in enumerate(h_lower) if any(kw in h for kw in ['mark', 'score', 'obtained', 'val'])), len(headers) - 1)

        students_map = {}
        assessments_set = []

        row_counter = 0
        for row in rows:
            if len(row) <= max(exam_col, mark_col):
                continue
            exam = row[exam_col].strip()
            mark = row[mark_col].strip()
            if not exam:
                continue

            if roll_col is not None and len(row) > roll_col and row[roll_col].strip():
                roll = row[roll_col].strip()
            else:
                roll = f"{row_counter + 1}"

            if name_col is not None and len(row) > name_col and row[name_col].strip():
                name = row[name_col].strip()
            else:
                name = f"Student {roll}"

            if exam not in assessments_set:
                assessments_set.append(exam)

            if roll not in students_map:
                row_counter += 1
                students_map[roll] = {'roll_no': roll, 'name': name, 'marks': {}}
            students_map[roll]['marks'][exam] = mark

        students_list = list(students_map.values())
        assessment_cols = assessments_set
    else:
        # Wide format
        # Detect whether Serial No, Roll No, and/or Name columns exist
        sr_keywords = {'sr', 'sr.', 'sr. no', 'sr. no.', 'sr no', 'sr no.', 'sr_no', 's.no', 's.no.', 'sno', 'serial no', 'serial no.', 'serial_no', 'sl no', 'sl. no', 'slno'}
        roll_exact = {'roll', 'roll no', 'roll no.', 'roll_no', 'rollno', 'seat no', 'seat no.', 'seat_no', 'prn', 'prn no', 'prn_no', 'urn', 'reg no', 'reg_no', 'registration', 'enrollment', 'enroll', 'student_id', 'ar no', 'ar. no', 'ar_no', 'arno'}
        name_exact = {'name', 'student name', 'candidate name', 'student_name', 'student', 'candidate'}

        sr_col_idx = None
        roll_col_idx = None
        name_col_idx = None
        batch_col_idx = None

        batch_keywords = {'batch', 'batch no', 'batch no.', 'batch_no', 'lab batch', 'batch_id'}

        for i, h in enumerate(h_lower):
            is_exam = any(kw in h for kw in exam_keywords)
            if is_exam:
                continue
            if sr_col_idx is None and (h in sr_keywords or re.match(r'^sr[\s._]*no', h)):
                sr_col_idx = i
                continue
            if roll_col_idx is None and (h in roll_exact or 'roll' in h or 'seat' in h or 'prn' in h or 'arno' in h or 'ar_no' in h or re.match(r'^ar[\s._]*no', h)):
                roll_col_idx = i
                continue
            if name_col_idx is None and (h in name_exact or 'name' in h):
                name_col_idx = i
                continue
            if batch_col_idx is None and (h in batch_keywords or 'batch' in h):
                batch_col_idx = i
                continue

        # If no explicit roll column was found, but a serial number column was found, use it as roll_col_idx
        if roll_col_idx is None and sr_col_idx is not None:
            roll_col_idx = sr_col_idx

        meta_indices = set()
        for idx in [sr_col_idx, roll_col_idx, name_col_idx, batch_col_idx]:
            if idx is not None:
                meta_indices.add(idx)

        # Helper to test if a cell has valid marks
        def _has_valid_mark_value(val):
            s = str(val).strip()
            if not s or s.upper() in ['AB', 'ABS', 'ABSENT', 'NA', 'N/A', '-', '–', '—', 'X', '.']:
                return False
            try:
                float(s)
                return True
            except ValueError:
                return False

        # Filter active assessment columns:
        # A column MUST NOT be in meta_indices, and MUST have at least one valid student mark scored!
        active_col_indices = []
        for i, h in enumerate(headers):
            if i in meta_indices:
                continue
            has_marks = any(_has_valid_mark_value(r[i]) for r in rows if i < len(r))
            if has_marks:
                active_col_indices.append(i)

        # Fallback if no column had marks (e.g. testing with blank marks)
        if not active_col_indices:
            active_col_indices = [i for i, h in enumerate(headers) if i not in meta_indices and h.strip()]

        assessment_cols = [headers[i] if headers[i].strip() else f"Assessment_{i+1}" for i in active_col_indices]

        for r_idx, row in enumerate(rows, start=1):
            if roll_col_idx is not None and roll_col_idx < len(row) and row[roll_col_idx].strip():
                roll = row[roll_col_idx].strip()
            else:
                roll = str(r_idx)

            if name_col_idx is not None and name_col_idx < len(row) and row[name_col_idx].strip():
                name = row[name_col_idx].strip()
            else:
                name = f"Student {r_idx}"

            s_batch = row[batch_col_idx].strip() if batch_col_idx is not None and batch_col_idx < len(row) else ""

            marks = {}
            for i in active_col_indices:
                h_name = headers[i] if headers[i].strip() else f"Assessment_{i+1}"
                marks[h_name] = row[i].strip() if i < len(row) else ""
            student_rec = {'roll_no': roll, 'name': name, 'marks': marks}
            if s_batch:
                student_rec['batch'] = s_batch
            students_list.append(student_rec)

    # Build smart default column configurations for each assessment
    standard_ceilings = [5.0, 10.0, 15.0, 20.0, 25.0, 30.0, 40.0, 50.0, 60.0, 70.0, 75.0, 80.0, 100.0]

    teacher_info = TEMP_DATA_STORE.get(sid, {}).get('teacher', {})
    is_practical_course = teacher_info.get('course_type') == 'practical'

    for idx, col_name in enumerate(assessment_cols, start=1):
        col_lower = col_name.lower()

        # Collect numeric values for this column to find the highest mark scored
        numeric_marks = []
        for s in students_list:
            v_str = str(s['marks'].get(col_name, '')).strip()
            try:
                v_num = float(v_str)
                if v_num >= 0:
                    numeric_marks.append(v_num)
            except ValueError:
                pass

        max_observed = max(numeric_marks) if numeric_marks else 0.0

        # Check if column name has explicit max marks in parentheses, e.g. "CCE1 (10)" -> 10.0, "Exp 1 (25)" -> 25.0
        m_max = re.search(r'\(\s*(\d+(?:\.\d+)?)\s*\)', col_name) or re.search(r'out\s*of\s*(\d+(?:\.\d+)?)', col_name, re.I)
        if m_max:
            base_max = float(m_max.group(1))
        elif any(k in col_lower for k in ['exp', 'prac', 'practicle', 'practical', 'lab', 'job', 'task', 'pr']):
            base_max = 25.0
        elif 'cce' in col_lower or 'quiz' in col_lower or 'assign' in col_lower:
            base_max = 10.0
        elif 'ut' in col_lower or 'unit' in col_lower or 'test' in col_lower:
            base_max = 30.0 if max_observed > 20.0 else 20.0
        elif 'insem' in col_lower or 'mid' in col_lower:
            base_max = 30.0
        elif 'prelim' in col_lower or 'pre' in col_lower:
            base_max = 50.0
        elif 'ese' in col_lower or 'end' in col_lower or 'univ' in col_lower:
            base_max = 100.0
        elif 'oral' in col_lower or 'pr/or' in col_lower or 'viva' in col_lower:
            base_max = 50.0
        elif is_practical_course:
            base_max = 25.0
        else:
            base_max = 20.0

        # Smart ceiling so max marks NEVER starts below actual marks scored
        def_max = base_max
        if max_observed > base_max:
            for c in standard_ceilings:
                if c >= max_observed:
                    def_max = float(c)
                    break
            else:
                def_max = float(math.ceil(max_observed / 10.0) * 10)

        # Smart CO assignment:
        # For Practical/Experiments: Exp 1-2 / Practicle 1-2 -> CO1, Exp 3-4 -> CO2, Exp 5-6 -> CO3, etc.
        m_exp = re.search(r'(?:exp(?:eriment)?|pract(?:ic(?:al|le))?|prac|pr|lab|job|task)\s*[-_#]?\s*(\d+)', col_name, re.I)
        if m_exp:
            exp_num = int(m_exp.group(1))
            co_num = min(6, ((exp_num - 1) // 2) + 1)
            mapped_cos = [f"CO{co_num}"]
        elif any(k in col_lower for k in ['oral', 'pr/or', 'viva', 'pr exam', 'practical exam', 'final']):
            mapped_cos = ['CO1', 'CO2', 'CO3', 'CO4', 'CO5']
        elif is_practical_course or any(k in col_lower for k in ['practicle', 'practical', 'prac', 'exp', 'lab', 'job']):
            # For practical assessments without a specific number, map sequentially (2 assessments per CO)
            co_num = min(6, ((idx - 1) // 2) + 1)
            mapped_cos = [f"CO{co_num}"]
        else:
            m_co = re.search(r'co\s*(\d+)', col_name, re.I)
            if m_co:
                mapped_cos = [f"CO{m_co.group(1)}"]
            else:
                m_num = re.search(r'\d+', col_name)
                if m_num:
                    num_val = int(m_num.group())
                    co_num = min(6, max(1, num_val))
                    mapped_cos = [f"CO{co_num}"]
                else:
                    mapped_cos = [f"CO{((idx - 1) % 6) + 1}"]

        column_configs.append({
            'name': col_name,
            'checked': True,
            'max_marks': def_max,
            'mapped_cos': mapped_cos
        })

    TEMP_DATA_STORE[sid]['direct_raw'] = {
        'column_configs': column_configs,
        'students': students_list
    }

    return jsonify({
        'success': True,
        'is_long_format': is_long_format,
        'column_configs': column_configs,
        'students': students_list
    })


@app.route('/api/compute-direct', methods=['POST'])
def api_compute_direct():
    """Validates marks and computes direct CO attainment."""
    sid = get_session_id()
    data = request.get_json(force=True)
    
    students = data.get('students', [])
    column_configs = data.get('column_configs', [])
    passing_threshold_ratio = float(data.get('passing_threshold_ratio', 0.50))

    result = validate_and_compute_direct(students, column_configs, passing_threshold_ratio)
    if result['success']:
        TEMP_DATA_STORE[sid]['direct_computed'] = result['data']
        # Re-compute weighted if indirect exists
        if TEMP_DATA_STORE[sid].get('indirect_computed'):
            recompute_weighted_internal(sid)
        return jsonify(result)
    else:
        return jsonify(result), 400


@app.route('/api/upload-indirect', methods=['POST'])
def api_upload_indirect():
    """Parses indirect survey/rating file or pasted text."""
    sid = get_session_id()
    
    headers = []
    rows = []
    
    if 'file' in request.files and request.files['file'].filename:
        file = request.files['file']
        if not allowed_file(file.filename):
            return jsonify({'success': False, 'message': 'Unsupported file format. Please upload CSV, TSV, or XLSX.'}), 400
        headers, rows = parse_uploaded_file(file.stream, secure_filename(file.filename))
    elif 'pasted_text' in request.form and request.form['pasted_text'].strip():
        headers, rows = parse_delimited_or_matrix_text(request.form['pasted_text'])
    else:
        return jsonify({'success': False, 'message': 'No indirect file or pasted data provided.'}), 400

    if not headers or not rows:
        return jsonify({'success': False, 'message': 'The uploaded file or text is empty.'}), 400

    headers = [str(h).strip() for h in headers]
    ratings_data = []
    for r in rows:
        row_dict = {}
        for c_idx, h in enumerate(headers):
            row_dict[h] = r[c_idx].strip() if c_idx < len(r) else ""
        ratings_data.append(row_dict)

    TEMP_DATA_STORE[sid]['indirect_raw'] = {
        'headers': headers,
        'ratings_data': ratings_data
    }

    mapping_target = request.form.get('mapping_target', 'CO').strip().upper()
    if mapping_target == 'PO':
        detected_cos = [h for h in headers if re.match(r'^(PO|po|PSO|pso)[\s_-]*\d+', h)]
        if not detected_cos:
            detected_cos = [h for h in headers if "PO" in h.upper()]
    else:
        detected_cos = [h for h in headers if re.match(r'^(CO|co)[\s_-]*\d+', h)]
        if not detected_cos:
            detected_cos = [h for h in headers if "CO" in h.upper()]

    return jsonify({
        'success': True,
        'headers': headers,
        'detected_cos': detected_cos,
        'ratings_data': ratings_data,
        'mapping_target': mapping_target
    })


@app.route('/api/compute-indirect', methods=['POST'])
def api_compute_indirect():
    """Validates and computes indirect survey CO/PO attainment."""
    sid = get_session_id()
    data = request.get_json(force=True)
    
    ratings_data = data.get('ratings_data', [])
    max_rating = float(data.get('max_rating', 10.0))
    co_columns_override = data.get('co_columns_override')
    mapping_target = data.get('mapping_target', 'CO')

    result = validate_and_compute_indirect(ratings_data, max_rating, co_columns_override, mapping_target=mapping_target)
    if result['success']:
        TEMP_DATA_STORE[sid]['indirect_computed'] = result['data']
        # Re-compute weighted if direct exists and mapping_target is CO
        if TEMP_DATA_STORE[sid].get('direct_computed'):
            recompute_weighted_internal(sid)
        return jsonify(result)
    else:
        return jsonify(result), 400


def recompute_weighted_internal(sid: str, direct_weight: float = 80.0, indirect_weight: float = 20.0):
    direct_res = TEMP_DATA_STORE[sid].get('direct_computed', {})
    indirect_res = TEMP_DATA_STORE[sid].get('indirect_computed', {})
    
    d_cos = direct_res.get('co_summaries', [])
    i_cos = indirect_res.get('co_summaries', []) if indirect_res else []
    
    res = compute_weighted_co_attainment(d_cos, i_cos, direct_weight, indirect_weight)
    if res['success']:
        TEMP_DATA_STORE[sid]['weighted_computed'] = res['data']
    return res


@app.route('/api/compute-weighted', methods=['POST'])
def api_compute_weighted():
    """Computes combined weighted attainment with custom weights."""
    sid = get_session_id()
    data = request.get_json(force=True)
    
    try:
        direct_weight = float(data.get('direct_weight', 80.0))
        indirect_weight = float(data.get('indirect_weight', 20.0))
    except (ValueError, TypeError):
        return jsonify({'success': False, 'message': 'Invalid weights. Must be numbers.'}), 400

    if abs((direct_weight + indirect_weight) - 100.0) > 0.01:
        return jsonify({'success': False, 'message': f'Weights must sum to 100%. (Current total: {direct_weight + indirect_weight}%)'}), 400

    direct_res = TEMP_DATA_STORE[sid].get('direct_computed')
    if not direct_res:
        return jsonify({'success': False, 'message': 'Direct assessment data not yet computed.'}), 400

    indirect_res = TEMP_DATA_STORE[sid].get('indirect_computed')
    i_cos = indirect_res.get('co_summaries', []) if indirect_res else []

    res = compute_weighted_co_attainment(
        direct_res.get('co_summaries', []),
        i_cos,
        direct_weight,
        indirect_weight
    )
    if res['success']:
        TEMP_DATA_STORE[sid]['weighted_computed'] = res['data']
        return jsonify(res)
    else:
        return jsonify(res), 400


@app.route('/api/upload-copo', methods=['POST'])
def api_upload_copo():
    """
    Parses CO-PO mapping file (CSV, TSV, XLSX, or pasted).
    Supports named tables and headerless numeric matrices.
    Automatically assigns CO1..COn and PO1..POn for headerless matrices.
    """
    sid = get_session_id()
    headers = []
    rows = []

    if 'file' in request.files and request.files['file'].filename:
        file = request.files['file']
        if not allowed_file(file.filename):
            return jsonify({'success': False, 'message': 'Unsupported file format.'}), 400
        headers, rows = parse_uploaded_file(file.stream, secure_filename(file.filename))
    elif 'pasted_text' in request.form and request.form['pasted_text'].strip():
        headers, rows = parse_delimited_or_matrix_text(request.form['pasted_text'])
    else:
        return jsonify({'success': False, 'message': 'No file or pasted text provided.'}), 400

    if not headers:
        return jsonify({'success': False, 'message': 'Uploaded file is empty.'}), 400

    def _as_mapping_number(val):
        s = str(val).strip()
        if not s or s.upper() in ['-', '–', '—', '_', 'NA', 'N/A', 'NONE', 'NIL', 'NULL', 'X', '.']:
            return 0.0
        try:
            return float(s)
        except ValueError:
            return None

    def _is_po_header(val):
        s = str(val).strip().upper()
        return bool(re.match(r'^(PO|po|PSO|pso)[\s_-]*\d+', s)) or s in ['PO', 'PSO', 'PROGRAM OUTCOME', 'PROGRAM SPECIFIC OUTCOME']

    def _is_co_header(val):
        s = str(val).strip().upper()
        return bool(re.match(r'^(CO|co)[\s_-]*\d+', s)) or s in ['CO', 'COURSE OUTCOME']

    # Default PO / PSO generator: PO1..PO11, then PSO1, PSO2, PSO3, PSO4, PSO5... as columns increase
    def _get_default_po_label(i):
        if i < 11:
            return f"PO{i + 1}"
        else:
            return f"PSO{i - 10}"

    all_raw_rows = [[str(c).strip() for c in r] for r in ([headers] + rows) if r and any(str(c).strip() for c in r)]
    if not all_raw_rows:
        return jsonify({'success': False, 'message': 'Uploaded matrix is empty.'}), 400

    row0 = all_raw_rows[0]
    po_matches = sum(1 for c in row0 if _is_po_header(c))
    num_matches = sum(1 for c in row0 if _as_mapping_number(c) is not None)

    # Check if row 1 exists and starts with CO
    row1_has_co = len(all_raw_rows) > 1 and len(all_raw_rows[1]) > 0 and _is_co_header(all_raw_rows[1][0])

    if po_matches >= 2 or (po_matches >= 1 and num_matches < len(row0) / 2):
        has_po_headers = True
    elif row1_has_co and not _is_co_header(row0[0]) and len(all_raw_rows) > 1:
        has_po_headers = True
    else:
        has_po_headers = False

    if has_po_headers:
        data_rows = all_raw_rows[1:]
        po_header_row = row0
    else:
        data_rows = all_raw_rows
        po_header_row = None

    if not data_rows:
        return jsonify({'success': False, 'message': 'No data rows found in matrix.'}), 400

    # Check if data rows have a CO column on the left (column 0)
    first_cells = [r[0] for r in data_rows if len(r) > 0]
    co_matches = sum(1 for c in first_cells if _is_co_header(c))
    non_num_cells = sum(1 for c in first_cells if _as_mapping_number(c) is None)
    has_co_col = co_matches > 0 or (non_num_cells > len(data_rows) / 2 and non_num_cells > 0)

    data_cols_start = 1 if has_co_col else 0

    # Determine max data columns
    max_data_cols = max(len(r) - data_cols_start for r in data_rows if len(r) > data_cols_start)
    if max_data_cols <= 0:
        max_data_cols = 14

    # Determine PO labels
    if has_po_headers and po_header_row:
        if len(po_header_row) > max_data_cols or (has_co_col and len(po_header_row) == max_data_cols + 1):
            raw_po_list = po_header_row[1:]
        else:
            raw_po_list = po_header_row

        po_labels = []
        for i in range(max_data_cols):
            if i < len(raw_po_list) and raw_po_list[i].strip() and _is_po_header(raw_po_list[i]):
                po_labels.append(raw_po_list[i].strip().upper())
            else:
                po_labels.append(_get_default_po_label(i))
    else:
        po_labels = [_get_default_po_label(i) for i in range(max_data_cols)]

    # Determine CO labels
    co_labels = []
    for r_idx, row in enumerate(data_rows):
        if has_co_col and len(row) > 0 and row[0].strip() and _as_mapping_number(row[0]) is None:
            co_name = row[0].strip().upper()
        else:
            co_name = f"CO{r_idx + 1}"
        co_labels.append(co_name)

    is_headerless = not has_po_headers and not has_co_col

    # Build matrix dict
    matrix_dict = {}
    for r_idx, row in enumerate(data_rows):
        co_name = co_labels[r_idx]
        matrix_dict[co_name] = {}
        for c_idx, po_name in enumerate(po_labels):
            raw_idx = data_cols_start + c_idx
            val_str = row[raw_idx].strip() if raw_idx < len(row) else '0'
            num_val = _as_mapping_number(val_str)
            matrix_dict[co_name][po_name] = num_val if num_val is not None else 0.0

    # Fallback if empty
    if not co_labels:
        co_labels = [f"CO{i+1}" for i in range(5)]
        po_labels = [_get_default_po_label(i) for i in range(14)]
        for co in co_labels:
            matrix_dict[co] = {po: 0.0 for po in po_labels}

    TEMP_DATA_STORE[sid]['copo_mapping'] = {
        'co_list': co_labels,
        'po_list': po_labels,
        'matrix': matrix_dict,
        'is_headerless': is_headerless
    }

    return jsonify({
        'success': True,
        'is_headerless': is_headerless,
        'co_list': co_labels,
        'po_list': po_labels,
        'matrix': matrix_dict
    })


@app.route('/api/compute-copo', methods=['POST'])
def api_compute_copo():
    """Computes PO & PSO attainment from the mapping matrix."""
    sid = get_session_id()
    data = request.get_json(force=True)
    
    matrix = data.get('matrix', {})
    po_list = data.get('po_list')
    co_list = data.get('co_list')

    # Get combined CO attainments
    weighted_data = TEMP_DATA_STORE[sid].get('weighted_computed')
    direct_data = TEMP_DATA_STORE[sid].get('direct_computed')
    indirect_data = TEMP_DATA_STORE[sid].get('indirect_computed')

    co_attainments = {}
    direct_co_atts = {}
    indirect_co_atts = {}

    if direct_data and direct_data.get('co_summaries'):
        for item in direct_data['co_summaries']:
            direct_co_atts[item['co']] = item.get('attainment', 0.0)

    if indirect_data and indirect_data.get('co_summaries'):
        for item in indirect_data['co_summaries']:
            indirect_co_atts[item['co']] = item.get('attainment', 0.0)

    if weighted_data and weighted_data.get('combined_results'):
        for item in weighted_data['combined_results']:
            co_attainments[item['co']] = item.get('combined_attainment', item.get('attainment', 0.0))
    elif direct_data and direct_data.get('co_summaries'):
        for item in direct_data['co_summaries']:
            co_attainments[item['co']] = item.get('attainment', 0.0)
    else:
        # Default fallback
        for co in matrix.keys():
            co_attainments[co] = 2.0

    result = compute_po_attainment(
        matrix,
        co_attainments,
        po_list,
        co_list,
        direct_co_attainments=direct_co_atts if direct_co_atts else None,
        indirect_co_attainments=indirect_co_atts if indirect_co_atts else None
    )
    
    TEMP_DATA_STORE[sid]['copo_computed'] = {
        'matrix': matrix,
        'co_list': result['co_list'],
        'po_list': result['po_list'],
        'po_results': result['po_results'],
        'mapping_averages': result.get('mapping_averages', {}),
        'overall_po_attainment': result['overall_po_attainment'],
        'overall_po_level': result['overall_po_level'],
        'has_indirect': bool(indirect_co_atts)
    }

    return jsonify({'success': True, 'data': TEMP_DATA_STORE[sid]['copo_computed']})


@app.route('/api/categorize-learners', methods=['POST'])
def api_categorize_learners():
    """Categorizes students into Slow Learners and Fast Learners based on CCE or overall marks."""
    sid = get_session_id()
    data = request.get_json(silent=True) or {}
    
    direct_data = TEMP_DATA_STORE[sid].get('direct_computed')
    if not direct_data:
        # Check if direct data was provided in request payload
        direct_data = data.get('direct_computed')
        if not direct_data:
            return jsonify({'success': False, 'message': 'Direct assessment data not found. Please upload marks first.'}), 400
    
    students = direct_data.get('students', [])
    assessment_summaries = direct_data.get('assessment_summaries', [])
    
    try:
        slow_threshold_pct = float(data.get('slow_threshold_pct', 50.0))
        fast_threshold_pct = float(data.get('fast_threshold_pct', 70.0))
    except (ValueError, TypeError):
        slow_threshold_pct = 50.0
        fast_threshold_pct = 70.0

    threshold_mode = data.get('threshold_mode', 'marks')
    slow_threshold_marks = data.get('slow_threshold_marks')
    fast_threshold_marks = data.get('fast_threshold_marks')

    if slow_threshold_marks is not None:
        try:
            slow_threshold_marks = float(slow_threshold_marks)
        except (ValueError, TypeError):
            slow_threshold_marks = None

    if fast_threshold_marks is not None:
        try:
            fast_threshold_marks = float(fast_threshold_marks)
        except (ValueError, TypeError):
            fast_threshold_marks = None
        
    target_assessment = data.get('target_assessment', 'overall')
    
    result = categorize_slow_fast_learners(
        students=students,
        slow_threshold_pct=slow_threshold_pct,
        fast_threshold_pct=fast_threshold_pct,
        target_assessment=target_assessment,
        assessment_summaries=assessment_summaries,
        threshold_mode=threshold_mode,
        slow_threshold_marks=slow_threshold_marks,
        fast_threshold_marks=fast_threshold_marks
    )
    
    TEMP_DATA_STORE[sid]['learners_data'] = result
    save_session_state(sid)
    
    return jsonify({'success': True, 'data': result})


def get_report_data_from_request_or_session() -> Dict[str, Any]:
    """
    Robustly resolves report data from client POST payload, session store, or disk cache.
    Guarantees that serverless lambda restarts never produce empty reports or blank PDFs.
    """
    sid = get_session_id()
    state = TEMP_DATA_STORE.get(sid, {})
    
    payload = {}
    if request.method == 'POST':
        try:
            payload = request.get_json(silent=True) or {}
        except Exception:
            payload = {}
            
    # If client passed full state in POST payload, sync it immediately
    if payload:
        if 'teacher' in payload and payload['teacher']:
            state['teacher'] = payload['teacher']
            session['teacher'] = payload['teacher']
        if 'direct' in payload and payload['direct']:
            state['direct_computed'] = payload['direct']
        if 'indirect' in payload and payload['indirect']:
            state['indirect_computed'] = payload['indirect']
        if 'weighted' in payload and payload['weighted']:
            state['weighted_computed'] = payload['weighted']
        if 'copo' in payload and payload['copo']:
            state['copo_computed'] = payload['copo']
        if 'learners' in payload and payload['learners']:
            state['learners_data'] = payload['learners']
        TEMP_DATA_STORE[sid] = state
        save_session_state(sid)

    # Resolve teacher info
    teacher = payload.get('teacher') or state.get('teacher') or session.get('teacher') or {}
    if not isinstance(teacher, dict):
        teacher = {}
    
    # Direct
    direct = payload.get('direct') or state.get('direct_computed')
    if not direct and state.get('direct_raw'):
        try:
            raw = state['direct_raw']
            res = compute_direct_attainment(raw.get('column_configs', []), raw.get('students', []))
            if res.get('success'):
                direct = res.get('data')
                state['direct_computed'] = direct
                save_session_state(sid)
        except Exception:
            pass
    if not isinstance(direct, dict):
        direct = {}

    # Indirect
    indirect = payload.get('indirect') or state.get('indirect_computed')
    if not isinstance(indirect, dict):
        indirect = {}

    # Weighted
    weighted = payload.get('weighted') or state.get('weighted_computed')
    if not weighted and direct and direct.get('co_summaries'):
        d_summaries = direct.get('co_summaries', [])
        valid_atts = [float(c.get('attainment', 0) or 0) for c in d_summaries if c.get('attainment') is not None]
        avg_a = (sum(valid_atts) / len(valid_atts)) if valid_atts else 0.0
        lvl_a = "Level 3 - High" if avg_a >= 2.5 else ("Level 2 - Moderate" if avg_a >= 1.5 else "Level 1 - Low")
        weighted = {
            'overall_attainment': f"{avg_a:.2f}",
            'overall_level_label': lvl_a,
            'direct_weight': 80,
            'indirect_weight': 20,
            'combined_results': [
                {
                    'co': c.get('co'),
                    'direct_pct': c.get('pass_percentage', 0),
                    'direct_contribution': round(float(c.get('pass_percentage', 0) or 0) * 0.8, 1),
                    'direct_attainment': c.get('attainment', 0),
                    'indirect_pct': 0,
                    'indirect_contribution': 0.0,
                    'indirect_attainment': 0.0,
                    'combined_pct': c.get('pass_percentage', 0),
                    'combined_attainment': c.get('attainment', 0),
                    'level_label': c.get('level_label', 'Level 0')
                } for c in d_summaries
            ]
        }
        state['weighted_computed'] = weighted
        save_session_state(sid)
    if not isinstance(weighted, dict):
        weighted = {}

    # CO-PO
    copo = payload.get('copo') or state.get('copo_computed')
    if not isinstance(copo, dict):
        copo = {}

    # Learners
    learners = payload.get('learners') or state.get('learners_data')
    if not learners and direct.get('students'):
        try:
            learners = categorize_slow_fast_learners(
                students=direct.get('students', []),
                slow_threshold_pct=40.0,
                fast_threshold_pct=70.0,
                target_assessment='overall',
                assessment_summaries=direct.get('assessment_summaries', []),
                threshold_mode='marks'
            )
            state['learners_data'] = learners
            save_session_state(sid)
        except Exception:
            pass
    if not isinstance(learners, dict):
        learners = {}

    return {
        'teacher': teacher,
        'direct': {'data': direct},
        'indirect': {'data': indirect},
        'weighted': {'data': weighted},
        'copo': copo,
        'learners': learners
    }


@app.route('/download/learners-pdf', methods=['GET', 'POST'])
def download_learners_pdf():
    """Generates and downloads the dedicated Slow & Advanced Learners PDF report."""
    report_data = get_report_data_from_request_or_session()
    learners_data = report_data.get('learners') or {}
    
    if not learners_data:
        direct_data = (report_data.get('direct') or {}).get('data') or {}
        if direct_data.get('students'):
            learners_data = categorize_slow_fast_learners(
                students=direct_data.get('students', []),
                slow_threshold_pct=40.0,
                fast_threshold_pct=70.0,
                target_assessment='overall',
                assessment_summaries=direct_data.get('assessment_summaries', []),
                threshold_mode='marks'
            )
            report_data['learners'] = learners_data
        
    if not learners_data:
        return jsonify({'success': False, 'message': 'No student data available to generate Slow & Advanced Learners report.'}), 400
        
    pdf_io = create_slow_fast_learners_pdf(report_data, learners_data)
    teacher = report_data.get('teacher') or {}
    subject_safe = re.sub(r'[^a-zA-Z0-9_-]', '_', teacher.get('subject', 'Course') or 'Course')
    filename = f"Slow_and_Advanced_Learners_Report_{subject_safe}.pdf"
    
    return send_file(
        pdf_io,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=filename
    )


@app.route('/api/get-full-state', methods=['GET'])
def api_get_full_state():
    """Returns the complete evaluation state for rendering."""
    sid = get_session_id()
    state = TEMP_DATA_STORE.get(sid, {})
    return jsonify({
        'teacher': state.get('teacher', {}),
        'direct': state.get('direct_computed'),
        'indirect': state.get('indirect_computed'),
        'indirect_raw': state.get('indirect_raw'),
        'weighted': state.get('weighted_computed'),
        'copo': state.get('copo_computed'),
        'learners': state.get('learners_data')
    })


# =========================================================================
# EXPORTS & DOWNLOADS (Supporting both GET and POST for state preservation)
# =========================================================================

@app.route('/download/complete-excel', methods=['GET', 'POST'])
def download_complete_excel():
    """Generates and downloads the full multi-sheet Excel report."""
    report_data = get_report_data_from_request_or_session()
    excel_io = create_complete_excel_report(report_data)
    subject_safe = re.sub(r'[^a-zA-Z0-9_-]', '_', report_data.get('teacher', {}).get('subject', 'Course') or 'Course')
    filename = f"CO_PO_Attainment_Report_{subject_safe}.xlsx"
    
    return send_file(
        excel_io,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=filename
    )


@app.route('/download/word-report', methods=['GET', 'POST'])
def download_word_report():
    """Generates and downloads the Word DOCX report."""
    report_data = get_report_data_from_request_or_session()
    docx_io = create_word_report(report_data)
    subject_safe = re.sub(r'[^a-zA-Z0-9_-]', '_', report_data.get('teacher', {}).get('subject', 'Course') or 'Course')
    filename = f"CO_PO_Attainment_Report_{subject_safe}.docx"

    return send_file(
        docx_io,
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        as_attachment=True,
        download_name=filename
    )


@app.route('/download/pdf-report', methods=['GET', 'POST'])
def download_pdf_report():
    """Generates and downloads the accreditation-ready PDF report."""
    report_data = get_report_data_from_request_or_session()
    charts_arg = request.args.get('charts') or (request.get_json(silent=True) or {}).get('charts', '1')
    include_charts = str(charts_arg).lower() in ['1', 'true', 'yes', 'on']

    pdf_io = create_pdf_report(report_data, include_charts=include_charts, section="all")
    teacher = report_data.get('teacher') or {}
    subject_safe = re.sub(r'[^a-zA-Z0-9_-]', '_', teacher.get('subject', 'Course') or 'Course')
    chart_suffix = "_With_Graphs" if include_charts else "_Tables_Only"
    filename = f"Comprehensive_CO_PO_Report_{subject_safe}{chart_suffix}.pdf"

    return send_file(
        pdf_io,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=filename
    )


@app.route('/download/assessment-pdf', methods=['GET', 'POST'])
def download_assessment_pdf():
    """Generates and downloads the Page 2 Assessment PDF report (Direct, Assessment Tools, Weighted COs)."""
    report_data = get_report_data_from_request_or_session()
    charts_arg = request.args.get('charts') or (request.get_json(silent=True) or {}).get('charts', '1')
    include_charts = str(charts_arg).lower() in ['1', 'true', 'yes', 'on']

    pdf_io = create_pdf_report(report_data, include_charts=include_charts, section="assessment")
    teacher = report_data.get('teacher') or {}
    subject_safe = re.sub(r'[^a-zA-Z0-9_-]', '_', teacher.get('subject', 'Course') or 'Course')
    chart_suffix = "_With_Graphs" if include_charts else "_Tables_Only"
    filename = f"CO_Assessment_Report_{subject_safe}{chart_suffix}.pdf"

    return send_file(
        pdf_io,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=filename
    )


@app.route('/download/copo-pdf', methods=['GET', 'POST'])
def download_copo_pdf():
    """Generates and downloads the Page 3 CO-PO Matrix & PO Attainment PDF report."""
    report_data = get_report_data_from_request_or_session()
    charts_arg = request.args.get('charts') or (request.get_json(silent=True) or {}).get('charts', '1')
    include_charts = str(charts_arg).lower() in ['1', 'true', 'yes', 'on']

    pdf_io = create_pdf_report(report_data, include_charts=include_charts, section="copo")
    teacher = report_data.get('teacher') or {}
    subject_safe = re.sub(r'[^a-zA-Z0-9_-]', '_', teacher.get('subject', 'Course') or 'Course')
    filename = f"CO_PO_Attainment_Report_{subject_safe}.pdf"

    return send_file(
        pdf_io,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=filename
    )


@app.route('/download/students-report', methods=['GET', 'POST'])
def download_students_report():
    """Generates and downloads the student-wise performance and marks report in Excel."""
    report_data = get_report_data_from_request_or_session()
    direct_data = (report_data.get('direct') or {}).get('data') or {}
    teacher = report_data.get('teacher') or {}

    excel_io = create_students_only_excel(direct_data, teacher)
    subject_safe = re.sub(r'[^a-zA-Z0-9_-]', '_', teacher.get('subject', 'Course') or 'Course')
    filename = f"Students_Performance_Report_{subject_safe}.xlsx"

    return send_file(
        excel_io,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=filename
    )


@app.route('/download/direct-report', methods=['GET', 'POST'])
def download_direct_report():
    report_data = get_report_data_from_request_or_session()
    direct_data = (report_data.get('direct') or {}).get('data') or {}
    teacher = report_data.get('teacher') or {}

    excel_io = create_direct_only_excel(direct_data, teacher)
    subject_safe = re.sub(r'[^a-zA-Z0-9_-]', '_', teacher.get('subject', 'Course') or 'Course')
    return send_file(
        excel_io,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=f"Direct_Attainment_{subject_safe}.xlsx"
    )


@app.route('/download/indirect-report', methods=['GET', 'POST'])
def download_indirect_report():
    report_data = get_report_data_from_request_or_session()
    indirect_data = (report_data.get('indirect') or {}).get('data') or {}
    teacher = report_data.get('teacher') or {}

    excel_io = create_indirect_only_excel(indirect_data, teacher)
    subject_safe = re.sub(r'[^a-zA-Z0-9_-]', '_', teacher.get('subject', 'Course') or 'Course')
    return send_file(
        excel_io,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=f"Indirect_Attainment_{subject_safe}.xlsx"
    )


@app.route('/download/copo-report', methods=['GET', 'POST'])
def download_copo_report():
    report_data = get_report_data_from_request_or_session()
    copo_data = report_data.get('copo') or {}
    teacher = report_data.get('teacher') or {}

    excel_io = create_copo_only_excel(copo_data, teacher)
    subject_safe = re.sub(r'[^a-zA-Z0-9_-]', '_', teacher.get('subject', 'Course') or 'Course')
    return send_file(
        excel_io,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=f"CO_PO_Attainment_{subject_safe}.xlsx"
    )


@app.route('/sample-data/<filename>')
def download_sample_data(filename):
    """Serves sample datasets for testing."""
    sample_dir = os.path.join(app.root_path, 'sample_data')
    return send_from_directory(sample_dir, filename, as_attachment=True)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
