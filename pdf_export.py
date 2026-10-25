"""
PDF Report Generator for CO-PO Attainment System.
Generates accreditation-ready, multi-page PDF documents using ReportLab.
Includes Institutional Header (DYP Akurdi), simple 2-line Faculty information,
Direct CO attainment (with separate Internal vs ESE breakdown), Assessment Tools,
Indirect survey ratings, Weighted combinations, CO-PO mapping (PO1..PO11, PSO1..PSO3),
all visual charts from Page 2 & Page 3, and Slow/Fast Learners report generator.
"""

import os
import io
from typing import Dict, Any, List, Optional
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable,
    Image as RLImage
)
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.charts.barcharts import VerticalBarChart


def build_institution_header(styles) -> List[Any]:
    """Builds the standardized institutional header with DYP logo and accreditation details."""
    elements = []
    base_dir = os.path.dirname(os.path.abspath(__file__))
    logo_path = os.path.join(base_dir, 'static', 'images', 'dyp_logo.png')

    inst_title_style = ParagraphStyle(
        'InstTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=13,
        textColor=colors.HexColor('#0F172A'),
        alignment=1
    )

    header_text = """
    <b>D Y PATIL COLLEGE OF ENGINEERING, AKURDI, PUNE</b><br/>
    <font size=7 color="#334155">
    APPROVED BY AICTE, RECOGNIZED BY DTE (GOVT.)<br/>
    AFFILIATED TO SAVITRIBAI PHULE PUNE UNIVERSITY<br/>
    Accredited by NAAC with 'A' Grade, NBA 6 UG programs Accredited<br/>
    ISO 21001:2018 Certified Institute &bull; Autonomous Institute with effective from AY 2024-25
    </font>
    """

    if os.path.exists(logo_path):
        try:
            img = RLImage(logo_path, width=54, height=54)
            hdr_table = Table([[img, Paragraph(header_text, inst_title_style)]], colWidths=[65, 475])
            hdr_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('ALIGN', (0, 0), (0, 0), 'CENTER'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
                ('TOPPADDING', (0, 0), (-1, -1), 0),
            ]))
            elements.append(hdr_table)
        except Exception:
            elements.append(Paragraph(header_text, inst_title_style))
    else:
        elements.append(Paragraph(header_text, inst_title_style))

    elements.append(Spacer(1, 4))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#1E3A8A'), spaceAfter=8))
    return elements


def build_two_line_teacher_box(teacher: Dict[str, Any], overall_att: str, overall_lvl: str, normal_cell) -> Table:
    """Renders teacher and course info in an elegant, medium-sized box."""
    f_name = teacher.get('faculty_name', 'N/A') or 'N/A'
    subj = teacher.get('subject', 'N/A') or 'N/A'
    cls_name = teacher.get('class_name', 'N/A') or 'N/A'
    div_name = teacher.get('division', 'A') or 'A'
    ay = teacher.get('academic_year', 'N/A') or 'N/A'
    sem = teacher.get('semester', 'N/A') or 'N/A'

    cls_div = f"{cls_name} (Div {div_name})" if div_name and div_name != 'N/A' else cls_name

    # Check overall attainment display format
    if overall_att in ['Evaluated', 'N/A', 'Active', 'None', '']:
        att_display = overall_att if overall_att in ['Evaluated', 'Active'] else 'Under Evaluation'
    else:
        try:
            val_f = float(overall_att)
            att_display = f"{val_f:.2f} / 3.00 &bull; {overall_lvl}"
        except (ValueError, TypeError):
            att_display = f"{overall_att} &bull; {overall_lvl}"

    course_type = teacher.get('course_type', 'theory')
    batch = teacher.get('batch', '')
    type_str = f"Practical ({batch})" if (course_type == 'practical' and batch) else ("Practical" if course_type == 'practical' else "Theory")

    line1 = f"<b>Faculty:</b> {f_name} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Course:</b> {subj} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Type:</b> {type_str} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Class:</b> {cls_div}"
    line2 = f"<b>Academic Year:</b> {ay} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Semester:</b> {sem} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Overall Attainment:</b> <font color='#1E3A8A'><b>{att_display}</b></font>"

    t_data = [
        [Paragraph(line1, normal_cell)],
        [Paragraph(line2, normal_cell)]
    ]
    t_box = Table(t_data, colWidths=[540])
    t_box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#94A3B8')),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
    ]))
    return t_box


def create_co_passing_drawing(direct: Dict[str, Any]) -> Any:
    """Graph 1: Students passing each Course Outcome."""
    co_summaries = direct.get('co_summaries', [])
    if not co_summaries:
        return None
    cos = [str(c.get('co', '')) for c in co_summaries][:8]
    passed = [int(c.get('students_passed', 0) or 0) for c in co_summaries][:8]
    total_students = int(direct.get('total_students', 0) or max(passed + [1]))

    d = Drawing(520, 120)
    chart = VerticalBarChart()
    chart.x = 40
    chart.y = 15
    chart.height = 85
    chart.width = 460
    chart.data = [passed]
    chart.categoryAxis.categoryNames = cos
    chart.categoryAxis.labels.fontSize = 8
    chart.valueAxis.valueMin = 0
    chart.valueAxis.valueMax = int(max(total_students, max(passed + [1])) * 1.15)
    chart.valueAxis.labels.fontSize = 7
    chart.bars[0].fillColor = colors.HexColor('#2563EB')
    chart.barLabelFormat = '%d'
    chart.barLabels.fontSize = 7.5
    chart.barLabels.boxAnchor = 's'
    chart.barLabels.dy = 2
    d.add(chart)
    return d


def create_direct_attainment_drawing(direct: Dict[str, Any]) -> Any:
    """Graph 2: Direct Course Outcome Attainment values (0-3 Points Scale)."""
    co_summaries = direct.get('co_summaries', [])
    if not co_summaries:
        return None
    cos = [str(c.get('co', '')) for c in co_summaries][:8]
    atts = [float(c.get('attainment', 0) or 0) for c in co_summaries][:8]

    d = Drawing(520, 120)
    chart = VerticalBarChart()
    chart.x = 40
    chart.y = 15
    chart.height = 85
    chart.width = 460
    chart.data = [atts]
    chart.categoryAxis.categoryNames = cos
    chart.categoryAxis.labels.fontSize = 8
    chart.valueAxis.valueMin = 0.0
    chart.valueAxis.valueMax = 3.3
    chart.valueAxis.valueStep = 0.5
    chart.valueAxis.labels.fontSize = 7
    chart.bars[0].fillColor = colors.HexColor('#10B981')
    chart.barLabelFormat = '%.2f'
    chart.barLabels.fontSize = 7.5
    chart.barLabels.boxAnchor = 's'
    chart.barLabels.dy = 2
    d.add(chart)
    return d


def create_co_barchart_drawing(weighted: Dict[str, Any]) -> Any:
    """Graph 3: Combined multi-bar comparison (Direct vs Indirect vs Combined Attainment: Green to Red)."""
    results = weighted.get("combined_results", [])
    if not results:
        return None
    cos = [str(r.get('co', '')) for r in results][:8]
    direct_data = [float(r.get('direct_attainment', 0) or 0) for r in results][:8]
    indirect_data = [float(r.get('indirect_attainment', 0) or 0) for r in results][:8]
    combined_data = [float(r.get('combined_attainment', 0) or 0) for r in results][:8]

    d = Drawing(520, 130)
    chart = VerticalBarChart()
    chart.x = 40
    chart.y = 15
    chart.height = 95
    chart.width = 460
    chart.data = [direct_data, indirect_data, combined_data]
    chart.categoryAxis.categoryNames = cos
    chart.categoryAxis.labels.fontSize = 8
    chart.valueAxis.valueMin = 0.0
    chart.valueAxis.valueMax = 3.4
    chart.valueAxis.valueStep = 0.5
    chart.valueAxis.labels.fontSize = 7
    chart.bars[0].fillColor = colors.HexColor('#10B981')  # Green (Direct)
    chart.bars[1].fillColor = colors.HexColor('#F59E0B')  # Amber (Indirect)
    chart.bars[2].fillColor = colors.HexColor('#DC2626')  # Red (Combined)
    chart.barLabelFormat = '%.2f'
    chart.barLabels.fontSize = 6.5
    chart.barLabels.boxAnchor = 's'
    chart.barLabels.dy = 2
    d.add(chart)
    return d


def create_po_direct_barchart_drawing(copo: Dict[str, Any]) -> Any:
    """Graph 4: CO-PO-PSO Direct Attainment Profile (Blue: Mapping | Red: Direct Attainment)."""
    po_results = copo.get("po_results", [])
    if not po_results:
        return None
    labels = [str(p.get('po', '')) for p in po_results]
    mapping_vals = [float(p.get('mapping_avg', 0) or 0) for p in po_results]
    direct_vals = [float(p.get('direct_attainment', 0) or 0) if p.get('direct_attainment') is not None else 0.0 for p in po_results]

    d = Drawing(520, 125)
    chart = VerticalBarChart()
    chart.x = 35
    chart.y = 15
    chart.height = 85
    chart.width = 470
    chart.data = [mapping_vals, direct_vals]
    chart.categoryAxis.categoryNames = labels
    chart.categoryAxis.labels.fontSize = 6.5
    chart.valueAxis.valueMin = 0.0
    chart.valueAxis.valueMax = 3.5
    chart.valueAxis.valueStep = 0.5
    chart.valueAxis.labels.fontSize = 7
    chart.bars[0].fillColor = colors.HexColor('#4F81BD')
    chart.bars[1].fillColor = colors.HexColor('#C0504D')
    chart.barLabelFormat = '%.2f'
    chart.barLabels.fontSize = 5.5
    chart.barLabels.boxAnchor = 's'
    chart.barLabels.dy = 2
    d.add(chart)
    return d


def create_po_indirect_barchart_drawing(copo: Dict[str, Any]) -> Any:
    """Graph 5: CO-PO-PSO Indirect Attainment Profile (Blue: Mapping | Red: Indirect Attainment)."""
    po_results = copo.get("po_results", [])
    if not po_results:
        return None
    labels = [str(p.get('po', '')) for p in po_results]
    mapping_vals = [float(p.get('mapping_avg', 0) or 0) for p in po_results]
    indirect_vals = [float(p.get('indirect_attainment', 0) or 0) if p.get('indirect_attainment') is not None else 0.0 for p in po_results]

    d = Drawing(520, 125)
    chart = VerticalBarChart()
    chart.x = 35
    chart.y = 15
    chart.height = 85
    chart.width = 470
    chart.data = [mapping_vals, indirect_vals]
    chart.categoryAxis.categoryNames = labels
    chart.categoryAxis.labels.fontSize = 6.5
    chart.valueAxis.valueMin = 0.0
    chart.valueAxis.valueMax = 3.5
    chart.valueAxis.valueStep = 0.5
    chart.valueAxis.labels.fontSize = 7
    chart.bars[0].fillColor = colors.HexColor('#4F81BD')
    chart.bars[1].fillColor = colors.HexColor('#C0504D')
    chart.barLabelFormat = '%.2f'
    chart.barLabels.fontSize = 5.5
    chart.barLabels.boxAnchor = 's'
    chart.barLabels.dy = 2
    d.add(chart)
    return d


def create_po_barchart_drawing(copo: Dict[str, Any]) -> Any:
    """Backward compatibility helper for PO attainment chart."""
    return create_po_direct_barchart_drawing(copo)


def draw_page_decorations(canvas, doc):
    """Draws a running header and footer on every page of the report."""
    canvas.saveState()
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(colors.HexColor('#1E3A8A'))
    canvas.drawString(36, 11 * inch - 26, "D. Y. PATIL COLLEGE OF ENGINEERING, AKURDI, PUNE - 411044")
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(colors.HexColor('#64748B'))
    canvas.drawRightString(8.5 * inch - 36, 11 * inch - 26, "Accreditation Attainment Report")
    
    # Thin rule under running header
    canvas.setStrokeColor(colors.HexColor('#CBD5E1'))
    canvas.setLineWidth(0.4)
    canvas.line(36, 11 * inch - 30, 8.5 * inch - 36, 11 * inch - 30)
    
    # Running Footer
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(36, 22, "Outcome-Based Education (OBE) • CO-PO Attainment System")
    canvas.drawRightString(8.5 * inch - 36, 22, f"Page {doc.page}")
    canvas.line(36, 32, 8.5 * inch - 36, 32)
    canvas.restoreState()


def create_pdf_report(report_data: Dict[str, Any], include_charts: bool = True, section: str = "all") -> io.BytesIO:
    """
    Builds the accreditation-ready final PDF report.
    Includes DYP Akurdi header, 2-line faculty information, and comprehensive tables and charts.
    Hides ESE column if no ESE assessment exists, uses clean thin table borders, and includes running header on every page.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=42,
        bottomMargin=42
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=colors.HexColor('#0F172A'),
        alignment=1,
        spaceAfter=4
    )

    h2_style = ParagraphStyle(
        'DocH2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor('#1E3A8A'),
        spaceBefore=8,
        spaceAfter=4
    )

    bold_cell = ParagraphStyle(
        'BoldCell',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#0F172A')
    )

    normal_cell = ParagraphStyle(
        'NormalCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#0F172A')
    )

    header_cell = ParagraphStyle(
        'HeaderCell',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.white,
        alignment=1
    )

    elements = []

    teacher = report_data.get('teacher') or {}
    direct_raw = report_data.get('direct') or {}
    direct = direct_raw.get('data') if isinstance(direct_raw, dict) and 'data' in direct_raw else direct_raw
    if not isinstance(direct, dict):
        direct = {}

    indirect_raw = report_data.get('indirect') or {}
    indirect = indirect_raw.get('data') if isinstance(indirect_raw, dict) and 'data' in indirect_raw else indirect_raw
    if not isinstance(indirect, dict):
        indirect = {}

    weighted_raw = report_data.get('weighted') or {}
    weighted = weighted_raw.get('data') if isinstance(weighted_raw, dict) and 'data' in weighted_raw else weighted_raw
    if not isinstance(weighted, dict):
        weighted = {}

    copo_raw = report_data.get('copo') or {}
    copo = copo_raw.get('data') if isinstance(copo_raw, dict) and 'data' in copo_raw else copo_raw
    if not isinstance(copo, dict):
        copo = {}

    # Check if any ESE (End Semester Exam) actually exists in assessments
    has_any_ese = any(
        a.get('is_ese') or 'ESE' in str(a.get('name', '')).upper() or 'END' in str(a.get('name', '')).upper()
        for a in direct.get('assessment_summaries', [])
    ) or any(c.get('has_ese') for c in direct.get('co_summaries', []))

    # Fallback if weighted is not computed yet: fallback to direct COs
    if not weighted.get("combined_results") and direct.get("co_summaries"):
        d_summaries = direct.get("co_summaries", [])
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

    # 1. Institution Header (Top of Page 1)
    elements.extend(build_institution_header(styles))

    # 2. Document Title (Context-sensitive)
    course_type = teacher.get('course_type', 'theory')
    if section == "assessment":
        if course_type == 'practical':
            doc_title = "DIRECT LABORATORY ASSESSMENT &amp; COURSE OUTCOME (CO) ATTAINMENT REPORT"
        else:
            doc_title = "DIRECT ASSESSMENT &amp; COURSE OUTCOME (CO) ATTAINMENT REPORT"
    elif section == "copo":
        doc_title = "CO-PO MAPPING &amp; PROGRAM OUTCOME (PO) ATTAINMENT REPORT"
    else:
        doc_title = "COURSE OUTCOME &amp; PROGRAM OUTCOME ATTAINMENT EVALUATION REPORT"

    elements.append(Paragraph(doc_title, title_style))
    elements.append(Spacer(1, 4))

    # 3. Simple 2-Line Teacher Info Box
    overall_att = str(weighted.get('overall_attainment', copo.get('overall_po_attainment', 'N/A')))
    overall_lvl = str(weighted.get('overall_level_label', copo.get('overall_po_level', 'Attained')))
    elements.append(build_two_line_teacher_box(teacher, overall_att, overall_lvl, normal_cell))
    elements.append(Spacer(1, 8))

    # Empty State Notice if no data exists for requested section
    if section == "assessment" and not direct.get("co_summaries"):
        elements.append(Paragraph("<b>Note:</b> No direct assessment marks evaluated yet. Please ensure student marks are uploaded and calculated.", bold_cell))
        elements.append(Spacer(1, 14))

    # Section 1: Direct CO Attainment Summary (Include for "all" or "assessment")
    if section in ["all", "assessment"] and direct.get("co_summaries"):
        elements.append(Paragraph("1. Direct Course Outcome (CO) Attainment Summary", h2_style))
        if has_any_ese:
            co_headers = [
                Paragraph("CO", header_cell),
                Paragraph("Mapped Tools", header_cell),
                Paragraph("Max Marks", header_cell),
                Paragraph("Passed / Appeared", header_cell),
                Paragraph("Pass %", header_cell),
                Paragraph("Internal (CCE/UT)", header_cell),
                Paragraph("ESE (External)", header_cell),
                Paragraph("Direct Attainment", header_cell),
                Paragraph("Attainment Level", header_cell),
            ]
            co_col_widths = [30, 95, 45, 65, 45, 65, 65, 60, 70]
        else:
            # When NO ESE marks exist, remove ESE column completely!
            co_headers = [
                Paragraph("CO", header_cell),
                Paragraph("Mapped Assessment Tools", header_cell),
                Paragraph("Max Marks", header_cell),
                Paragraph("Passed / Appeared", header_cell),
                Paragraph("Pass %", header_cell),
                Paragraph("Direct Attainment", header_cell),
                Paragraph("Attainment Level", header_cell),
            ]
            co_col_widths = [40, 150, 60, 80, 60, 75, 75]

        co_rows = [co_headers]
        for c in direct.get("co_summaries", []):
            if has_any_ese:
                int_text = str(c.get('internal_attainment', '-')) if c.get('has_internal') else "N/A"
                ese_text = str(c.get('ese_attainment', '-')) if c.get('has_ese') else "N/A"
                co_rows.append([
                    Paragraph(str(c.get('co')), bold_cell),
                    Paragraph(str(c.get('mapped_assessments')), normal_cell),
                    Paragraph(str(c.get('max_marks')), normal_cell),
                    Paragraph(f"{c.get('students_passed')}/{c.get('students_appeared')}", normal_cell),
                    Paragraph(f"{c.get('pass_percentage')}%", bold_cell),
                    Paragraph(int_text, normal_cell),
                    Paragraph(ese_text, normal_cell),
                    Paragraph(str(c.get('attainment')), bold_cell),
                    Paragraph(str(c.get('level_label', '-')), bold_cell),
                ])
            else:
                co_rows.append([
                    Paragraph(str(c.get('co')), bold_cell),
                    Paragraph(str(c.get('mapped_assessments')), normal_cell),
                    Paragraph(str(c.get('max_marks')), normal_cell),
                    Paragraph(f"{c.get('students_passed')}/{c.get('students_appeared')}", normal_cell),
                    Paragraph(f"{c.get('pass_percentage')}%", bold_cell),
                    Paragraph(str(c.get('attainment')), bold_cell),
                    Paragraph(str(c.get('level_label', '-')), bold_cell),
                ])

        co_table = Table(co_rows, colWidths=co_col_widths)
        co_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
            ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#CBD5E1')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        elements.append(co_table)
        elements.append(Spacer(1, 8))

    # Section 2: Assessment Tools Summary (Include for "all" or "assessment")
    if section in ["all", "assessment"] and direct.get("assessment_summaries"):
        elements.append(Paragraph("2. Assessment Tools Breakdown", h2_style))
        ass_headers = [
            Paragraph("Tool Name", header_cell),
            Paragraph("Mapped COs", header_cell),
            Paragraph("Max Marks", header_cell),
            Paragraph("Passing Mark", header_cell),
            Paragraph("Appeared", header_cell),
            Paragraph("Passed", header_cell),
            Paragraph("Failed", header_cell),
            Paragraph("Pass %", header_cell),
            Paragraph("Average Marks", header_cell),
        ]
        ass_rows = [ass_headers]
        for a in direct.get("assessment_summaries", []):
            ass_rows.append([
                Paragraph(str(a.get('name')), bold_cell),
                Paragraph(str(a.get('mapped_cos')), normal_cell),
                Paragraph(str(a.get('max_marks')), normal_cell),
                Paragraph(str(a.get('passing_mark')), normal_cell),
                Paragraph(str(a.get('appeared')), normal_cell),
                Paragraph(str(a.get('passed')), normal_cell),
                Paragraph(str(a.get('failed')), normal_cell),
                Paragraph(f"{a.get('pass_pct')}%", bold_cell),
                Paragraph(str(a.get('avg_marks')), normal_cell),
            ])

        ass_table = Table(ass_rows, colWidths=[80, 70, 50, 55, 45, 45, 45, 55, 95])
        ass_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F766E')),
            ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#CBD5E1')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        elements.append(ass_table)
        elements.append(Spacer(1, 8))

    # Section 3: Weighted Combined CO Attainment (Include for "all" or "assessment")
    if section in ["all", "assessment"] and weighted.get("combined_results"):
        elements.append(Paragraph("3. Combined Weighted Course Outcome Attainment", h2_style))
        w_headers = [
            Paragraph("CO", header_cell),
            Paragraph("Direct %", header_cell),
            Paragraph(f"Direct ({weighted.get('direct_weight', 80)}%)", header_cell),
            Paragraph("Direct Att.", header_cell),
            Paragraph("Indirect %", header_cell),
            Paragraph(f"Indirect ({weighted.get('indirect_weight', 20)}%)", header_cell),
            Paragraph("Indirect Att.", header_cell),
            Paragraph("Combined %", header_cell),
            Paragraph("Combined Att.", header_cell),
            Paragraph("Attainment Level", header_cell),
        ]
        w_rows = [w_headers]
        for w in weighted.get("combined_results", []):
            w_rows.append([
                Paragraph(str(w.get('co')), bold_cell),
                Paragraph(f"{w.get('direct_pct')}%", normal_cell),
                Paragraph(f"{w.get('direct_contribution')}%", normal_cell),
                Paragraph(str(w.get('direct_attainment')), normal_cell),
                Paragraph(f"{w.get('indirect_pct')}%", normal_cell),
                Paragraph(f"{w.get('indirect_contribution')}%", normal_cell),
                Paragraph(str(w.get('indirect_attainment')), normal_cell),
                Paragraph(f"{w.get('combined_pct')}%", bold_cell),
                Paragraph(str(w.get('combined_attainment')), bold_cell),
                Paragraph(str(w.get('level_label')), bold_cell),
            ])
        w_table = Table(w_rows, colWidths=[35, 50, 60, 55, 50, 60, 55, 50, 60, 65])
        w_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
            ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#CBD5E1')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        elements.append(w_table)
        elements.append(Spacer(1, 8))

    # Section 4a: CO-PO & PSO Correlation Matrix (PO1..PO11, PSO1..PSO3) (Include for "all" or "copo")
    if section in ["all", "copo"] and copo.get("matrix") and copo.get("po_list") and copo.get("co_list"):
        elements.append(Paragraph("4a. Course Outcome to Program Outcome Correlation Matrix", h2_style))
        matrix = copo.get("matrix", {})
        po_list = copo.get("po_list", [])
        co_list = copo.get("co_list", [])
        m_headers = [Paragraph("CO", header_cell)] + [Paragraph(po, header_cell) for po in po_list]
        m_rows = [m_headers]
        for co in co_list:
            row_cells = [Paragraph(co, bold_cell)]
            for po in po_list:
                val = matrix.get(co, {}).get(po, '-')
                val_str = str(val) if val not in [0, 0.0, None, '-', '0'] else '-'
                row_cells.append(Paragraph(val_str, normal_cell))
            m_rows.append(row_cells)

        col_w = min(35, (540 - 70) / max(1, len(po_list)))
        po_results = copo.get("po_results", [])
        po_map = {p.get("po"): p for p in po_results}

        # 4 summary rows at bottom of matrix (DY Patil format)
        if po_results:
            summary_configs = [
                ("Mapping Avg", "mapping_avg"),
                ("Direct PO Att.", "direct_attainment"),
                ("Indirect PO Att.", "indirect_attainment"),
                ("Final Att.", "attainment")
            ]
            for lbl, k in summary_configs:
                row_cells = [Paragraph(lbl, bold_cell)]
                for po in po_list:
                    p_obj = po_map.get(po, {})
                    v = p_obj.get(k)
                    v_str = str(v) if v is not None and v != '' else '-'
                    row_cells.append(Paragraph(v_str, bold_cell))
                m_rows.append(row_cells)

        m_table = Table(m_rows, colWidths=[70] + [col_w] * len(po_list))
        m_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F766E')),
            ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#CBD5E1')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        elements.append(m_table)
        elements.append(Spacer(1, 8))

    # Section 4b: PO & PSO Attainment Table (Include for "all" or "copo")
    if section in ["all", "copo"] and copo.get("po_results"):
        elements.append(Paragraph("4b. Program Outcome (PO &amp; PSO) Attainment Results", h2_style))
        po_headers = [
            Paragraph("PO / PSO", header_cell),
            Paragraph("Mapping Sum", header_cell),
            Paragraph("Avg Map", header_cell),
            Paragraph("Direct PO", header_cell),
            Paragraph("Indirect PO", header_cell),
            Paragraph("Final PO (0-3)", header_cell),
            Paragraph("Attainment Level", header_cell),
        ]
        po_rows = [po_headers]
        for p in copo.get("po_results", []):
            att_3 = str(p.get('attainment', '-')) if p.get('attainment') is not None else "N/A"
            dir_3 = str(p.get('direct_attainment', '-')) if p.get('direct_attainment') is not None else "N/A"
            ind_3 = str(p.get('indirect_attainment', '-')) if p.get('indirect_attainment') is not None else "N/A"
            avg_m = str(p.get('mapping_avg', '-')) if p.get('mapping_avg') is not None else "N/A"
            po_rows.append([
                Paragraph(str(p.get('po')), bold_cell),
                Paragraph(str(p.get('mapping_sum')), normal_cell),
                Paragraph(avg_m, bold_cell),
                Paragraph(dir_3, normal_cell),
                Paragraph(ind_3, normal_cell),
                Paragraph(att_3, bold_cell),
                Paragraph(str(p.get('level_label')), bold_cell),
            ])
        po_table = Table(po_rows, colWidths=[65, 65, 65, 75, 75, 75, 120])
        po_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563EB')),
            ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#CBD5E1')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        elements.append(po_table)
        elements.append(Spacer(1, 8))

    # Section 5: Visual Analytics Profile (Filtered appropriately by section)
    if include_charts:
        charts_to_show = []
        if section in ["all", "assessment"]:
            c1 = create_co_passing_drawing(direct)
            if c1:
                charts_to_show.append(("<b>Graph 1: Students Passing Each Course Outcome (&ge;50% Marks)</b>", c1))
            c2 = create_direct_attainment_drawing(direct)
            if c2:
                charts_to_show.append(("<b>Graph 2: Direct Course Outcome Attainment Scores (0-3 Points Scale)</b>", c2))
        
        if section == "all":
            c4 = create_co_barchart_drawing(weighted)
            if c4:
                charts_to_show.append(("<b>Graph 3: Course Outcome Attainment Comparison (Green: Direct | Amber: Indirect | Red: Combined)</b>", c4))

        if section in ["all", "copo"]:
            c5 = create_po_direct_barchart_drawing(copo)
            if c5:
                charts_to_show.append(("<b>Graph 4: CO-PO-PSO Direct Attainment Profile (Blue: Mapping Level | Red: Direct PO Attainment)</b>", c5))
            c6 = create_po_indirect_barchart_drawing(copo)
            if c6:
                charts_to_show.append(("<b>Graph 5: CO-PO-PSO Indirect Attainment Profile (Blue: Mapping Level | Red: Indirect PO Attainment)</b>", c6))

        if charts_to_show:
            elements.append(PageBreak())
            elements.append(Paragraph("Visual Analytics &amp; Performance Profiles", h2_style))
            elements.append(Spacer(1, 4))
            for title_text, drawing in charts_to_show:
                elements.append(Paragraph(title_text, bold_cell))
                elements.append(drawing)
                elements.append(Spacer(1, 10))

    # Faculty & Authority Signatures block
    elements.append(Spacer(1, 14))
    sig_data = [
        [Paragraph("<b>Course Faculty</b><br/><br/><br/>Signature", normal_cell),
         Paragraph("<b>Module Coordinator</b><br/><br/><br/>Signature", normal_cell),
         Paragraph("<b>Head of Department (HOD)</b><br/><br/><br/>Signature &amp; Stamp", normal_cell)]
    ]
    sig_table = Table(sig_data, colWidths=[2.5*inch, 2.5*inch, 2.5*inch])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(sig_table)

    # Build document with running header & footer on every page
    doc.build(elements, onFirstPage=draw_page_decorations, onLaterPages=draw_page_decorations)
    buffer.seek(0)
    return buffer


def create_slow_fast_learners_pdf(report_data: Dict[str, Any], learners_data: Dict[str, Any]) -> io.BytesIO:
    """
    Generates a dedicated, professional PDF report for Slow and Fast Learners identification.
    Includes Institutional Header, 2-line teacher info, categorization criteria, and clear student tables.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=32,
        bottomMargin=32
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=colors.HexColor('#0F172A'),
        alignment=1,
        spaceAfter=4
    )

    h2_style = ParagraphStyle(
        'DocH2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=13,
        textColor=colors.HexColor('#1E3A8A'),
        spaceBefore=8,
        spaceAfter=4
    )

    bold_cell = ParagraphStyle(
        'BoldCell',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#0F172A')
    )

    normal_cell = ParagraphStyle(
        'NormalCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#0F172A')
    )

    header_cell = ParagraphStyle(
        'HeaderCell',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.white,
        alignment=1
    )

    elements = []
    teacher = report_data.get('teacher') or {}

    # 1. Institution Header
    elements.extend(build_institution_header(styles))

    # 2. Document Title
    elements.append(Paragraph("STUDENT CATEGORIZATION REPORT: SLOW & ADVANCED LEARNERS", title_style))
    elements.append(Spacer(1, 4))

    # 3. 2-Line Teacher Info Box
    overall_att = str(report_data.get('weighted', {}).get('data', {}).get('overall_attainment', 'Evaluated'))
    overall_lvl = str(report_data.get('weighted', {}).get('data', {}).get('overall_level_label', 'Active'))
    elements.append(build_two_line_teacher_box(teacher, overall_att, overall_lvl, normal_cell))
    elements.append(Spacer(1, 8))

    # 4. Identification Thresholds Banner
    target_ass = learners_data.get('target_assessment', 'Overall Evaluation')
    slow_th_pct = learners_data.get('slow_threshold_pct', 50.0)
    fast_th_pct = learners_data.get('advanced_threshold_pct') or learners_data.get('fast_threshold_pct', 70.0)
    slow_th_m = learners_data.get('slow_threshold_marks')
    fast_th_m = learners_data.get('advanced_threshold_marks') or learners_data.get('fast_threshold_marks')
    max_m = learners_data.get('target_max_marks', 100.0)
    tot_eval = learners_data.get('total_evaluated', 0)
    fast_cnt = learners_data.get('advanced_count') or learners_data.get('fast_count', 0)
    fast_pct = learners_data.get('advanced_pct') or learners_data.get('fast_pct', 0.0)
    slow_cnt = learners_data.get('slow_count', 0)
    slow_pct = learners_data.get('slow_pct', 0.0)

    fast_crit_str = f"&ge; {fast_th_m} / {max_m} ({fast_th_pct}%)" if fast_th_m is not None else f"&ge; {fast_th_pct}%"
    slow_crit_str = f"&lt; {slow_th_m} / {max_m} ({slow_th_pct}%)" if slow_th_m is not None else f"&lt; {slow_th_pct}%"

    criteria_html = (
        f"<b>Categorization Assessment:</b> {target_ass} &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"<b>Advanced Learner Threshold:</b> {fast_crit_str} &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"<b>Slow Learner Threshold:</b> {slow_crit_str}<br/>"
        f"<b>Total Evaluated:</b> {tot_eval} &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"<b>Identified Advanced Learners:</b> {fast_cnt} &bull; {fast_pct}% &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"<b>Identified Slow Learners:</b> {slow_cnt} &bull; {slow_pct}%"
    )
    criteria_table = Table([[Paragraph(criteria_html, normal_cell)]], colWidths=[540])
    criteria_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#EFF6FF')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#93C5FD')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(criteria_table)
    elements.append(Spacer(1, 8))

    # 5. Table 1: Advanced Learners List
    fast_learners = learners_data.get('advanced_learners') or learners_data.get('fast_learners', [])
    elements.append(Paragraph(f"1. Identified Advanced Learners (Marks {fast_crit_str}) - Total: {len(fast_learners)} Students", h2_style))
    f_headers = [
        Paragraph("Sr.", header_cell),
        Paragraph("Roll No", header_cell),
        Paragraph("Student Name", header_cell),
        Paragraph("Marks Obtained", header_cell),
        Paragraph("Out Of", header_cell),
    ]
    f_rows = [f_headers]
    if fast_learners:
        for idx, fl in enumerate(fast_learners, start=1):
            f_rows.append([
                Paragraph(str(idx), normal_cell),
                Paragraph(str(fl.get('roll_no')), bold_cell),
                Paragraph(str(fl.get('name')), normal_cell),
                Paragraph(str(fl.get('marks_obtained', '-')), bold_cell),
                Paragraph(str(fl.get('max_marks', '-')), normal_cell),
            ])
    else:
        f_rows.append([Paragraph("No students met the Advanced Learner criteria.", normal_cell), Paragraph("-", normal_cell), Paragraph("-", normal_cell), Paragraph("-", normal_cell), Paragraph("-", normal_cell)])

    f_table = Table(f_rows, colWidths=[0.5*inch, 1.3*inch, 3.5*inch, 1.1*inch, 1.1*inch])
    f_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#166534')),
        ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#CBD5E1')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F0FDF4')]),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (3, 0), (4, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
    ]))
    elements.append(f_table)
    elements.append(Spacer(1, 10))

    # 6. Table 2: Slow Learners List
    slow_learners = learners_data.get('slow_learners', [])
    elements.append(Paragraph(f"2. Identified Slow Learners (Marks {slow_crit_str}) - Total: {len(slow_learners)} Students", h2_style))
    s_headers = [
        Paragraph("Sr.", header_cell),
        Paragraph("Roll No", header_cell),
        Paragraph("Student Name", header_cell),
        Paragraph("Marks Obtained", header_cell),
        Paragraph("Out Of", header_cell),
    ]
    s_rows = [s_headers]
    if slow_learners:
        for idx, sl in enumerate(slow_learners, start=1):
            s_rows.append([
                Paragraph(str(idx), normal_cell),
                Paragraph(str(sl.get('roll_no')), bold_cell),
                Paragraph(str(sl.get('name')), normal_cell),
                Paragraph(str(sl.get('marks_obtained', '-')), bold_cell),
                Paragraph(str(sl.get('max_marks', '-')), normal_cell),
            ])
    else:
        s_rows.append([Paragraph("No students met the Slow Learner criteria.", normal_cell), Paragraph("-", normal_cell), Paragraph("-", normal_cell), Paragraph("-", normal_cell), Paragraph("-", normal_cell)])

    s_table = Table(s_rows, colWidths=[0.5*inch, 1.3*inch, 3.5*inch, 1.1*inch, 1.1*inch])
    s_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#991B1B')),
        ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#CBD5E1')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#FEF2F2')]),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (3, 0), (4, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
    ]))
    elements.append(s_table)
    elements.append(Spacer(1, 14))

    # 7. Signature Block
    sig_data = [
        [Paragraph("<b>Course Faculty</b><br/><br/><br/>Signature", normal_cell),
         Paragraph("<b>Class Teacher / Mentor</b><br/><br/><br/>Signature", normal_cell),
         Paragraph("<b>Head of Department (HOD)</b><br/><br/><br/>Signature &amp; Stamp", normal_cell)]
    ]
    sig_table = Table(sig_data, colWidths=[2.5*inch, 2.5*inch, 2.5*inch])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(sig_table)

    doc.build(elements, onFirstPage=draw_page_decorations, onLaterPages=draw_page_decorations)
    buffer.seek(0)
    return buffer
