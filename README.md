# Outcome-Based Education (OBE) CO-PO Attainment Website

A simple, secure, full-featured web application for calculating Course Outcome (CO) and Program Outcome (PO / PSO) attainment in compliance with GAPC 4.0 and NBA accreditation guidelines.

Built using **HTML, CSS, JavaScript, and Python Flask**.

---

## Key Features & Page Workflow

### 1. Page 1: Teacher & Course Information (`/` or `/teacher`)
- **No Navigation Bar** (clean, distraction-free first step).
- Fields: Faculty Name, Subject Name & Code, Class, Division, Semester, and Academic Year.
- Strict validation requiring Faculty Name and Subject before proceeding.

### 2. Page 2: Direct & Indirect Assessment Data (`/assessment`)
- **Direct Marks Evaluation**:
  - Supports **CSV, TSV, Pasted spreadsheet rows, and XLSX** files.
  - Automatically supports both **Wide format** (exams across columns) and **Long format** (pivots student/exam rows).
  - Large **in-browser editable table** allowing modifications or manual additions of students and marks.
  - Assessment column configuration with **Include/Exclude checkboxes**, **Maximum Marks**, and **Mapped COs** (supports multi-CO mapping, e.g., `CO1, CO2`).
  - **Exclusion Rule**: Unchecked columns are completely excluded from all calculations, graphs, summaries, and downloads.
  - **Marks Validation**:
    $$0 \le \text{Obtained Marks} \le \text{Maximum Marks}$$
    Rejects negative marks, marks exceeding maximum marks, blanks, non-numeric values, or invalid max marks with clear error messages displaying the row and assessment name.
  - **Continuous GAPC Attainment Formula**:
    - Below 60%: $\text{Attainment} = \frac{\text{Percentage}}{60}$
    - 60% to below 70%: $\text{Attainment} = 1 + \frac{\text{Percentage} - 60}{10}$
    - 70% to below 80%: $\text{Attainment} = 2 + \frac{\text{Percentage} - 70}{10}$
    - 80% or above: $\text{Attainment} = 3.0$
- **Indirect Assessment (Course Exit Feedback)**:
  - Supports CSV, TSV, Pasted, and XLSX survey ratings.
  - Automatically detects CO columns (`CO1`, `CO2`, `CO3`...) and ignores non-CO columns (`Roll No`, `Student Name`, `Comments`, etc.).
  - Configurable rating scale (e.g. 10-point or 5-point).
  - Calculates average rating, rating percentage, and indirect attainment.
- **Configurable Weightage**:
  - Default: **80% Direct / 20% Indirect**.
  - Interactive inputs requiring total weight to equal exactly 100%.
  - Combined calculations:
    $$\text{Weighted Direct} = \text{Direct \%} \times \frac{\text{Direct Weight}}{100}$$
    $$\text{Weighted Indirect} = \text{Indirect \%} \times \frac{\text{Indirect Weight}}{100}$$
    $$\text{Combined \%} = \text{Weighted Direct} + \text{Weighted Indirect}$$
    $$\text{Combined Attainment} = \frac{\text{Combined \%}}{100} \times 3$$
- **Live Interactive Charts (Chart.js)**:
  - Students passing each CO
  - Direct CO attainment levels
  - Overall student score distribution
  - Assessment passing rates
  - Indirect rating percentages and attainment
  - Direct vs. Indirect vs. Combined comparison bar charts

### 3. Page 3: CO-PO Correlation Mapping (`/copo`)
- Upload CO-PO / CO-PSO mapping matrices via file or pasted text.
- Supports both **named tables** and **headerless numeric matrices** (automatically assigns `CO1..COn` and `PO1..POn`).
- Large editable mapping table with dynamic "+ Add PO / PSO Column" and "+ Add CO Row" buttons.
- Calculates PO Attainment:
  $$\text{PO Attainment}_j = \frac{\sum_i (\text{Mapping Level}_{ij} \times \text{Combined CO Attainment}_i)}{\sum_i \text{Mapping Level}_{ij}}$$
- Visualized with both Bar Charts and Radar / Spider Profile Charts.

### 4. Page 4: Final Comprehensive Report & Multi-Format Downloads (`/report`)
- Executive accreditation report displaying:
  - Teacher and course details
  - Overall weighted attainment and OBE level
  - Direct, indirect, and combined CO tables & comparison charts
  - Program Outcome (PO & PSO) attainment tables and radar charts
  - Assessment passing summaries (Test, CCE, Insem, Prelim, ESE)
  - Student performance table with individual passed CO lists
- **Downloads**:
  1. **Complete Multi-Sheet Excel Report (`.xlsx`)**: Built using `openpyxl` with 9 styled worksheets preserving original table structures, normalized marks, student attainment, passing COs, and chart data.
  2. **Accreditation Word Document (`.docx`)**: Generated using `python-docx` with styled tables and OBE headings.
  3. **Direct Assessment Report (`.xlsx`)**
  4. **Indirect Survey Report (`.xlsx`)**
  5. **CO-PO Correlation Report (`.xlsx`)**
  6. **Print / Save to PDF** option.

---

## How to Run

1. Open PowerShell or Command Prompt in `co_po_attainment`:
   ```bash
   cd co_po_attainment
   python app.py
   ```
   Or double click `start-app.bat`.

2. Open your web browser to:
   ```
   http://127.0.0.1:5000
   ```

---

## Running the Application

Simply run:
```bash
python app.py
```
Or double-click [`start-app.bat`](file:///c:/Users/chand/OneDrive/Desktop/project/co_po_attainment/start-app.bat). Then open your browser at:
```
http://127.0.0.1:5000
```

---

## Running the Automated Test Suite

Run the automated tests anytime:
```bash
python test_app.py
python test_e2e.py
```
