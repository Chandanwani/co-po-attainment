/**
 * Page 2 JavaScript - Direct and Indirect Assessment Attainment
 */

let currentDirectRaw = null;
let currentIndirectRaw = null;
let chartInstances = {};

// Level Badge Helper
function getBadgeHtml(levelStr) {
  if (!levelStr) return '<span class="badge">-</span>';
  let cls = 'badge-level-0';
  if (levelStr.startsWith('Level 3') || levelStr === 'Level 3') {
    cls = 'badge-level-3';
  } else if (levelStr.startsWith('Level 2')) {
    cls = 'badge-level-2';
  } else if (levelStr.startsWith('Level 0') || levelStr.includes('0-1')) {
    cls = 'badge-level-0';
  } else if (levelStr.startsWith('Level 1')) {
    cls = 'badge-level-1';
  }
  return `<span class="badge ${cls}">${levelStr}</span>`;
}

// Tabs switching
function switchDirectTab(mode) {
  document.querySelectorAll('#directFileTab, #directPasteTab').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.closest('.card') === document.querySelector('#directFileTab').closest('.card')) {
      btn.classList.remove('active');
    }
  });
  if (mode === 'file') {
    document.getElementById('directFileTab').classList.add('active');
    event.target.classList.add('active');
  } else {
    document.getElementById('directPasteTab').classList.add('active');
    event.target.classList.add('active');
  }
}

function switchIndirectTab(mode) {
  document.querySelectorAll('#indirectFileTab, #indirectPasteTab').forEach(el => el.classList.remove('active'));
  if (mode === 'file') {
    document.getElementById('indirectFileTab').classList.add('active');
  } else {
    document.getElementById('indirectPasteTab').classList.add('active');
  }
  const btns = event.target.parentElement.querySelectorAll('.tab-btn');
  btns.forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
}

// Weights handler
function handleWeightChange() {
  const dWt = parseFloat(document.getElementById('directWeightInput').value) || 0;
  const iWt = parseFloat(document.getElementById('indirectWeightInput').value) || 0;
  const sum = Math.round((dWt + iWt) * 100) / 100;
  const badge = document.getElementById('weightSumBadge');
  badge.textContent = `Total: ${sum}%`;
  
  if (sum === 100) {
    badge.style.background = '#dcfce7';
    badge.style.color = '#166534';
    // Trigger recompute if data is available
    if (currentDirectRaw) {
      calculateWeightedAttainment();
    }
  } else {
    badge.style.background = '#fee2e2';
    badge.style.color = '#991b1b';
  }
}

// =========================================================================
// DIRECT MARKS LOGIC
// =========================================================================

async function uploadDirectFile() {
  const fileInput = document.getElementById('directFileInput');
  if (!fileInput.files || fileInput.files.length === 0) {
    showDirectError('Please select a file to upload.');
    return;
  }
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  await sendDirectParseRequest(formData);
}

async function uploadDirectPasted() {
  const text = document.getElementById('directPasteInput').value.trim();
  if (!text) {
    showDirectError('Please paste spreadsheet data into the text box.');
    return;
  }
  const formData = new FormData();
  formData.append('pasted_text', text);
  await sendDirectParseRequest(formData);
}


async function sendDirectParseRequest(formData) {
  hideDirectAlerts();
  try {
    const res = await fetch('/api/upload-direct', {
      method: 'POST',
      body: formData
    });
    const result = await res.json();
    if (!result.success) {
      showDirectError(result.message || 'Error parsing direct data.');
      return;
    }
    currentDirectRaw = result;
    renderColumnConfigs(result.column_configs);
    renderDirectTable(result.students, result.column_configs);
    document.getElementById('columnConfigSection').style.display = 'block';
    document.getElementById('directTableSection').style.display = 'block';
    
    // Display guidance and success alert
    showDirectSuccess(`Data parsed successfully: ${result.students.length} students and ${result.column_configs.length} assessment columns loaded in sequence. Please verify/adjust the Maximum Marks and CO mappings above, then click "Validate & Calculate Direct Attainment".`);
    
    // Smooth scroll to column configuration setup so user sees Max Marks
    setTimeout(() => {
      document.getElementById('columnConfigSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  } catch (err) {
    showDirectError('Upload failed: ' + err.message);
  }
}

function showDirectError(msg) {
  const el = document.getElementById('directErrorAlert');
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
  }
}

function showDirectSuccess(msg) {
  const el = document.getElementById('directSuccessAlert');
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
  }
}

function showDirectWarning(msg) {
  const el = document.getElementById('directWarningAlert');
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
  }
}

function hideDirectAlerts() {
  ['directErrorAlert', 'directSuccessAlert', 'directWarningAlert'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = 'none';
      el.textContent = '';
    }
  });
}

function hideDirectError() {
  const el = document.getElementById('directErrorAlert');
  if (el) {
    el.style.display = 'none';
    el.textContent = '';
  }
}

function renderColumnConfigs(configs) {
  const container = document.getElementById('columnConfigGrid');
  container.innerHTML = '';

  configs.forEach((col, idx) => {
    const card = document.createElement('div');
    card.className = `col-config-item ${col.checked ? '' : 'excluded'}`;
    card.id = `colConfigCard_${idx}`;

    const cosStr = Array.isArray(col.mapped_cos) ? col.mapped_cos.join(', ') : col.mapped_cos;

    card.innerHTML = `
      <div class="flex-between">
        <label style="font-weight: 700; font-size: 13.5px; color: var(--primary);">
          <input type="checkbox" id="chkCol_${idx}" ${col.checked ? 'checked' : ''} onchange="toggleColumnCheck(${idx})">
          ${col.name}
        </label>
        <span class="badge" id="statusBadge_${idx}" style="${col.checked ? 'background:#dcfce7;color:#166534;' : 'background:#fee2e2;color:#991b1b;'}">
          ${col.checked ? 'Included' : 'Excluded'}
        </span>
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <label style="font-size: 12px; font-weight: 600;">Max Marks:</label>
        <input type="number" id="maxMarks_${idx}" class="form-control" style="width: 75px; padding: 3px 6px;" value="${col.max_marks}" min="1" step="0.5" oninput="onMaxMarksChange(${idx})" onchange="onMaxMarksChange(${idx})" ${col.checked ? '' : 'disabled'}>
      </div>
      <div id="colHint_${idx}" style="font-size: 11.5px; margin-top: 4px; display: none;"></div>
      <div style="display: flex; gap: 8px; align-items: center; margin-top: 6px;">
        <label style="font-size: 12px; font-weight: 600;">Mapped CO(s):</label>
        <input type="text" id="mappedCOs_${idx}" class="form-control" style="padding: 3px 6px;" value="${cosStr}" placeholder="e.g. CO1, CO2" title="Separate multiple COs with comma" ${col.checked ? '' : 'disabled'}>
      </div>
    `;
    container.appendChild(card);
  });
}

let maxMarksTimer = null;
function onMaxMarksChange(idx) {
  hideDirectError();
  // Clear red highlights from table rows
  document.querySelectorAll('#directMarksTable tr').forEach(tr => {
    tr.style.backgroundColor = '';
  });

  const maxInp = document.getElementById(`maxMarks_${idx}`);
  if (!maxInp || !currentDirectRaw) return;
  const newVal = parseFloat(maxInp.value);
  if (isNaN(newVal) || newVal <= 0) return;

  if (currentDirectRaw.column_configs && currentDirectRaw.column_configs[idx]) {
    currentDirectRaw.column_configs[idx].max_marks = newVal;
  }

  const colName = currentDirectRaw.column_configs[idx].name;
  let maxScored = 0;
  let hasExceeded = false;
  const inputs = document.querySelectorAll(`input[data-col="${colName}"]`);
  inputs.forEach(inp => {
    const v = parseFloat(inp.value);
    if (!isNaN(v)) {
      if (v > maxScored) maxScored = v;
      if (v > newVal + 0.001) {
        hasExceeded = true;
        inp.style.backgroundColor = '#fee2e2';
        inp.style.borderColor = '#ef4444';
      } else {
        inp.style.backgroundColor = '';
        inp.style.borderColor = '';
      }
    }
  });

  const hintEl = document.getElementById(`colHint_${idx}`);
  if (hasExceeded) {
    if (hintEl) {
      hintEl.textContent = `⚠️ Max mark (${newVal}) is less than highest score (${maxScored}).`;
      hintEl.style.color = '#dc2626';
      hintEl.style.display = 'block';
    }
  } else {
    if (hintEl) {
      hintEl.textContent = `✓ Max marks set to ${newVal}`;
      hintEl.style.color = '#16a34a';
      hintEl.style.display = 'block';
      setTimeout(() => { if (hintEl) hintEl.style.display = 'none'; }, 2500);
    }
    // Auto-calculate so errors immediately disappear and results refresh live
    clearTimeout(maxMarksTimer);
    maxMarksTimer = setTimeout(() => {
      calculateDirectAttainment();
    }, 350);
  }
}

function toggleColumnCheck(idx) {
  const chk = document.getElementById(`chkCol_${idx}`);
  const card = document.getElementById(`colConfigCard_${idx}`);
  const badge = document.getElementById(`statusBadge_${idx}`);
  const maxInp = document.getElementById(`maxMarks_${idx}`);
  const coInp = document.getElementById(`mappedCOs_${idx}`);

  if (chk.checked) {
    card.classList.remove('excluded');
    badge.textContent = 'Included';
    badge.style.background = '#dcfce7';
    badge.style.color = '#166534';
    maxInp.disabled = false;
    coInp.disabled = false;
  } else {
    card.classList.add('excluded');
    badge.textContent = 'Excluded';
    badge.style.background = '#fee2e2';
    badge.style.color = '#991b1b';
    maxInp.disabled = true;
    coInp.disabled = true;
  }
}

function renderDirectTable(students, configs) {
  document.getElementById('directStudentCount').textContent = students.length;
  const table = document.getElementById('directMarksTable');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');

  let thHtml = '<tr><th style="width: 50px;">#</th><th style="width: 100px;">Roll No</th><th>Student Name</th>';
  configs.forEach(c => {
    thHtml += `<th>${c.name}</th>`;
  });
  thHtml += '<th style="width: 50px;">Action</th></tr>';
  thead.innerHTML = thHtml;

  tbody.innerHTML = '';
  let hasNegative = false;
  students.forEach((s, rIdx) => {
    const tr = document.createElement('tr');
    tr.id = `directRow_${rIdx}`;
    let trHtml = `
      <td class="text-center bold">${rIdx + 1}</td>
      <td><input type="text" class="cell-input" data-field="roll" value="${s.roll_no || ''}"></td>
      <td><input type="text" class="cell-input" data-field="name" value="${s.name || ''}"></td>
    `;
    configs.forEach(c => {
      const val = s.marks ? (s.marks[c.name] ?? '') : '';
      const numVal = parseFloat(val);
      const isNeg = !isNaN(numVal) && numVal < 0;
      if (isNeg) hasNegative = true;
      const cellStyle = isNeg ? 'style="background-color: #fee2e2; border-color: #ef4444; color: #991b1b; font-weight: 700;" title="Negative mark: please correct or click Auto-Fix"' : '';
      trHtml += `<td><input type="number" step="0.01" class="cell-input" data-col="${c.name}" value="${val}" ${cellStyle} oninput="onCellMarkInput(this)"></td>`;
    });
    trHtml += `<td class="text-center"><button type="button" class="btn btn-outline btn-sm" style="color:#ef4444;padding:2px 6px;" onclick="removeDirectRow(${rIdx})">&times;</button></td>`;
    tr.innerHTML = trHtml;
    tbody.appendChild(tr);
  });

  const btnFixNeg = document.getElementById('btnFixNegative');
  if (btnFixNeg) {
    btnFixNeg.style.display = hasNegative ? 'inline-flex' : 'none';
  }
  if (hasNegative) {
    showDirectWarning('Note: Negative mark(s) detected in the table (highlighted in red). Click "Auto-Fix Negative Marks (→ 0)" or edit cells directly before calculating.');
  }
}

function onCellMarkInput(inp) {
  inp.style.backgroundColor = '';
  inp.style.borderColor = '';
  inp.style.color = '';
  const tr = inp.closest('tr');
  if (tr) tr.style.backgroundColor = '';
  hideDirectError();
}

function fixNegativeMarks() {
  const table = document.getElementById('directMarksTable');
  if (!table) return;
  const inputs = table.querySelectorAll('input[type="number"]');
  let fixedCount = 0;
  inputs.forEach(inp => {
    const val = parseFloat(inp.value);
    if (!isNaN(val) && val < 0) {
      inp.value = 0;
      inp.style.backgroundColor = '#dcfce7';
      inp.style.borderColor = '#16a34a';
      inp.style.color = '#166534';
      inp.title = 'Mark fixed to 0.0 (Absent)';
      setTimeout(() => {
        inp.style.backgroundColor = '';
        inp.style.borderColor = '';
        inp.style.color = '';
      }, 3000);
      fixedCount++;
    }
  });

  const btnFixNeg = document.getElementById('btnFixNegative');
  if (btnFixNeg) btnFixNeg.style.display = 'none';

  if (fixedCount > 0) {
    showDirectSuccess(`Successfully converted ${fixedCount} negative mark(s) to 0.0 (Absent). Click "Validate & Calculate Direct Attainment" to proceed.`);
    hideDirectError();
  }
}

function addDirectRow() {
  if (!currentDirectRaw) return;
  const tbody = document.getElementById('directMarksTable').querySelector('tbody');
  const rIdx = tbody.children.length;
  const tr = document.createElement('tr');
  tr.id = `directRow_${rIdx}`;

  let trHtml = `
    <td class="text-center bold">${rIdx + 1}</td>
    <td><input type="text" class="cell-input" data-field="roll" value="S${rIdx + 1}"></td>
    <td><input type="text" class="cell-input" data-field="name" value="Student ${rIdx + 1}"></td>
  `;
  currentDirectRaw.column_configs.forEach(c => {
    trHtml += `<td><input type="number" step="0.01" class="cell-input" data-col="${c.name}" value="0"></td>`;
  });
  trHtml += `<td class="text-center"><button type="button" class="btn btn-outline btn-sm" style="color:#ef4444;padding:2px 6px;" onclick="removeDirectRow(${rIdx})">&times;</button></td>`;
  tr.innerHTML = trHtml;
  tbody.appendChild(tr);
  document.getElementById('directStudentCount').textContent = tbody.children.length;
}

function removeDirectRow(idx) {
  const row = document.getElementById(`directRow_${idx}`);
  if (row) {
    row.remove();
    document.getElementById('directStudentCount').textContent = document.getElementById('directMarksTable').querySelector('tbody').children.length;
  }
}

function collectDirectDataFromUI() {
  if (!currentDirectRaw) return null;

  // Collect updated column configs
  const updatedConfigs = [];
  currentDirectRaw.column_configs.forEach((c, idx) => {
    const chk = document.getElementById(`chkCol_${idx}`);
    const maxInp = document.getElementById(`maxMarks_${idx}`);
    const coInp = document.getElementById(`mappedCOs_${idx}`);

    updatedConfigs.push({
      name: c.name,
      checked: chk ? chk.checked : true,
      max_marks: maxInp ? parseFloat(maxInp.value) : c.max_marks,
      mapped_cos: coInp ? coInp.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : c.mapped_cos
    });
  });

  // Collect students from table
  const students = [];
  const rows = document.getElementById('directMarksTable').querySelectorAll('tbody tr');
  rows.forEach((tr, rIdx) => {
    const rollInp = tr.querySelector('input[data-field="roll"]');
    const nameInp = tr.querySelector('input[data-field="name"]');
    const marks = {};

    updatedConfigs.forEach(col => {
      const mInp = tr.querySelector(`input[data-col="${col.name}"]`);
      marks[col.name] = mInp ? mInp.value.trim() : '';
    });

    students.push({
      roll_no: rollInp ? rollInp.value.trim() : `S${rIdx + 1}`,
      name: nameInp ? nameInp.value.trim() : `Student ${rIdx + 1}`,
      marks: marks
    });
  });

  return {
    students: students,
    column_configs: updatedConfigs,
    passing_threshold_ratio: parseFloat(document.getElementById('passingThresholdSelect').value) || 0.50
  };
}

async function calculateDirectAttainment() {
  hideDirectError();
  const payload = collectDirectDataFromUI();
  if (!payload) return;

  try {
    const res = await fetch('/api/compute-direct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (!result.success) {
      const errList = result.errors || [result.message || 'Validation error'];
      showDirectError('Direct Assessment Validation Errors:\n• ' + errList.join('\n• '));
      
      // If negative marks mentioned, ensure fix button is visible
      if (errList.some(e => e.toLowerCase().includes('negative'))) {
        const btnFixNeg = document.getElementById('btnFixNegative');
        if (btnFixNeg) btnFixNeg.style.display = 'inline-flex';
      }

      // Highlight the first offending row in the table
      errList.forEach(e => {
        const m = e.match(/Row\s+(\d+)/i);
        if (m) {
          const rowIdx = parseInt(m[1]) - 1;
          const tr = document.getElementById(`directRow_${rowIdx}`);
          if (tr) {
            tr.style.backgroundColor = '#fee2e2';
            setTimeout(() => {
              tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
          }
        }
      });
      return;
    }

    hideDirectAlerts();
    showDirectSuccess('Direct Attainment calculated successfully! See attainment summaries and charts below.');
    renderDirectResults(result.data);
    document.getElementById('directResultsSection').style.display = 'block';
    document.getElementById('btnGoToStep3').style.display = 'inline-flex';

    // If indirect is computed or exists, calculate weighted
    calculateWeightedAttainment();

    // Scroll to results section
    setTimeout(() => {
      document.getElementById('directResultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  } catch (err) {
    showDirectError('Calculation failed: ' + err.message);
  }
}

function renderDirectResults(data) {
  // Reveal top PDF button
  const btnPdfTop = document.getElementById('btnPage2PdfTop');
  if (btnPdfTop) btnPdfTop.style.display = 'inline-flex';

  // Stat cards
  document.getElementById('statDirectAppeared').textContent = data.total_students;
  document.getElementById('statDirectPassed').textContent = data.overall_passed_students;
  document.getElementById('statDirectAvgScore').textContent = `${data.avg_student_pct}%`;
  document.getElementById('statDirectCOCount').textContent = data.all_cos.length;

  // Direct CO Summary Table
  const tbodyCO = document.getElementById('directCOSummaryTable').querySelector('tbody');
  tbodyCO.innerHTML = '';
  data.co_summaries.forEach(c => {
    const intAtt = c.has_internal ? `${c.internal_attainment}` : '<span style="color:#94a3b8;">N/A</span>';
    const eseAtt = c.has_ese ? `${c.ese_attainment}` : '<span style="color:#94a3b8;">N/A</span>';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bold">${c.co}</td>
      <td>${c.mapped_assessments}</td>
      <td class="text-center bold">${c.pass_percentage}%</td>
      <td class="text-center bold" style="color:#b45309; font-size:14px; background:#fffbeb;">${intAtt}</td>
      <td class="text-center bold" style="color:#6d28d9; font-size:14px; background:#f5f3ff;">${eseAtt}</td>
      <td class="text-center bold" style="color:var(--accent); font-size:14px; background:#f0f9ff;">${c.attainment}</td>
      <td class="text-center">${getBadgeHtml(c.level_label)}</td>
    `;
    tbodyCO.appendChild(tr);
  });

  // Assessment Summary Table (Distinguishing Internal CCE/UT vs ESE)
  const tbodyAss = document.getElementById('assessmentSummaryTable').querySelector('tbody');
  tbodyAss.innerHTML = '';
  data.assessment_summaries.forEach(a => {
    const isEse = /(ese|end|sem|external|univ)/i.test(a.name);
    const typeBadge = isEse
      ? '<span class="badge" style="background:#ede9fe; color:#5b21b6; font-size:10.5px; margin-left:6px;">ESE</span>'
      : '<span class="badge" style="background:#fef3c7; color:#92400e; font-size:10.5px; margin-left:6px;">Internal</span>';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bold">${a.name} ${typeBadge}</td>
      <td>${a.mapped_cos}</td>
      <td class="text-center">${a.max_marks}</td>
      <td class="text-center">${a.passing_mark}</td>
      <td class="text-center">${a.appeared}</td>
      <td class="text-center">${a.passed}</td>
      <td class="text-center">${a.failed}</td>
      <td class="text-center bold">${a.pass_pct}%</td>
      <td class="text-center">${a.avg_marks}</td>
      <td class="text-center">${a.min_marks}</td>
      <td class="text-center">${a.max_marks_scored}</td>
    `;
    tbodyAss.appendChild(tr);
  });

  // Student Performance Table (Streamlined)
  const tbodyStd = document.getElementById('studentPerformanceTable').querySelector('tbody');
  tbodyStd.innerHTML = '';
  data.students.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bold">${s.roll_no}</td>
      <td>${s.name}</td>
      <td class="text-center">${s.total_obtained} / ${s.total_max}</td>
      <td class="text-center bold">${s.percentage}%</td>
      <td>${s.passed_cos.join(', ') || '<span style="color:#ef4444;">None</span>'}</td>
      <td class="text-center">${s.passed_all ? '<span class="badge badge-level-3">All Passed</span>' : '<span class="badge badge-level-0">Needs Attention</span>'}</td>
    `;
    tbodyStd.appendChild(tr);
  });

  // Render Charts
  renderDirectCharts(data);
}

function renderDirectCharts(data) {
  // Chart 1: Students Passing Each CO
  const ctxPass = document.getElementById('chartCOPassing');
  if (chartInstances['chartCOPassing']) chartInstances['chartCOPassing'].destroy();
  chartInstances['chartCOPassing'] = new Chart(ctxPass, {
    type: 'bar',
    data: {
      labels: data.co_summaries.map(c => c.co),
      datasets: [{
        label: 'Students Passed (>=50%)',
        data: data.co_summaries.map(c => c.students_passed),
        backgroundColor: '#2563eb',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, max: data.total_students, ticks: { precision: 0 } }
      }
    }
  });

  // Chart 2: Direct CO Attainment
  const ctxAtt = document.getElementById('chartDirectAttainment');
  if (chartInstances['chartDirectAttainment']) chartInstances['chartDirectAttainment'].destroy();
  chartInstances['chartDirectAttainment'] = new Chart(ctxAtt, {
    type: 'bar',
    data: {
      labels: data.co_summaries.map(c => c.co),
      datasets: [{
        label: 'Direct Attainment (0-3 scale)',
        data: data.co_summaries.map(c => c.attainment),
        backgroundColor: '#10b981',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, max: 3.0, ticks: { stepSize: 0.5 } }
      }
    }
  });

  // Chart 3: Student Overall Performance Distribution
  const ctxDist = document.getElementById('chartStudentPerformance');
  if (chartInstances['chartStudentPerformance']) chartInstances['chartStudentPerformance'].destroy();
  const ranges = data.score_ranges;
  chartInstances['chartStudentPerformance'] = new Chart(ctxDist, {
    type: 'bar',
    data: {
      labels: Object.keys(ranges),
      datasets: [{
        label: 'Student Count',
        data: Object.values(ranges),
        backgroundColor: ['#059669', '#2563eb', '#f59e0b', '#f97316', '#ef4444'],
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });

  // Chart 4: Assessment Passing %
  const ctxAss = document.getElementById('chartAssessmentPassRate');
  if (chartInstances['chartAssessmentPassRate']) chartInstances['chartAssessmentPassRate'].destroy();
  chartInstances['chartAssessmentPassRate'] = new Chart(ctxAss, {
    type: 'bar',
    data: {
      labels: data.assessment_summaries.map(a => a.name),
      datasets: [{
        label: 'Pass Percentage (%)',
        data: data.assessment_summaries.map(a => a.pass_pct),
        backgroundColor: '#6366f1',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, max: 100 }
      }
    }
  });
}

// =========================================================================
function getSelectedIndirectMappingTarget() {
  const radios = document.getElementsByName('indirectMappingTarget');
  for (let r of radios) {
    if (r.checked) return r.value;
  }
  return 'CO';
}

function handleIndirectTargetChange() {
  const target = getSelectedIndirectMappingTarget();
  const pasteInp = document.getElementById('indirectPasteInput');
  if (pasteInp) {
    if (target === 'PO') {
      pasteInp.placeholder = "Roll No\tStudent Name\tPO1\tPO2\tPO3\tPO4\n101\tAarav Sharma\t9\t8\t8\t9";
    } else {
      pasteInp.placeholder = "Roll No\tStudent Name\tCO1\tCO2\tCO3\tCO4\n101\tAarav Sharma\t9\t8\t8\t9";
    }
  }
  const fileInp = document.getElementById('indirectFileInput');
  if (fileInp && fileInp.files && fileInp.files.length > 0) {
    uploadIndirectFile();
  }
}

async function uploadIndirectFile() {
  const fileInput = document.getElementById('indirectFileInput');
  if (!fileInput.files || fileInput.files.length === 0) {
    showIndirectError('Please select an indirect file to upload.');
    return;
  }
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('mapping_target', getSelectedIndirectMappingTarget());
  await sendIndirectParseRequest(formData);
}

async function uploadIndirectPasted() {
  const text = document.getElementById('indirectPasteInput').value.trim();
  if (!text) {
    showIndirectError('Please paste survey rating data.');
    return;
  }
  const formData = new FormData();
  formData.append('pasted_text', text);
  formData.append('mapping_target', getSelectedIndirectMappingTarget());
  await sendIndirectParseRequest(formData);
}


async function sendIndirectParseRequest(formData) {
  hideIndirectError();
  try {
    const res = await fetch('/api/upload-indirect', {
      method: 'POST',
      body: formData
    });
    const result = await res.json();
    if (!result.success) {
      showIndirectError(result.message || 'Error parsing indirect data.');
      return;
    }
    currentIndirectRaw = result;
    renderDetectedCOs(result.detected_cos);
    renderIndirectTable(result.ratings_data, result.detected_cos);
    document.getElementById('indirectConfigSection').style.display = 'block';

    // Calculate indirect attainment immediately
    await calculateIndirectAttainment();
  } catch (err) {
    showIndirectError('Indirect upload failed: ' + err.message);
  }
}

function showIndirectError(msg) {
  const el = document.getElementById('indirectErrorAlert');
  el.textContent = msg;
  el.style.display = 'block';
}

function hideIndirectError() {
  const el = document.getElementById('indirectErrorAlert');
  el.style.display = 'none';
  el.textContent = '';
}

function renderDetectedCOs(cos) {
  const container = document.getElementById('detectedCOsList');
  container.innerHTML = '';
  cos.forEach(co => {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.style.background = '#e0f2fe';
    badge.style.color = '#0369a1';
    badge.textContent = co;
    container.appendChild(badge);
  });
}

function renderIndirectTable(ratings, cos) {
  const table = document.getElementById('indirectRatingsTable');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');

  let thHtml = '<tr><th style="width: 50px;">#</th>';
  cos.forEach(co => {
    thHtml += `<th>${co}</th>`;
  });
  thHtml += '</tr>';
  thead.innerHTML = thHtml;

  tbody.innerHTML = '';
  ratings.forEach((row, rIdx) => {
    const tr = document.createElement('tr');
    let trHtml = `<td class="text-center bold">${rIdx + 1}</td>`;
    cos.forEach(co => {
      const val = row[co] ?? '';
      trHtml += `<td><input type="number" step="0.5" class="cell-input" data-co="${co}" value="${val}"></td>`;
    });
    tr.innerHTML = trHtml;
    tbody.appendChild(tr);
  });
}

function collectIndirectDataFromUI() {
  if (!currentIndirectRaw) return null;
  const cos = currentIndirectRaw.detected_cos;
  const rows = document.getElementById('indirectRatingsTable').querySelectorAll('tbody tr');
  const ratings = [];

  rows.forEach(tr => {
    const rowObj = {};
    cos.forEach(co => {
      const inp = tr.querySelector(`input[data-co="${co}"]`);
      rowObj[co] = inp ? inp.value.trim() : '';
    });
    ratings.push(rowObj);
  });

  return {
    ratings_data: ratings,
    max_rating: parseFloat(document.getElementById('indirectMaxRatingInput').value) || 10.0,
    co_columns_override: cos,
    mapping_target: getSelectedIndirectMappingTarget()
  };
}

async function calculateIndirectAttainment() {
  hideIndirectError();
  const payload = collectIndirectDataFromUI();
  if (!payload) return;

  try {
    const res = await fetch('/api/compute-indirect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (!result.success) {
      const errList = result.errors || [result.message || 'Validation error'];
      showIndirectError('Indirect Survey Validation Errors:\n• ' + errList.join('\n• '));
      return;
    }

    renderIndirectResults(result.data);
    document.getElementById('indirectResultsSection').style.display = 'block';

    // Calculate weighted attainment
    calculateWeightedAttainment();
  } catch (err) {
    showIndirectError('Indirect calculation failed: ' + err.message);
  }
}

function renderIndirectResults(data) {
  const tbody = document.getElementById('indirectCOSummaryTable').querySelector('tbody');
  tbody.innerHTML = '';

  data.co_summaries.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bold">${c.co}</td>
      <td class="text-center">${c.response_count}</td>
      <td class="text-center">${c.max_rating}</td>
      <td class="text-center bold">${c.average_rating}</td>
      <td class="text-center bold">${c.rating_percentage}%</td>
      <td class="text-center bold" style="color:var(--accent); font-size:14px;">${c.attainment}</td>
      <td class="text-center">${getBadgeHtml(c.level_label)}</td>
    `;
    tbody.appendChild(tr);
  });

  // Render Charts
  const ctxPct = document.getElementById('chartIndirectRatingPct');
  if (chartInstances['chartIndirectRatingPct']) chartInstances['chartIndirectRatingPct'].destroy();
  chartInstances['chartIndirectRatingPct'] = new Chart(ctxPct, {
    type: 'bar',
    data: {
      labels: data.co_summaries.map(c => c.co),
      datasets: [{
        label: 'Rating Percentage (%)',
        data: data.co_summaries.map(c => c.rating_percentage),
        backgroundColor: '#8b5cf6',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, max: 100 } }
    }
  });

  const ctxAtt = document.getElementById('chartIndirectAttainment');
  if (chartInstances['chartIndirectAttainment']) chartInstances['chartIndirectAttainment'].destroy();
  chartInstances['chartIndirectAttainment'] = new Chart(ctxAtt, {
    type: 'bar',
    data: {
      labels: data.co_summaries.map(c => c.co),
      datasets: [{
        label: 'Indirect Attainment (0-3)',
        data: data.co_summaries.map(c => c.attainment),
        backgroundColor: '#06b6d4',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, max: 3.0, ticks: { stepSize: 0.5 } } }
    }
  });
}

// =========================================================================
// WEIGHTED COMBINED ATTAINMENT LOGIC
// =========================================================================

async function calculateWeightedAttainment() {
  const dWt = parseFloat(document.getElementById('directWeightInput').value) || 80;
  const iWt = parseFloat(document.getElementById('indirectWeightInput').value) || 20;

  try {
    const res = await fetch('/api/compute-weighted', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direct_weight: dWt, indirect_weight: iWt })
    });
    const result = await res.json();
    if (!result.success) return;

    renderWeightedResults(result.data);
    document.getElementById('weightedSection').style.display = 'block';
  } catch (err) {
    console.error('Weighted calculation error:', err);
  }
}

function renderWeightedResults(data) {
  const tbody = document.getElementById('weightedCOTable').querySelector('tbody');
  tbody.innerHTML = '';

  document.getElementById('overallCombinedBadge').textContent =
    `Overall CO Attainment: ${data.overall_attainment} / 3.00 (${data.overall_level_label})`;

  data.combined_results.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bold">${c.co}</td>
      <td class="text-center">${c.direct_pct}%</td>
      <td class="text-center bold">${c.direct_contribution}%</td>
      <td class="text-center">${c.direct_attainment}</td>
      <td class="text-center">${c.indirect_pct}%</td>
      <td class="text-center bold">${c.indirect_contribution}%</td>
      <td class="text-center">${c.indirect_attainment}</td>
      <td class="text-center bold">${c.combined_pct}%</td>
      <td class="text-center bold" style="color:var(--accent); font-size:14px;">${c.combined_attainment}</td>
      <td class="text-center">${getBadgeHtml(c.level_label)}</td>
    `;
    tbody.appendChild(tr);
  });

  // Combined Attainment Comparison Chart
  const ctx = document.getElementById('chartCombinedAttainment');
  if (chartInstances['chartCombinedAttainment']) chartInstances['chartCombinedAttainment'].destroy();
  chartInstances['chartCombinedAttainment'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.combined_results.map(c => c.co),
      datasets: [
        {
          label: `Direct Attainment (${data.direct_weight}%)`,
          data: data.combined_results.map(c => c.direct_attainment),
          backgroundColor: '#3b82f6',
          borderRadius: 4
        },
        {
          label: `Indirect Attainment (${data.indirect_weight}%)`,
          data: data.combined_results.map(c => c.indirect_attainment),
          backgroundColor: '#10b981',
          borderRadius: 4
        },
        {
          label: 'Combined Weighted Attainment',
          data: data.combined_results.map(c => c.combined_attainment),
          backgroundColor: '#1e293b',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, max: 3.0, ticks: { stepSize: 0.5 } }
      }
    }
  });
}

// =========================================================================
// PAGE 2 ASSESSMENT PDF MODAL & DOWNLOAD
// =========================================================================

function openPage2PdfModal() {
  const modal = document.getElementById('page2PdfModal');
  if (modal) modal.style.display = 'flex';
}

function closePage2PdfModal() {
  const modal = document.getElementById('page2PdfModal');
  if (modal) modal.style.display = 'none';
}

function proceedPage2PdfDownload() {
  const opts = document.getElementsByName('page2PdfChartOption');
  let charts = '1';
  for (let r of opts) {
    if (r.checked) {
      charts = r.value;
      break;
    }
  }
  closePage2PdfModal();
  window.location.href = `/download/assessment-pdf?charts=${charts}`;
}

// Auto-restore previous calculations when navigating back to Page 2
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/get-full-state');
    const state = await res.json();
    if (state.direct && state.direct.co_summaries && state.direct.co_summaries.length > 0) {
      renderDirectResults(state.direct);
      document.getElementById('directResultsSection').style.display = 'block';
      document.getElementById('btnGoToStep3').style.display = 'inline-flex';
      const btnPdf = document.getElementById('btnPage2PdfTop');
      if (btnPdf) btnPdf.style.display = 'inline-flex';
    }
    if (state.indirect && state.indirect.co_summaries && state.indirect.co_summaries.length > 0) {
      renderIndirectResults(state.indirect);
      document.getElementById('indirectResultsSection').style.display = 'block';
    }
    if (state.weighted && state.weighted.combined_results && state.weighted.combined_results.length > 0) {
      renderWeightedResults(state.weighted);
      document.getElementById('weightedSection').style.display = 'block';
    }
  } catch (err) {
    console.warn('Could not restore saved assessment state:', err);
  }
});
