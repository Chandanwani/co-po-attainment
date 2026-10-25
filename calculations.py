"""
Calculations module for CO-PO Attainment System.
Implements OBE (Outcome-Based Education) attainment models,
exact GAPC/NBA guidelines, data normalization, and strict validations.
"""

import re
import math
from typing import Dict, List, Any, Tuple, Optional


def calculate_attainment_from_percentage(percentage: float) -> float:
    """
    Standard Attainment Formula (0 to 3 scale):
    Below 60%: attainment = percentage / 60
    60% to below 70%: attainment = 1 + (percentage - 60) / 10
    70% to below 80%: attainment = 2 + (percentage - 70) / 10
    80% or above: attainment = 3
    """
    if percentage < 0:
        return 0.0
    elif percentage < 60.0:
        return round(percentage / 60.0, 3)
    elif percentage < 70.0:
        return round(1.0 + (percentage - 60.0) / 10.0, 3)
    elif percentage < 80.0:
        return round(2.0 + (percentage - 70.0) / 10.0, 3)
    else:
        return 3.0


def calculate_attainment_0_to_1(percentage: float) -> float:
    """
    Normalized Attainment mapped to 0.0 to 1.0 range:
    Represents ratio of students attaining (or rating ratio), bounded between 0.0 and 1.0.
    """
    if percentage <= 0:
        return 0.0
    return round(min(100.0, max(0.0, percentage)) / 100.0, 3)


def get_attainment_level_label(attainment: float) -> str:
    """
    Returns OBE / GAPC 4.0 attainment level according to Lookup Table in points:
    - Attainment >= 3.0: Level 3
    - 2.0 <= Attainment < 3.0: Level 2.X (e.g., Level 2, Level 2.1, Level 2.5, Level 2.9)
    - 1.0 <= Attainment < 2.0: Level 1.X (e.g., Level 1, Level 1.1, Level 1.7, Level 1.9)
    - 0.0 < Attainment < 1.0: Level 0-1 (0.XX) (in range 0.0 to 1.0, not fixed to Level 0)
    - Attainment <= 0.0: Level 0
    """
    if attainment is None:
        return "N/A"
    try:
        val = float(attainment)
    except (ValueError, TypeError):
        return str(attainment)

    if val >= 2.95:
        return "Level 3"
    elif val >= 2.0:
        pts = round(val, 1)
        return f"Level {pts:.1f}" if pts != int(pts) else f"Level {int(pts)}"
    elif val >= 1.0:
        pts = round(val, 1)
        return f"Level {pts:.1f}" if pts != int(pts) else f"Level {int(pts)}"
    elif val > 0.0:
        pts = round(val, 2)
        return f"Level 0-1 ({pts:.2f})"
    else:
        return "Level 0"


def validate_and_compute_direct(
    students_data: List[Dict[str, Any]],
    column_configs: List[Dict[str, Any]],
    passing_threshold_ratio: float = 0.50
) -> Dict[str, Any]:
    """
    Validates direct student marks and computes:
    - Checked column marks validation (0 <= marks <= max_marks)
    - Rejection of invalid, negative, or blank marks on checked columns
    - Student-wise totals, percentages, and passed COs
    - Assessment summaries (Appeared, Passed, Failed, Pass %, Avg)
    - CO-level summaries & Attainment
    """
    errors = []
    
    # Filter only checked columns
    active_configs = [c for c in column_configs if c.get('checked', True)]
    
    if not active_configs:
        return {
            'success': False,
            'errors': ["No assessment columns are selected. Please select at least one assessment column."],
            'data': {}
        }
    
    # Validate column configs
    for col in active_configs:
        col_name = col.get('name', 'Unknown')
        max_m = col.get('max_marks')
        try:
            max_m_float = float(max_m)
            if max_m_float <= 0:
                errors.append(f"Assessment '{col_name}' has invalid maximum marks ({max_m}). Must be > 0.")
            col['max_marks'] = max_m_float
        except (ValueError, TypeError):
            errors.append(f"Assessment '{col_name}' has non-numeric maximum marks ({max_m}).")
        
        # Ensure mapped_cos is a list of clean CO names
        raw_cos = col.get('mapped_cos', [])
        if isinstance(raw_cos, str):
            mapped_cos = [c.strip().upper() for c in re.split(r'[,;\s]+', raw_cos) if c.strip()]
        else:
            mapped_cos = [str(c).strip().upper() for c in raw_cos if str(c).strip()]
        col['mapped_cos'] = mapped_cos
        if not mapped_cos:
            errors.append(f"Assessment '{col_name}' is not mapped to any CO. Please assign at least one CO.")

    if errors:
        return {'success': False, 'errors': errors, 'data': {}}

    # Validate each student row for checked columns
    validated_students = []
    assessment_stats = {
        col['name']: {
            'name': col['name'],
            'max_marks': col['max_marks'],
            'mapped_cos': col['mapped_cos'],
            'passing_mark': round(col['max_marks'] * passing_threshold_ratio, 2),
            'appeared': 0,
            'passed': 0,
            'failed': 0,
            'marks_list': []
        }
        for col in active_configs
    }
    
    # Distinct list of all active COs
    all_cos_set = set()
    for col in active_configs:
        for co in col['mapped_cos']:
            all_cos_set.add(co)
    all_cos = sorted(list(all_cos_set), key=lambda x: (int(re.search(r'\d+', x).group()) if re.search(r'\d+', x) else 999, x))

    total_max_marks_all = sum(col['max_marks'] for col in active_configs)

    for row_idx, student in enumerate(students_data, start=1):
        roll_no = str(student.get('roll_no', f"S{row_idx}")).strip()
        name = str(student.get('name', f"Student {row_idx}")).strip()
        marks_dict = student.get('marks', {})
        
        student_total_obtained = 0.0
        student_co_obtained = {co: 0.0 for co in all_cos}
        student_co_max = {co: 0.0 for co in all_cos}
        
        cleaned_student_marks = {}

        for col in active_configs:
            col_name = col['name']
            max_m = col['max_marks']
            raw_val = marks_dict.get(col_name)

            if raw_val is None or str(raw_val).strip() == "":
                errors.append(f"Row {row_idx} ({name}): Mark for assessment '{col_name}' is blank.")
                continue

            try:
                mark_val = float(str(raw_val).strip())
            except ValueError:
                errors.append(f"Row {row_idx} ({name}): Assessment '{col_name}' has non-numeric mark '{raw_val}'.")
                continue

            # Validation 0 <= mark <= max_marks
            if mark_val < 0:
                errors.append(f"Row {row_idx} ({name}): Assessment '{col_name}' has negative mark ({mark_val}).")
            elif mark_val > (max_m + 0.001):
                errors.append(f"Row {row_idx} ({name}): Assessment '{col_name}' mark ({mark_val}) exceeds maximum marks ({max_m}).")
            else:
                cleaned_student_marks[col_name] = mark_val
                student_total_obtained += mark_val
                
                # Stats for assessment
                ast = assessment_stats[col_name]
                ast['appeared'] += 1
                ast['marks_list'].append(mark_val)
                if mark_val >= ast['passing_mark']:
                    ast['passed'] += 1
                else:
                    ast['failed'] += 1
                
                # Attribute to mapped COs
                for co in col['mapped_cos']:
                    student_co_obtained[co] += mark_val
                    student_co_max[co] += max_m

        if errors:
            continue

        # Check student CO passing status (must score >= passing_threshold_ratio of max marks on that CO)
        passed_cos = []
        co_percentages = {}
        for co in all_cos:
            max_c = student_co_max[co]
            obt_c = student_co_obtained[co]
            if max_c > 0:
                co_pct = (obt_c / max_c) * 100.0
                co_percentages[co] = round(co_pct, 2)
                if (obt_c / max_c) >= passing_threshold_ratio:
                    passed_cos.append(co)
            else:
                co_percentages[co] = 0.0

        overall_pct = (student_total_obtained / total_max_marks_all * 100.0) if total_max_marks_all > 0 else 0.0

        validated_students.append({
            'row_idx': row_idx,
            'roll_no': roll_no,
            'name': name,
            'marks': cleaned_student_marks,
            'total_obtained': round(student_total_obtained, 2),
            'total_max': total_max_marks_all,
            'percentage': round(overall_pct, 2),
            'co_percentages': co_percentages,
            'passed_cos': passed_cos,
            'passed_all': len(passed_cos) == len(all_cos)
        })

    if errors:
        return {'success': False, 'errors': errors, 'data': {}}

    total_students_count = len(validated_students)
    if total_students_count == 0:
        return {'success': False, 'errors': ["No student records found to evaluate."], 'data': {}}

    # Compute assessment summaries
    summary_assessments = []
    for col_name, ast in assessment_stats.items():
        m_list = ast['marks_list']
        pass_pct = (ast['passed'] / ast['appeared'] * 100.0) if ast['appeared'] > 0 else 0.0
        avg_mark = (sum(m_list) / len(m_list)) if m_list else 0.0
        min_mark = min(m_list) if m_list else 0.0
        max_mark = max(m_list) if m_list else 0.0
        summary_assessments.append({
            'name': col_name,
            'mapped_cos': ", ".join(ast['mapped_cos']),
            'max_marks': ast['max_marks'],
            'passing_mark': ast['passing_mark'],
            'appeared': ast['appeared'],
            'passed': ast['passed'],
            'failed': ast['failed'],
            'pass_pct': round(pass_pct, 2),
            'avg_marks': round(avg_mark, 2),
            'min_marks': round(min_mark, 2),
            'max_marks_scored': round(max_mark, 2)
        })

    # Direct CO Attainment computation
    co_summaries = []
    
    # Identify Internal vs ESE (External) assessment configs
    def is_ese_col(name: str) -> bool:
        n_low = name.lower()
        return any(k in n_low for k in ['ese', 'end', 'sem', 'external', 'univ'])

    internal_configs = [c for c in active_configs if not is_ese_col(c['name'])]
    ese_configs = [c for c in active_configs if is_ese_col(c['name'])]

    for co in all_cos:
        # Count students who passed this CO overall
        passed_count = sum(1 for s in validated_students if co in s['passed_cos'])
        pass_pct = (passed_count / total_students_count) * 100.0
        attainment = calculate_attainment_from_percentage(pass_pct)
        attainment_0_1 = calculate_attainment_0_to_1(pass_pct)
        level_label = get_attainment_level_label(attainment)
        
        # Assessments mapped
        mapped_col_names = [c['name'] for c in active_configs if co in c['mapped_cos']]
        co_max_marks = sum(c['max_marks'] for c in active_configs if co in c['mapped_cos'])

        # Separate Internal (CCE/UT) Attainment for this CO
        int_cols = [c for c in internal_configs if co in c['mapped_cos']]
        if int_cols:
            int_passed = 0
            for s in validated_students:
                obt = sum(s['marks'].get(c['name'], 0.0) for c in int_cols)
                max_m = sum(c['max_marks'] for c in int_cols)
                if max_m > 0 and (obt / max_m) >= passing_threshold_ratio:
                    int_passed += 1
            int_pct = round((int_passed / total_students_count) * 100.0, 2)
            int_att = calculate_attainment_from_percentage(int_pct)
            int_att_0_1 = calculate_attainment_0_to_1(int_pct)
        else:
            int_passed, int_pct, int_att, int_att_0_1 = 0, 0.0, 0.0, 0.0

        # Separate ESE (External) Attainment for this CO
        ese_cols = [c for c in ese_configs if co in c['mapped_cos']]
        if ese_cols:
            ese_passed = 0
            for s in validated_students:
                obt = sum(s['marks'].get(c['name'], 0.0) for c in ese_cols)
                max_m = sum(c['max_marks'] for c in ese_cols)
                if max_m > 0 and (obt / max_m) >= passing_threshold_ratio:
                    ese_passed += 1
            ese_pct = round((ese_passed / total_students_count) * 100.0, 2)
            ese_att = calculate_attainment_from_percentage(ese_pct)
            ese_att_0_1 = calculate_attainment_0_to_1(ese_pct)
        else:
            ese_passed, ese_pct, ese_att, ese_att_0_1 = 0, 0.0, 0.0, 0.0

        co_summaries.append({
            'co': co,
            'mapped_assessments': ", ".join(mapped_col_names),
            'max_marks': co_max_marks,
            'students_appeared': total_students_count,
            'students_passed': passed_count,
            'pass_percentage': round(pass_pct, 2),
            'attainment': attainment,
            'attainment_0_1': attainment_0_1,
            'level_label': level_label,
            # Dedicated Internal vs ESE breakdown
            'internal_passed': int_passed,
            'internal_pass_pct': int_pct,
            'internal_attainment': int_att,
            'internal_attainment_0_1': int_att_0_1,
            'internal_level': get_attainment_level_label(int_att) if int_cols else "N/A",
            'ese_passed': ese_passed,
            'ese_pass_pct': ese_pct,
            'ese_attainment': ese_att,
            'ese_attainment_0_1': ese_att_0_1,
            'ese_level': get_attainment_level_label(ese_att) if ese_cols else "N/A",
            'has_internal': len(int_cols) > 0,
            'has_ese': len(ese_cols) > 0
        })

    # Overall Student Performance Distribution
    score_ranges = {
        ">=80%": sum(1 for s in validated_students if s['percentage'] >= 80),
        "70-79%": sum(1 for s in validated_students if 70 <= s['percentage'] < 80),
        "60-69%": sum(1 for s in validated_students if 60 <= s['percentage'] < 70),
        "50-59%": sum(1 for s in validated_students if 50 <= s['percentage'] < 60),
        "<50%": sum(1 for s in validated_students if s['percentage'] < 50)
    }

    avg_student_pct = sum(s['percentage'] for s in validated_students) / total_students_count

    # Separate assessment summaries for Internal vs ESE
    internal_summaries = [a for a in summary_assessments if not is_ese_col(a['name'])]
    ese_summaries = [a for a in summary_assessments if is_ese_col(a['name'])]

    return {
        'success': True,
        'errors': [],
        'data': {
            'active_columns': active_configs,
            'all_cos': all_cos,
            'total_students': total_students_count,
            'students': validated_students,
            'assessment_summaries': summary_assessments,
            'internal_summaries': internal_summaries,
            'ese_summaries': ese_summaries,
            'has_ese': len(ese_configs) > 0,
            'has_internal': len(internal_configs) > 0,
            'co_summaries': co_summaries,
            'score_ranges': score_ranges,
            'avg_student_pct': round(avg_student_pct, 2),
            'overall_passed_students': sum(1 for s in validated_students if s['percentage'] >= (passing_threshold_ratio * 100))
        }
    }


def validate_and_compute_indirect(
    ratings_data: List[Dict[str, Any]],
    max_rating: float = 10.0,
    co_columns_override: Optional[List[str]] = None,
    mapping_target: str = 'CO'
) -> Dict[str, Any]:
    """
    Validates indirect rating data:
    - Detects CO columns (e.g. CO1, CO2, CO3) or PO columns (PO1..PO12, PSO1..) based on mapping_target
    - Ignores non-target columns
    - Validates 0 <= rating <= max_rating
    - Computes Average rating, Rating percentage, and Indirect Attainment per outcome
    """
    errors = []
    if max_rating <= 0:
        return {'success': False, 'errors': ["Maximum rating must be greater than 0."], 'data': {}}

    if not ratings_data:
        return {'success': False, 'errors': ["No indirect ratings data provided."], 'data': {}}

    mapping_target = (mapping_target or 'CO').upper()

    # Detect outcome columns if not provided
    first_row = ratings_data[0]
    keys = list(first_row.keys())
    
    if co_columns_override:
        detected_cols = co_columns_override
    else:
        if mapping_target == 'PO':
            detected_cols = [
                k for k in keys 
                if re.match(r'^(PO|po|PSO|pso)[\s_-]*\d+', str(k).strip())
            ]
            if not detected_cols:
                detected_cols = [k for k in keys if "PO" in str(k).upper()]
        else:
            # Default CO pattern
            detected_cols = [
                k for k in keys 
                if re.match(r'^(CO|co)[\s_-]*\d+', str(k).strip())
            ]
            if not detected_cols:
                detected_cols = [k for k in keys if "CO" in str(k).upper()]

    if not detected_cols:
        target_label = "PO columns (e.g., PO1, PO2, PO3)" if mapping_target == 'PO' else "CO columns (e.g., CO1, CO2, CO3)"
        return {
            'success': False,
            'errors': [f"No {target_label} could be detected in indirect ratings data."],
            'data': {}
        }

    # Normalize target outcome names (e.g. "co 1" -> "CO1", "po 2" -> "PO2")
    co_map = {}
    for col in detected_cols:
        col_str = str(col).strip()
        m = re.search(r'\d+', col_str)
        if "PSO" in col_str.upper():
            std_name = f"PSO{m.group()}" if m else col_str.upper()
        elif "PO" in col_str.upper() and mapping_target == 'PO':
            std_name = f"PO{m.group()}" if m else col_str.upper()
        elif m:
            std_name = f"CO{m.group()}"
        else:
            std_name = col_str.upper()
        co_map[col] = std_name

    def sort_key(x):
        is_pso = 1 if 'PSO' in x else 0
        num = int(re.search(r'\d+', x).group()) if re.search(r'\d+', x) else 999
        return (is_pso, num, x)

    sorted_cos = sorted(list(set(co_map.values())), key=sort_key)
    co_ratings = {co: [] for co in sorted_cos}
    cleaned_rows = []

    for idx, row in enumerate(ratings_data, start=1):
        clean_row = {}
        for original_col, std_co in co_map.items():
            val = row.get(original_col)
            if val is None or str(val).strip() == "":
                errors.append(f"Indirect Row {idx}: Rating for '{std_co}' is blank.")
                continue

            try:
                num_val = float(str(val).strip())
            except ValueError:
                errors.append(f"Indirect Row {idx}: Rating for '{std_co}' is non-numeric ('{val}').")
                continue

            if num_val < 0:
                errors.append(f"Indirect Row {idx}: Rating for '{std_co}' is negative ({num_val}).")
            elif num_val > max_rating:
                errors.append(f"Indirect Row {idx}: Rating for '{std_co}' ({num_val}) exceeds max rating ({max_rating}).")
            else:
                clean_row[std_co] = num_val
                co_ratings[std_co].append(num_val)

        cleaned_rows.append(clean_row)

    if errors:
        return {'success': False, 'errors': errors, 'data': {}}

    co_summaries = []
    for co in sorted_cos:
        vals = co_ratings[co]
        if vals:
            avg_rating = sum(vals) / len(vals)
            rating_pct = (avg_rating / max_rating) * 100.0
            attainment = calculate_attainment_from_percentage(rating_pct)
            level_label = get_attainment_level_label(attainment)
        else:
            avg_rating = 0.0
            rating_pct = 0.0
            attainment = 0.0
            level_label = "Level 0 (Unattained)"

        co_summaries.append({
            'co': co,
            'response_count': len(vals),
            'max_rating': max_rating,
            'average_rating': round(avg_rating, 2),
            'rating_percentage': round(rating_pct, 2),
            'attainment': attainment,
            'attainment_0_1': calculate_attainment_0_to_1(rating_pct),
            'level_label': level_label
        })

    return {
        'success': True,
        'errors': [],
        'data': {
            'detected_cos': sorted_cos,
            'max_rating': max_rating,
            'total_responses': len(cleaned_rows),
            'cleaned_rows': cleaned_rows,
            'co_summaries': co_summaries,
            'mapping_target': mapping_target
        }
    }


def compute_weighted_co_attainment(
    direct_co_summaries: List[Dict[str, Any]],
    indirect_co_summaries: List[Dict[str, Any]],
    direct_weight: float = 80.0,
    indirect_weight: float = 20.0
) -> Dict[str, Any]:
    """
    Computes combined weighted CO attainment:
    Weighted direct contribution = direct percentage * direct weight / 100
    Weighted indirect contribution = indirect percentage * indirect weight / 100
    Combined percentage = weighted direct contribution + weighted indirect contribution
    Combined attainment = combined percentage / 100 * 3
    """
    if abs((direct_weight + indirect_weight) - 100.0) > 0.01:
        return {
            'success': False,
            'errors': [f"Weights must total exactly 100%. Current total: {direct_weight + indirect_weight}%"],
            'data': {}
        }

    direct_dict = {item['co']: item for item in direct_co_summaries}
    indirect_dict = {item['co']: item for item in indirect_co_summaries}

    # Combined list of COs
    all_cos = sorted(
        list(set(list(direct_dict.keys()) + list(indirect_dict.keys()))),
        key=lambda x: (int(re.search(r'\d+', x).group()) if re.search(r'\d+', x) else 999, x)
    )

    combined_results = []
    total_combined_attainment = 0.0
    total_combined_0_1 = 0.0

    for co in all_cos:
        d_item = direct_dict.get(co, {})
        i_item = indirect_dict.get(co, {})

        d_pct = d_item.get('pass_percentage', 0.0)
        i_pct = i_item.get('rating_percentage', 0.0)

        weighted_direct = (d_pct * direct_weight) / 100.0
        weighted_indirect = (i_pct * indirect_weight) / 100.0
        combined_pct = weighted_direct + weighted_indirect
        combined_attainment = round((combined_pct / 100.0) * 3.0, 3)
        combined_att_0_1 = calculate_attainment_0_to_1(combined_pct)
        total_combined_attainment += combined_attainment
        total_combined_0_1 += combined_att_0_1

        combined_results.append({
            'co': co,
            'direct_pct': round(d_pct, 2),
            'direct_weight': direct_weight,
            'direct_contribution': round(weighted_direct, 2),
            'direct_attainment': d_item.get('attainment', 0.0),
            'direct_attainment_0_1': d_item.get('attainment_0_1', calculate_attainment_0_to_1(d_pct)),
            'indirect_pct': round(i_pct, 2),
            'indirect_weight': indirect_weight,
            'indirect_contribution': round(weighted_indirect, 2),
            'indirect_attainment': i_item.get('attainment', 0.0),
            'indirect_attainment_0_1': i_item.get('attainment_0_1', calculate_attainment_0_to_1(i_pct)),
            'combined_pct': round(combined_pct, 2),
            'combined_attainment': combined_attainment,
            'combined_attainment_0_1': combined_att_0_1,
            'level_label': get_attainment_level_label(combined_attainment)
        })

    avg_attainment = round(total_combined_attainment / len(all_cos), 3) if all_cos else 0.0
    avg_0_1 = round(total_combined_0_1 / len(all_cos), 3) if all_cos else 0.0

    return {
        'success': True,
        'errors': [],
        'data': {
            'direct_weight': direct_weight,
            'indirect_weight': indirect_weight,
            'combined_results': combined_results,
            'overall_attainment': avg_attainment,
            'overall_attainment_0_1': avg_0_1,
            'overall_level_label': get_attainment_level_label(avg_attainment)
        }
    }


def compute_po_attainment(
    mapping_matrix: Dict[str, Dict[str, float]],
    co_attainments: Dict[str, float],
    po_list: Optional[List[str]] = None,
    co_list: Optional[List[str]] = None,
    direct_co_attainments: Optional[Dict[str, float]] = None,
    indirect_co_attainments: Optional[Dict[str, float]] = None
) -> Dict[str, Any]:
    """
    Computes PO & PSO attainment from mapped CO attainments:
    PO Attainment = sum(Mapping_ij * CO_Attainment_i) / sum(Mapping_ij)
    Also computes Direct and Indirect PO Attainment and Average Mapping level.
    """
    if co_list is None:
        co_list = sorted(
            list(mapping_matrix.keys()),
            key=lambda x: (int(re.search(r'\d+', x).group()) if re.search(r'\d+', x) else 999, x)
        )

    if po_list is None:
        po_set = set()
        for co, pos in mapping_matrix.items():
            for po in pos.keys():
                po_set.add(po)
        
        def po_sort_key(p):
            is_pso = 1 if "PSO" in p.upper() else 0
            m = re.search(r'\d+', p)
            num = int(m.group()) if m else 999
            return (is_pso, num, p)

        po_list = sorted(list(po_set), key=po_sort_key)

    po_results = []
    mapping_averages = {}
    
    for po in po_list:
        weighted_sum = 0.0
        mapping_sum = 0.0
        direct_weighted_sum = 0.0
        indirect_weighted_sum = 0.0
        contributing_cos = []

        for co in co_list:
            level = mapping_matrix.get(co, {}).get(po, 0.0)
            try:
                level_float = float(level)
            except (ValueError, TypeError):
                level_float = 0.0

            if level_float > 0:
                co_att = co_attainments.get(co, 0.0)
                weighted_sum += (level_float * co_att)
                mapping_sum += level_float
                contributing_cos.append({'co': co, 'level': level_float, 'co_attainment': co_att})

                if direct_co_attainments is not None:
                    d_att = direct_co_attainments.get(co, 0.0)
                    direct_weighted_sum += (level_float * d_att)

                if indirect_co_attainments is not None:
                    i_att = indirect_co_attainments.get(co, 0.0)
                    indirect_weighted_sum += (level_float * i_att)

        # Average mapping level across all course COs (reference DY Patil format)
        mapping_avg = round(mapping_sum / len(co_list), 2) if co_list else 0.0
        mapping_averages[po] = mapping_avg

        if mapping_sum > 0:
            po_att = round(weighted_sum / mapping_sum, 3)
            po_att_0_1 = round(po_att / 3.0, 3) if po_att <= 3.0 else round(po_att, 3)
            level_label = get_attainment_level_label(po_att)
            direct_po_att = round(direct_weighted_sum / mapping_sum, 3) if direct_co_attainments is not None else po_att
            indirect_po_att = round(indirect_weighted_sum / mapping_sum, 3) if indirect_co_attainments is not None else None
        else:
            po_att = None
            po_att_0_1 = None
            level_label = "Not Mapped"
            direct_po_att = 0.0
            indirect_po_att = 0.0

        po_results.append({
            'po': po,
            'mapping_sum': round(mapping_sum, 2),
            'mapping_avg': mapping_avg,
            'weighted_sum': round(weighted_sum, 3),
            'direct_attainment': direct_po_att,
            'indirect_attainment': indirect_po_att,
            'attainment': po_att,
            'attainment_0_1': po_att_0_1,
            'level_label': level_label,
            'contributing_cos': contributing_cos
        })

    valid_po_atts = [p['attainment'] for p in po_results if p['attainment'] is not None]
    overall_po_att = round(sum(valid_po_atts) / len(valid_po_atts), 3) if valid_po_atts else 0.0
    overall_po_0_1 = round(overall_po_att / 3.0, 3) if overall_po_att <= 3.0 else round(overall_po_att, 3)

    return {
        'po_list': po_list,
        'co_list': co_list,
        'po_results': po_results,
        'mapping_averages': mapping_averages,
        'overall_po_attainment': overall_po_att,
        'overall_po_attainment_0_1': overall_po_0_1,
        'overall_po_level': get_attainment_level_label(overall_po_att) if valid_po_atts else "Not Mapped"
    }


def parse_delimited_or_matrix_text(text: str) -> Tuple[List[str], List[List[str]]]:
    """
    Parses CSV, TSV, or tab-pasted text into headers and rows.
    Handles quote escapes and arbitrary whitespace or tabs.
    """
    lines = [line.strip() for line in text.strip().splitlines() if line.strip()]
    if not lines:
        return [], []

    first_line = lines[0]
    if '\t' in first_line:
        delimiter = '\t'
    elif ',' in first_line:
        delimiter = ','
    elif ';' in first_line:
        delimiter = ';'
    else:
        delimiter = None

    import csv
    import io

    if delimiter:
        reader = csv.reader(io.StringIO(text), delimiter=delimiter)
        raw_rows = [row for row in reader if any(cell.strip() for cell in row)]
    else:
        # Whitespace separated
        raw_rows = [[cell.strip() for cell in line.split() if cell.strip()] for line in lines]

    if not raw_rows:
        return [], []

    return raw_rows[0], raw_rows[1:]


def categorize_slow_fast_learners(
    students: List[Dict[str, Any]],
    slow_threshold_pct: float = 50.0,
    fast_threshold_pct: float = 70.0,
    target_assessment: Optional[str] = None,
    assessment_summaries: Optional[List[Dict[str, Any]]] = None,
    threshold_mode: str = 'marks',
    slow_threshold_marks: Optional[float] = None,
    fast_threshold_marks: Optional[float] = None
) -> Dict[str, Any]:
    """
    Categorizes students into Slow Learners and Fast Learners.
    Supports categorization based on raw Marks (default) or Percentage.
    Includes marks_obtained and max_marks for every student record.
    """
    slow_learners = []
    fast_learners = []
    other_learners = []

    is_assessment_specific = bool(target_assessment and str(target_assessment).strip().lower() != 'overall')

    target_max_marks = None
    if is_assessment_specific and assessment_summaries:
        for a in assessment_summaries:
            if str(a.get('name', '')).strip().lower() == str(target_assessment).strip().lower():
                target_max_marks = float(a.get('max_marks', 0.0))
                break

    # Determine default max marks if overall
    if not target_max_marks or target_max_marks <= 0:
        if students:
            first_tot_max = students[0].get('total_max', 0.0)
            if first_tot_max and float(first_tot_max) > 0:
                target_max_marks = float(first_tot_max)
            elif assessment_summaries:
                target_max_marks = float(sum(float(a.get('max_marks', 0.0) or 0.0) for a in assessment_summaries) or 100.0)
            else:
                target_max_marks = 100.0
        elif assessment_summaries:
            target_max_marks = float(sum(float(a.get('max_marks', 0.0) or 0.0) for a in assessment_summaries) or 100.0)
        else:
            target_max_marks = 100.0

    # If threshold_mode was not explicitly 'marks' (i.e. caller passed slow_threshold_pct/fast_threshold_pct without slow_threshold_marks)
    # determine whether to evaluate by marks or percentage
    if slow_threshold_marks is None and fast_threshold_marks is None:
        # Default evaluation: if callers only provided percentage thresholds, mode is percentage
        threshold_mode = 'percentage'
        slow_threshold_marks = round((slow_threshold_pct / 100.0) * target_max_marks, 2)
        fast_threshold_marks = round((fast_threshold_pct / 100.0) * target_max_marks, 2)
    else:
        threshold_mode = 'marks'
        if slow_threshold_marks is None:
            slow_threshold_marks = round((slow_threshold_pct / 100.0) * target_max_marks, 2)
        if fast_threshold_marks is None:
            fast_threshold_marks = round((fast_threshold_pct / 100.0) * target_max_marks, 2)
        # Update percentage representations
        slow_threshold_pct = round((slow_threshold_marks / target_max_marks) * 100.0, 1) if target_max_marks > 0 else 50.0
        fast_threshold_pct = round((fast_threshold_marks / target_max_marks) * 100.0, 1) if target_max_marks > 0 else 70.0

    for s in students:
        roll_no = str(s.get('roll_no', ''))
        name = str(s.get('name', ''))
        marks_dict = s.get('marks', {})

        if is_assessment_specific:
            try:
                score = float(marks_dict.get(target_assessment, 0.0) or 0.0)
            except (ValueError, TypeError):
                score = 0.0
            max_m = target_max_marks if (target_max_marks and target_max_marks > 0) else 100.0
            pct = round((score / max_m) * 100.0, 2) if max_m > 0 else 0.0
            score_disp = f"{score} / {max_m}"
        else:
            pct = float(s.get('percentage', 0.0) or 0.0)
            if 'total_obtained' in s and s.get('total_obtained') is not None:
                try:
                    score = float(s.get('total_obtained', 0.0) or 0.0)
                except (ValueError, TypeError):
                    score = 0.0
            elif marks_dict:
                try:
                    score = float(sum(float(v) for v in marks_dict.values() if v is not None and str(v).strip() != ''))
                except (ValueError, TypeError):
                    score = round((pct / 100.0) * target_max_marks, 2)
            else:
                score = round((pct / 100.0) * target_max_marks, 2)

            try:
                max_m = float(s.get('total_max', 0.0) or target_max_marks)
            except (ValueError, TypeError):
                max_m = target_max_marks
            score_disp = f"{score} / {max_m}"

        passed_cos = s.get('passed_cos', [])
        all_cos = list(s.get('co_percentages', {}).keys())
        deficient_cos = [co for co in all_cos if co not in passed_cos]

        # Formatting score as int if whole number
        marks_obt_disp = int(score) if score == int(score) else round(score, 2)
        max_m_disp = int(max_m) if max_m == int(max_m) else round(max_m, 2)

        record = {
            'roll_no': roll_no,
            'name': name,
            'score_display': score_disp,
            'marks_obtained': marks_obt_disp,
            'max_marks': max_m_disp,
            'percentage': pct,
            'passed_cos': passed_cos,
            'deficient_cos': deficient_cos,
        }

        # Check threshold based on threshold_mode
        if threshold_mode == 'percentage':
            is_fast = (pct >= fast_threshold_pct)
            is_slow = (pct < slow_threshold_pct)
        else:  # 'marks' mode
            is_fast = (score >= fast_threshold_marks)
            is_slow = (score < slow_threshold_marks)

        if is_fast:
            record['category'] = 'Advanced Learner'
            record['action_plan'] = 'Advanced assignments, peer tutoring, research/hackathon projects'
            fast_learners.append(record)
        elif is_slow:
            record['category'] = 'Slow Learner'
            record['action_plan'] = 'Remedial classes, simplified concept notes, practice problem sets'
            slow_learners.append(record)
        else:
            record['category'] = 'Average Learner'
            record['action_plan'] = 'Regular course assignments and periodic review'
            other_learners.append(record)

    def roll_sort_key(item):
        r = str(item.get('roll_no', '')).strip()
        m = re.search(r'\d+', r)
        return (int(m.group()) if m else 999999, r)

    fast_learners.sort(key=roll_sort_key)
    slow_learners.sort(key=roll_sort_key)

    return {
        'target_assessment': target_assessment or 'Overall Evaluation',
        'threshold_mode': threshold_mode,
        'target_max_marks': target_max_marks,
        'slow_threshold_pct': slow_threshold_pct,
        'fast_threshold_pct': fast_threshold_pct,
        'advanced_threshold_pct': fast_threshold_pct,
        'slow_threshold_marks': slow_threshold_marks,
        'fast_threshold_marks': fast_threshold_marks,
        'advanced_threshold_marks': fast_threshold_marks,
        'total_evaluated': len(students),
        'advanced_count': len(fast_learners),
        'advanced_pct': round((len(fast_learners) / len(students) * 100.0) if students else 0.0, 1),
        'fast_count': len(fast_learners),
        'fast_pct': round((len(fast_learners) / len(students) * 100.0) if students else 0.0, 1),
        'slow_count': len(slow_learners),
        'slow_pct': round((len(slow_learners) / len(students) * 100.0) if students else 0.0, 1),
        'other_count': len(other_learners),
        'advanced_learners': fast_learners,
        'fast_learners': fast_learners,
        'slow_learners': slow_learners
    }
