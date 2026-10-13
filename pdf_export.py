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
    """Renders teacher and course info in a compact, elegant 2-line box."""
    f_name = teacher.get('faculty_name', 'N/A') or 'N/A'
    subj = teacher.get('subject', 'N/A') or 'N/A'
    cls_name = teacher.get('class_name', 'N/A') or 'N/A'
    div_name = teacher.get('division', 'A') or 'A'
    ay = teacher.get('academic_year', 'N/A') or 'N/A'
    sem = teacher.get('semester', 'N/A') or 'N/A'

    line1 = f"<b>Faculty Name:</b> {f_name} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Subject:</b> {subj} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Class:</b> {cls_name} ({div_name})"
    line2 = f"<b>Academic Year:</b> {ay} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Semester:</b> {sem} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Overall Attainment:</b> {overall_att} / 3.00 ({overall_lvl})"

    t_data = [
        [Paragraph(line1, normal_cell)],
        [Paragraph(line2, normal_cell)]
    ]
    t_box = Table(t_data, colWidths=[540])
    t_box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
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

    d = Drawing(520, 115)
    chart = VerticalBarChart()
    chart.x = 40
    chart.y = 15
    chart.height = 85
    chart.width = 460
    chart.data = [passed]
    chart.categoryAxis.categoryNames = cos
    chart.categoryAxis.labels.fontSize = 8
    chart.valueAxis.valueMin = 0
    chart.valueAxis.valueMax = max(total_students, max(passed + [1]))
    chart.valueAxis.labels.fontSize = 7
    chart.bars[0].fillColor = colors.HexColor('#2563EB')
    d.add(chart)
    return d


def create_direct_attainment_drawing(direct: Dict[str, Any]) -> Any:
    """Graph 2: Direct Course Outcome Attainment values (0-3 Points Scale)."""
    co_summaries = direct.get('co_summaries', [])
    if not co_summaries:
        return None
    cos = [str(c.get('co', '')) for c in co_summaries][:8]
    atts = [float(c.get('attainment', 0) or 0) for c in co_summaries][:8]

    d = Drawing(520, 115)
    chart = VerticalBarChart()
    chart.x = 40
    chart.y = 15
    chart.height = 85
    chart.width = 460
    chart.data = [atts]
    chart.categoryAxis.categoryNames = cos
    chart.categoryAxis.labels.fontSize = 8
    chart.valueAxis.valueMin = 0.0
    chart.valueAxis.valueMax = 3.0
    chart.valueAxis.valueStep = 0.5
    chart.valueAxis.labels.fontSize = 7
    chart.bars[0].fillColor = colors.HexColor('#10B981')
    d.add(chart)
    return d


def create_score_distribution_drawing(direct: Dict[str, Any]) -> Any:
    """Graph 3: Student Overall Performance Score Distribution."""
    ranges = direct.get('score_ranges', {})
    if not ranges:
        return None
    categories = list(ranges.keys())
    counts = [int(v) for v in ranges.values()]

    d = Drawing(520, 115)
    chart = VerticalBarChart()
    chart.x = 40
    chart.y = 15
    chart.height = 85
    chart.width = 460
    chart.data = [counts]
    chart.categoryAxis.categoryNames = categories
    chart.categoryAxis.labels.fontSize = 8
    chart.valueAxis.valueMin = 0
    chart.valueAxis.valueMax = max(counts + [1])
    chart.valueAxis.labels.fontSize = 7
    chart.bars[0].fillColor = colors.HexColor('#F59E0B')
    d.add(chart)
    return d


def create_co_barchart_drawing(weighted: Dict[str, Any]) -> Any:
    """Graph 4: Combined multi-bar comparison (Direct vs Indirect vs Combined Attainment)."""
    results = weighted.get("combined_results", [])
    if not results:
        return None
    cos = [str(r.get('co', '')) for r in results][:8]
    direct_data = [float(r.get('direct_attainment', 0) or 0) for r in results][:8]
    indirect_data = [float(r.get('indirect_attainment', 0) or 0) for r in results][:8]
    combined_data = [float(r.get('combined_attainment', 0) or 0) for r in results][:8]

    d = Drawing(520, 125)
    chart = VerticalBarChart()
    chart.x = 40
    chart.y = 15
    chart.height = 95
    chart.width = 460
    chart.data = [direct_data, indirect_data, combined_data]
    chart.categoryAxis.categoryNames = cos
    chart.categoryAxis.labels.fontSize = 8
    chart.valueAxis.valueMin = 0.0
    chart.valueAxis.valueMax = 3.0
    chart.valueAxis.valueStep = 0.5
    chart.valueAxis.labels.fontSize = 7
    chart.bars[0].fillColor = colors.HexColor('#3B82F6')
    chart.bars[1].fillColor = colors.HexColor('#10B981')
    chart.bars[2].fillColor = colors.HexColor('#1E293B')
    d.add(chart)
    return d


def create_pdf_report(report_data: Dict[str, Any], include_charts: bool = True, section: str = "all") -> io.BytesIO:
    """
    Builds the accreditation-ready final PDF report.
    Includes DYP Akurdi header, 2-line faculty information, and comprehensive tables and charts.
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
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#0F172A'),
        alignment=1,
        spaceAfter=4
    )

    h2_style = ParagraphStyle(
        'DocH2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#1E3A8A'),
        spaceBefore=10,
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
        fontSize=8,
        leading=10,
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
    direct = (report_data.get('direct') or {}).get('data') or {}
    indirect = (report_data.get('indirect') or {}).get('data') or {}
    weighted = (report_data.get('weighted') or {}).get('data') or {}
    copo = report_data.get('copo') or {}

    # 1. Institution Header
    elements.extend(build_institution_header(styles))

    # 2. Document Title
    elements.append(Paragraph("COURSE OUTCOME & PROGRAM OUTCOME ATTAINMENT EVALUATION REPORT", title_style))
    elements.append(Spacer(1, 4))

    # 3. Simple 2-Line Teacher Info Box
    overall_att = str(weighted.get('overall_attainment', copo.get('overall_po_attainment', 'N/A')))
    overall_lvl = str(weighted.get('overall_level_label', copo.get('overall_po_level', 'Attained')))
    elements.append(build_two_line_teacher_box(teacher, overall_att, overall_lvl, normal_cell))
    elements.append(Spacer(1, 8))

    # Section 1: Direct CO Attainment Summary (with separate Internal vs ESE columns)
    if direct.get("co_summaries"):
        elements.append(Paragraph("1. Direct Course Outcome (CO) Attainment Summary", h2_style))
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
        co_rows = [co_headers]
        for c in direct.get("co_summaries", []):
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

        co_table = Table(co_rows, colWidths=[0.55*inch, 1.4*inch, 0.65*inch, 1.0*inch, 0.65*inch, 1.05*inch, 1.05*inch, 0.95*inch, 1.15*inch])
        co_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 2.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ]))
        elements.append(co_table)
        elements.append(Spacer(1, 8))

    # Section 2: Assessment Tools Summary
    if direct.get("assessment_summaries"):
        elements.append(Paragraph("2. Assessment Tools Breakdown (Internal vs External)", h2_style))
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

        ass_table = Table(ass_rows, colWidths=[1.1*inch, 1.0*inch, 0.75*inch, 0.8*inch, 0.65*inch, 0.65*inch, 0.65*inch, 0.75*inch, 1.05*inch])
        ass_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F766E')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 2.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ]))
        elements.append(ass_table)
        elements.append(Spacer(1, 8))

    # Section 3: Weighted Combined CO Attainment
    if weighted.get("combined_results"):
        elements.append(Paragraph("3. Combined Weighted Course Outcome Attainment", h2_style))
        w_headers = [
            Paragraph("CO", header_cell),
            Paragraph("Direct %", header_cell),
            Paragraph(f"Direct Contrib ({weighted.get('direct_weight', 80)}%)", header_cell),
            Paragraph("Direct Attain", header_cell),
            Paragraph("Indirect %", header_cell),
            Paragraph(f"Indirect Contrib ({weighted.get('indirect_weight', 20)}%)", header_cell),
            Paragraph("Indirect Attain", header_cell),
            Paragraph("Combined %", header_cell),
            Paragraph("Combined Attainment", header_cell),
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
        w_table = Table(w_rows, colWidths=[0.5*inch, 0.7*inch, 0.85*inch, 0.75*inch, 0.7*inch, 0.85*inch, 0.75*inch, 0.7*inch, 1.1*inch, 1.1*inch])
        w_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 2.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ]))
        elements.append(w_table)
        elements.append(Spacer(1, 8))

    # Section 4a: CO-PO & PSO Correlation Matrix (PO1..PO11, PSO1..PSO3)
    if copo.get("matrix") and copo.get("po_list") and copo.get("co_list"):
        elements.append(Paragraph("4a. Course Outcome to Program Outcome Correlation Matrix (PO1-PO11, PSO1-PSO3)", h2_style))
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

        col_w = min(0.48 * inch, 6.4 * inch / max(1, len(po_list) + 1))
        m_table = Table(m_rows, colWidths=[0.65 * inch] + [col_w] * len(po_list))
        m_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F766E')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        elements.append(m_table)
        elements.append(Spacer(1, 8))

    # Section 4b: PO & PSO Attainment Table
    if copo.get("po_results"):
        elements.append(Paragraph("4b. Program Outcome (PO & PSO) Attainment Results", h2_style))
        po_headers = [
            Paragraph("PO / PSO", header_cell),
            Paragraph("Mapping Level Sum", header_cell),
            Paragraph("Weighted CO Sum", header_cell),
            Paragraph("PO Attainment (0-3)", header_cell),
            Paragraph("Attainment Level", header_cell),
        ]
        po_rows = [po_headers]
        for p in copo.get("po_results", []):
            att_3 = str(p.get('attainment', '-')) if p.get('attainment') is not None else "N/A"
            po_rows.append([
                Paragraph(str(p.get('po')), bold_cell),
                Paragraph(str(p.get('mapping_sum')), normal_cell),
                Paragraph(str(p.get('weighted_sum')), normal_cell),
                Paragraph(att_3, bold_cell),
                Paragraph(str(p.get('level_label')), bold_cell),
            ])
        po_table = Table(po_rows, colWidths=[1.3*inch, 1.5*inch, 1.5*inch, 1.5*inch, 1.6*inch])
        po_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563EB')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 2.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ]))
        elements.append(po_table)
        elements.append(Spacer(1, 8))

    # Section 5: All Visual Analytics Profile (Including all 3 graphs from Page 2 + Comparison Graph)
    if include_charts:
        elements.append(PageBreak())
        elements.append(Paragraph("5. Visual Analytics & Course Outcome Performance Profiles", h2_style))
        elements.append(Spacer(1, 4))

        # Chart 1: Students Passing Each CO
        c1 = create_co_passing_drawing(direct)
        if c1:
            elements.append(Paragraph("<b>Graph 1: Students Passing Each Course Outcome (&ge;50% Marks)</b>", bold_cell))
            elements.append(c1)
            elements.append(Spacer(1, 8))

        # Chart 2: Direct CO Attainment
        c2 = create_direct_attainment_drawing(direct)
        if c2:
            elements.append(Paragraph("<b>Graph 2: Direct Course Outcome Attainment Scores (0-3 Points Scale)</b>", bold_cell))
            elements.append(c2)
            elements.append(Spacer(1, 8))

        # Chart 3: Score Distribution
        c3 = create_score_distribution_drawing(direct)
        if c3:
            elements.append(Paragraph("<b>Graph 3: Student Overall Performance Score Distribution</b>", bold_cell))
            elements.append(c3)
            elements.append(Spacer(1, 8))

        # Chart 4: Direct vs Indirect vs Combined Comparison
        c4 = create_co_barchart_drawing(weighted)
        if c4:
            elements.append(Paragraph("<b>Graph 4: Attainment Comparison Profile (Blue: Direct | Green: Indirect | Slate: Combined)</b>", bold_cell))
            elements.append(c4)
            elements.append(Spacer(1, 8))

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

    doc.build(elements)
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
    elements.append(Paragraph("STUDENT CATEGORIZATION REPORT: SLOW & FAST LEARNERS", title_style))
    elements.append(Spacer(1, 4))

    # 3. 2-Line Teacher Info Box
    overall_att = str(report_data.get('weighted', {}).get('data', {}).get('overall_attainment', 'Evaluated'))
    overall_lvl = str(report_data.get('weighted', {}).get('data', {}).get('overall_level_label', 'Active'))
    elements.append(build_two_line_teacher_box(teacher, overall_att, overall_lvl, normal_cell))
    elements.append(Spacer(1, 8))

    # 4. Identification Thresholds Banner
    target_ass = learners_data.get('target_assessment', 'Overall Evaluation')
    slow_th = learners_data.get('slow_threshold_pct', 50.0)
    fast_th = learners_data.get('fast_threshold_pct', 70.0)
    tot_eval = learners_data.get('total_evaluated', 0)
    fast_cnt = learners_data.get('fast_count', 0)
    fast_pct = learners_data.get('fast_pct', 0.0)
    slow_cnt = learners_data.get('slow_count', 0)
    slow_pct = learners_data.get('slow_pct', 0.0)

    criteria_html = (
        f"<b>Categorization Criteria:</b> {target_ass} &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"<b>Fast Learner Threshold:</b> &ge; {fast_th}% &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"<b>Slow Learner Threshold:</b> &lt; {slow_th}%<br/>"
        f"<b>Total Evaluated:</b> {tot_eval} &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"<b>Identified Fast Learners:</b> {fast_cnt} ({fast_pct}%) &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"<b>Identified Slow Learners:</b> {slow_cnt} ({slow_pct}%)"
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

    # 5. Table 1: Fast Learners List
    fast_learners = learners_data.get('fast_learners', [])
    elements.append(Paragraph(f"1. Identified Fast Learners (Score &ge; {fast_th}%) - Total: {len(fast_learners)} Students", h2_style))
    f_headers = [
        Paragraph("Sr.", header_cell),
        Paragraph("Roll No", header_cell),
        Paragraph("Student Name", header_cell),
        Paragraph("Score / Max", header_cell),
        Paragraph("Percentage", header_cell),
        Paragraph("Passed COs", header_cell),
        Paragraph("Advanced Learning Action Plan", header_cell),
    ]
    f_rows = [f_headers]
    if fast_learners:
        for idx, fl in enumerate(fast_learners, start=1):
            passed_str = ", ".join(fl.get('passed_cos', [])) or "All"
            f_rows.append([
                Paragraph(str(idx), normal_cell),
                Paragraph(str(fl.get('roll_no')), bold_cell),
                Paragraph(str(fl.get('name')), normal_cell),
                Paragraph(str(fl.get('score_display')), normal_cell),
                Paragraph(f"{fl.get('percentage')}%", bold_cell),
                Paragraph(passed_str, normal_cell),
                Paragraph(str(fl.get('action_plan')), normal_cell),
            ])
    else:
        f_rows.append([Paragraph("No students met the Fast Learner criteria.", normal_cell)] + [Paragraph("", normal_cell)] * 6)

    f_table = Table(f_rows, colWidths=[0.35*inch, 0.75*inch, 1.4*inch, 0.85*inch, 0.75*inch, 1.05*inch, 2.35*inch])
    f_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#166534')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
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
    elements.append(Paragraph(f"2. Identified Slow Learners (Score &lt; {slow_th}%) - Total: {len(slow_learners)} Students", h2_style))
    s_headers = [
        Paragraph("Sr.", header_cell),
        Paragraph("Roll No", header_cell),
        Paragraph("Student Name", header_cell),
        Paragraph("Score / Max", header_cell),
        Paragraph("Percentage", header_cell),
        Paragraph("Deficient COs", header_cell),
        Paragraph("Remedial Action Plan", header_cell),
    ]
    s_rows = [s_headers]
    if slow_learners:
        for idx, sl in enumerate(slow_learners, start=1):
            def_str = ", ".join(sl.get('deficient_cos', [])) or "Basic Practice"
            s_rows.append([
                Paragraph(str(idx), normal_cell),
                Paragraph(str(sl.get('roll_no')), bold_cell),
                Paragraph(str(sl.get('name')), normal_cell),
                Paragraph(str(sl.get('score_display')), normal_cell),
                Paragraph(f"{sl.get('percentage')}%", bold_cell),
                Paragraph(def_str, normal_cell),
                Paragraph(str(sl.get('action_plan')), normal_cell),
            ])
    else:
        s_rows.append([Paragraph("No students met the Slow Learner criteria.", normal_cell)] + [Paragraph("", normal_cell)] * 6)

    s_table = Table(s_rows, colWidths=[0.35*inch, 0.75*inch, 1.4*inch, 0.85*inch, 0.75*inch, 1.05*inch, 2.35*inch])
    s_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#991B1B')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
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

    doc.build(elements)
    buffer.seek(0)
    return buffer
