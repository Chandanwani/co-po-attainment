"""
PDF Report Generator for CO-PO Attainment System.
Generates accreditation-ready, multi-page PDF documents using ReportLab.
Includes Teacher metadata, Assessment summaries, Student performance,
Direct CO attainment (with separate Internal vs ESE breakdown), Indirect ratings,
Weighted combinations, and CO-PO mapping & PO attainment.
"""

import io
from typing import Dict, Any, List
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.graphics.shapes import Drawing, Rect, String, Line
from reportlab.graphics.charts.barcharts import VerticalBarChart


def create_co_barchart_drawing(weighted: Dict[str, Any]) -> Any:
    """Creates a ReportLab drawing comparing Direct, Indirect, and Combined attainment."""
    results = weighted.get("combined_results", [])
    if not results:
        return None
    cos = [str(r.get('co', '')) for r in results][:8]
    direct_data = [float(r.get('direct_attainment', 0) or 0) for r in results][:8]
    indirect_data = [float(r.get('indirect_attainment', 0) or 0) for r in results][:8]
    combined_data = [float(r.get('combined_attainment', 0) or 0) for r in results][:8]

    d = Drawing(520, 150)
    chart = VerticalBarChart()
    chart.x = 40
    chart.y = 20
    chart.height = 110
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
    Builds an accreditation-ready PDF report.
    Supports section filter: 'all' (comprehensive), 'assessment' (Page 2), 'copo' (Page 3).
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#1E293B'),
        alignment=1,  # Center
        spaceAfter=6
    )

    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#64748B'),
        alignment=1,
        spaceAfter=15
    )

    h2_style = ParagraphStyle(
        'DocH2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=colors.HexColor('#1E293B'),
        spaceBefore=12,
        spaceAfter=6
    )

    bold_cell = ParagraphStyle(
        'BoldCell',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
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
        fontSize=8,
        leading=10,
        textColor=colors.white,
        alignment=1
    )

    elements = []

    teacher = report_data.get('teacher') or {}
    direct = (report_data.get('direct') or {}).get('data') or {}
    indirect = (report_data.get('indirect') or {}).get('data') or {}
    weighted = (report_data.get('weighted') or {}).get('data') or {}
    copo = report_data.get('copo') or {}

    # Title Banner based on requested section
    if section == "assessment":
        title_text = "COURSE OUTCOME (CO) ASSESSMENT REPORT"
        sub_desc = "Direct continuous assessment (Internal CCE/UT vs ESE) & Indirect survey feedback"
    elif section == "copo":
        title_text = "CO-PO CORRELATION & PO ATTAINMENT REPORT"
        sub_desc = "Course Outcome to Program Outcome mapping matrix & PO/PSO attainment evaluation"
    else:
        title_text = "CO-PO ATTAINMENT EVALUATION REPORT"
        sub_desc = "Comprehensive accreditation analysis, direct/indirect assessment & CO-PO mapping"

    elements.append(Paragraph(title_text, title_style))
    sub_text = f"Course: {teacher.get('subject', 'N/A')} | Faculty: {teacher.get('faculty_name', 'N/A')} | Academic Year: {teacher.get('academic_year', 'N/A')}<br/><font size=8 color='#64748B'>{sub_desc}</font>"
    elements.append(Paragraph(sub_text, subtitle_style))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#2563EB'), spaceAfter=14))

    # Section 1: Faculty & Course Metadata
    elements.append(Paragraph("1. Course & Faculty Information", h2_style))
    if section == "copo":
        meta_table_data = [
            [Paragraph("Faculty Name", bold_cell), Paragraph(str(teacher.get('faculty_name', 'N/A')), normal_cell),
             Paragraph("Subject Code & Name", bold_cell), Paragraph(str(teacher.get('subject', 'N/A')), normal_cell)],
            [Paragraph("Class", bold_cell), Paragraph(str(teacher.get('class_name', 'N/A')), normal_cell),
             Paragraph("Division", bold_cell), Paragraph(str(teacher.get('division', 'N/A')), normal_cell)],
            [Paragraph("Semester", bold_cell), Paragraph(str(teacher.get('semester', 'N/A')), normal_cell),
             Paragraph("Academic Year", bold_cell), Paragraph(str(teacher.get('academic_year', 'N/A')), normal_cell)],
            [Paragraph("Overall PO Attainment", bold_cell), Paragraph(f"{copo.get('overall_po_attainment', 'N/A')} / 3.00", bold_cell),
             Paragraph("PO Attainment Level", bold_cell), Paragraph(str(copo.get('overall_po_level', 'N/A')), bold_cell)],
        ]
    else:
        meta_table_data = [
            [Paragraph("Faculty Name", bold_cell), Paragraph(str(teacher.get('faculty_name', 'N/A')), normal_cell),
             Paragraph("Subject Code & Name", bold_cell), Paragraph(str(teacher.get('subject', 'N/A')), normal_cell)],
            [Paragraph("Class", bold_cell), Paragraph(str(teacher.get('class_name', 'N/A')), normal_cell),
             Paragraph("Division", bold_cell), Paragraph(str(teacher.get('division', 'N/A')), normal_cell)],
            [Paragraph("Semester", bold_cell), Paragraph(str(teacher.get('semester', 'N/A')), normal_cell),
             Paragraph("Academic Year", bold_cell), Paragraph(str(teacher.get('academic_year', 'N/A')), normal_cell)],
            [Paragraph("Direct Weight", bold_cell), Paragraph(f"{weighted.get('direct_weight', 80)}%", normal_cell),
             Paragraph("Indirect Weight", bold_cell), Paragraph(f"{weighted.get('indirect_weight', 20)}%", normal_cell)],
            [Paragraph("Overall Course Attainment", bold_cell), Paragraph(f"{weighted.get('overall_attainment', 'N/A')} / 3.00", bold_cell),
             Paragraph("Attainment Level", bold_cell), Paragraph(str(weighted.get('overall_level_label', 'N/A')), bold_cell)],
        ]
    meta_table = Table(meta_table_data, colWidths=[1.4*inch, 2.1*inch, 1.4*inch, 2.1*inch])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#EFF6FF')),
        ('BACKGROUND', (2, 0), (2, -1), colors.HexColor('#EFF6FF')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 14))

    # Section 2: Direct CO Attainment Summary (with separate Internal vs ESE columns)
    if (section in ["all", "assessment"]) and direct.get("co_summaries"):
        elements.append(Paragraph("2. Direct Course Outcome (CO) Attainment Summary", h2_style))
        co_headers = [
            Paragraph("CO", header_cell),
            Paragraph("Mapped Tools", header_cell),
            Paragraph("Max Marks", header_cell),
            Paragraph("Students Passed", header_cell),
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

        co_table = Table(co_rows, colWidths=[0.6*inch, 1.5*inch, 0.65*inch, 0.95*inch, 0.65*inch, 1.05*inch, 1.05*inch, 0.85*inch, 1.1*inch])
        co_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        elements.append(co_table)
        elements.append(Spacer(1, 14))

    # Section 3: Assessment Tools Summary
    if (section in ["all", "assessment"]) and direct.get("assessment_summaries"):
        elements.append(Paragraph("3. Assessment Tools Summary (Internal CCE/UT vs ESE)", h2_style))
        ass_headers = [
            Paragraph("Tool Name", header_cell),
            Paragraph("Mapped COs", header_cell),
            Paragraph("Max Marks", header_cell),
            Paragraph("Passing Mark", header_cell),
            Paragraph("Appeared", header_cell),
            Paragraph("Passed", header_cell),
            Paragraph("Failed", header_cell),
            Paragraph("Pass %", header_cell),
            Paragraph("Average", header_cell),
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
        ass_table = Table(ass_rows, colWidths=[1.1*inch, 1.1*inch, 0.7*inch, 0.8*inch, 0.65*inch, 0.65*inch, 0.6*inch, 0.7*inch, 0.7*inch])
        ass_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#334155')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        elements.append(ass_table)
        elements.append(Spacer(1, 14))

    # Section 4: Combined Weighted CO Attainment
    if (section in ["all", "assessment"]) and weighted.get("combined_results"):
        elements.append(Paragraph("4. Combined Weighted CO Attainment (Direct + Indirect)", h2_style))
        w_headers = [
            Paragraph("CO", header_cell),
            Paragraph("Direct %", header_cell),
            Paragraph("Direct Contrib", header_cell),
            Paragraph("Indirect %", header_cell),
            Paragraph("Indirect Contrib", header_cell),
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
                Paragraph(f"{w.get('indirect_pct')}%", normal_cell),
                Paragraph(f"{w.get('indirect_contribution')}%", normal_cell),
                Paragraph(f"{w.get('combined_pct')}%", bold_cell),
                Paragraph(str(w.get('combined_attainment')), bold_cell),
                Paragraph(str(w.get('level_label')), bold_cell),
            ])
        w_table = Table(w_rows, colWidths=[0.6*inch, 0.9*inch, 1.05*inch, 0.9*inch, 1.05*inch, 0.9*inch, 1.2*inch, 1.4*inch])
        w_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        elements.append(w_table)
        elements.append(Spacer(1, 14))

    # Section 5: CO-PO Matrix & PO Attainment
    if (section in ["all", "copo"]):
        # 5a. CO-PO Correlation Matrix Table (when available)
        if copo.get("matrix") and copo.get("po_list") and copo.get("co_list"):
            elements.append(Paragraph("5a. CO-PO & PSO Correlation Matrix", h2_style))
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

            col_w = min(0.52 * inch, 6.2 * inch / max(1, len(po_list) + 1))
            m_table = Table(m_rows, colWidths=[0.75 * inch] + [col_w] * len(po_list))
            m_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F766E')),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 2.5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
            ]))
            elements.append(m_table)
            elements.append(Spacer(1, 14))

        # 5b. PO Attainment Table
        if copo.get("po_results"):
            elements.append(Paragraph("5b. Program Outcome (PO & PSO) Attainment", h2_style))
            po_headers = [
                Paragraph("PO / PSO", header_cell),
                Paragraph("Mapping Level Sum", header_cell),
                Paragraph("Weighted CO Sum", header_cell),
                Paragraph("PO Attainment", header_cell),
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
            po_table = Table(po_rows, colWidths=[1.2*inch, 1.6*inch, 1.6*inch, 1.5*inch, 1.5*inch])
            po_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563EB')),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ]))
            elements.append(po_table)

    # Optional Section 6: Visual Charts (Included only if user selected include_charts=True)
    if include_charts and (section in ["all", "assessment"]) and weighted.get("combined_results"):
        elements.append(Spacer(1, 14))
        elements.append(KeepTogether([
            Paragraph("6. Course Outcome Attainment Visual Profile", h2_style),
            Paragraph("Legend: Blue = Direct Attainment | Green = Indirect Attainment | Slate = Combined Attainment", subtitle_style),
            create_co_barchart_drawing(weighted) or Spacer(1, 10),
            Spacer(1, 10)
        ]))

    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    return buffer
