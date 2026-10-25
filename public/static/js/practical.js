/**
 * Practical / Laboratory Assessment JavaScript - Page 2 Practical
 * Dedicated script for laboratory courses, scratch experiment builder, and multi-experiment CO mapping.
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

// Tab Switching
function switchDirectTab(mode) {
  document.querySelectorAll('#directFileTab, #directPasteTab, #directScratchTab').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.closest('.card') === document.querySelector('#directFileTab').closest('.card')) {
      btn.classList.remove('active');
    }
  });
  if (mode === 'file') {
    document.getElementById('directFileTab').classList.add('active');
    if (event && event.target) event.target.classList.add('active');
  } else if (mode === 'paste') {
    document.getElementById('directPasteTab').classList.add('active');
    if (event && event.target) event.target.classList.add('active');
  } else if (mode === 'scratch') {
    document.getElementById('directScratchTab').classList.add('active');
    if (event && event.target) event.target.classList.add('active');
  }
}

function switchIndirectTab(mode) {
  document.querySelectorAll('#indirectFileTab, #indirectPasteTab, #indirectManualTab').forEach(el => el.classList.remove('active'));
  if (mode === 'file') {
    document.getElementById('indirectFileTab')?.classList.add('active');
  } else if (mode === 'paste') {
    document.getElementById('indirectPasteTab')?.classList.add('active');
  } else if (mode === 'manual') {
    document.getElementById('indirectManualTab')?.classList.add('active');
  }
  const indirectCard = document.getElementById('indirectFileTab')?.closest('.card');
  if (indirectCard && window.event && window.event.target && window.event.target.classList.contains('tab-btn')) {
    const btns = indirectCard.querySelectorAll('.tabs .tab-btn');
    btns.forEach(b => b.classList.remove('active'));
    window.event.target.classList.add('active');
  }
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
    if (currentDirectRaw) {
      calculateWeightedAttainment();
    }
  } else {
    badge.style.background = '#fee2e2';
    badge.style.color = '#991b1b';
  }
}

// =========================================================================
// DIRECT LAB MARKS UPLOAD & PARSING
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
    
    showDirectSuccess(`Data parsed successfully: ${result.students.length} students and ${result.column_configs.length} assessment columns loaded. Verify Max Marks & CO mappings below, then click "Validate & Calculate Direct Attainment".`);
    setTimeout(() => {
      document.getElementById('columnConfigSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  } catch (err) {
    showDirectError('Upload failed: ' + err.message);
  }
}

// =========================================================================
// SCRATCH LAB SHEET BUILDER (NO FILE REQUIRED)
// =========================================================================

// =========================================================================
// SCRATCH LAB SHEET BUILDER (NO FILE REQUIRED)
// =========================================================================

function renderScratchExpCOList() {
  const container = document.getElementById('scratchExpCOGrid');
  if (!container) return;
  const countInp = document.getElementById('scratchExpCount');
  const countVal = countInp ? countInp.value.trim() : '';
  const count = parseInt(countVal);

  if (!countVal || isNaN(count) || count <= 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 14px; text-align: center; color: #64748b; font-size: 13px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px;">
        👉 <strong>Enter the number of experiments</strong> above (e.g. 8, 10, 12) to open editable CO boxes for each experiment.
      </div>
    `;
    return;
  }

  const currentSelections = {};
  for (let i = 1; i <= 50; i++) {
    const el = document.getElementById(`scratchExpCO_${i}`);
    if (el) currentSelections[i] = el.value.trim();
  }

  container.innerHTML = '';
  for (let i = 1; i <= count; i++) {
    const chip = document.createElement('div');
    chip.style.cssText = 'background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 12.5px; display: flex; align-items: center; justify-content: space-between; gap: 6px;';
    
    // Default suggestion for user convenience (e.g. 2 per CO)
    const defaultCO = `CO${Math.min(6, Math.floor((i - 1) / 2) + 1)}`;
    const selVal = currentSelections[i] || defaultCO;

    chip.innerHTML = `
      <strong style="color: #1e3a8a; white-space: nowrap;">Exp ${i}:</strong>
      <div style="display: flex; align-items: center; gap: 4px;">
        <span style="font-size: 11px; font-weight: 700; color: #64748b;">CO:</span>
        <input type="text" id="scratchExpCO_${i}" class="form-control" style="width: 80px; height: 28px; padding: 2px 6px; font-size: 12px; font-weight: 700; color: #1e40af; text-align: center; border: 1.5px solid #93c5fd; background: #eff6ff; border-radius: 4px;" value="${selVal}" placeholder="e.g. CO1" title="Type mapped CO directly (e.g. CO1, CO2, etc.)">
      </div>
    `;
    container.appendChild(chip);
  }
}

function buildPracticalSheetFromScratch() {
  hideDirectAlerts();

  const expCountInp = document.getElementById('scratchExpCount');
  const expCountVal = expCountInp ? expCountInp.value.trim() : '';
  const expCount = parseInt(expCountVal);

  if (!expCountVal || isNaN(expCount) || expCount <= 0) {
    showDirectError('Please specify the Number of Experiments first (e.g. 8, 10, 12).');
    if (expCountInp) expCountInp.focus();
    return;
  }

  const expMax = parseFloat(document.getElementById('scratchExpMaxMarks').value) || 25;

  // 1. Build Column Configs reading the user's entered CO for each experiment
  const configs = [];
  for (let i = 1; i <= expCount; i++) {
    const selEl = document.getElementById(`scratchExpCO_${i}`);
    const selVal = selEl && selEl.value.trim() ? selEl.value.trim() : `CO${Math.min(6, Math.floor((i - 1) / 2) + 1)}`;
    const mappedCOs = selVal.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

    configs.push({
      name: `Exp ${i}`,
      max_marks: expMax,
      mapped_cos: mappedCOs.length > 0 ? mappedCOs : ['CO1'],
      checked: true
    });
  }

  // Include PR/OR Exam Column if checked
  const incPROR = document.getElementById('scratchIncludePROR') && document.getElementById('scratchIncludePROR').checked;
  if (incPROR) {
    const prorMax = parseFloat(document.getElementById('scratchPRORMax').value) || 25;
    configs.push({
      name: 'PR/OR Exam',
      max_marks: prorMax,
      mapped_cos: ['CO1', 'CO2', 'CO3', 'CO4', 'CO5'],
      checked: true
    });
  }

  // 2. Parse / Generate Student Rows (User-added Roll Numbers & Names)
  const pastedStudentsText = document.getElementById('scratchStudentsInput') ? document.getElementById('scratchStudentsInput').value.trim() : '';
  const students = [];

  if (pastedStudentsText) {
    const lines = pastedStudentsText.split('\n').map(l => l.trim()).filter(Boolean);
    lines.forEach((line, idx) => {
      const parts = line.split(/\t|,|  +/).map(p => p.trim()).filter(Boolean);
      let roll = '';
      let name = '';
      if (parts.length >= 2) {
        roll = parts[0];
        name = parts.slice(1).join(' ');
      } else if (parts.length === 1) {
        roll = parts[0];
        name = '';
      }

      const marks = {};
      configs.forEach(c => { marks[c.name] = ''; });

      students.push({
        roll_no: roll,
        name: name,
        marks: marks
      });
    });
  } else {
    // Blank student rows without predefined roll numbers - user types them directly in table
    const studentCount = parseInt(document.getElementById('scratchStudentCount').value) || 15;
    for (let s = 0; s < studentCount; s++) {
      const marks = {};
      configs.forEach(c => { marks[c.name] = ''; });

      students.push({
        roll_no: '',
        name: '',
        marks: marks
      });
    }
  }

  currentDirectRaw = {
    success: true,
    students: students,
    column_configs: configs
  };

  renderColumnConfigs(configs);
  renderDirectTable(students, configs);
  document.getElementById('columnConfigSection').style.display = 'block';
  document.getElementById('directTableSection').style.display = 'block';

  showDirectSuccess(`✓ Blank practical sheet initialized with ${students.length} students and ${configs.length} experiment columns. You can enter roll numbers, names, and marks directly in the table, then click "Validate & Calculate Direct Attainment".`);
  setTimeout(() => {
    document.getElementById('directTableSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

// =========================================================================
// COLUMN CONFIGURATION & TABLE RENDERING
// =========================================================================

function onMappedCOSelectChange(idx) {
  // Deprecated: user types and edits mapped COs directly in open input box
}

function renderColumnConfigs(configs) {
  const container = document.getElementById('columnConfigGrid');
  container.innerHTML = '';

  configs.forEach((col, idx) => {
    const card = document.createElement('div');
    card.className = `col-config-item ${col.checked ? '' : 'excluded'}`;
    card.id = `colConfigCard_${idx}`;

    const cosStr = Array.isArray(col.mapped_cos) ? col.mapped_cos.join(', ') : (col.mapped_cos || 'CO1');

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
      <div style="display: flex; gap: 8px; align-items: center; margin-top: 4px;">
        <label style="font-size: 12px; font-weight: 600;">Max Marks:</label>
        <input type="number" id="maxMarks_${idx}" class="form-control" style="width: 75px; padding: 3px 6px;" value="${col.max_marks}" min="1" step="0.5" oninput="onMaxMarksChange(${idx})" onchange="onMaxMarksChange(${idx})" ${col.checked ? '' : 'disabled'}>
      </div>
      <div id="colHint_${idx}" style="font-size: 11.5px; margin-top: 4px; display: none;"></div>
      <div style="display: flex; gap: 8px; align-items: center; margin-top: 6px; flex-wrap: wrap;">
        <label style="font-size: 12px; font-weight: 700; color: #1e3a8a;">Mapped CO:</label>
        <input type="text" id="mappedCOs_${idx}" class="form-control" style="padding: 3px 8px; font-size: 12.5px; width: 140px; height: 30px; font-weight: 700; color: #1e40af; border: 1.5px solid #93c5fd; background: #eff6ff; border-radius: 4px;" value="${cosStr}" placeholder="e.g. CO1, CO2" title="Type mapped Course Outcome(s) directly" oninput="onCustomCOInput(${idx})" onchange="onCustomCOInput(${idx})" ${col.checked ? '' : 'disabled'}>
      </div>
    `;
    container.appendChild(card);
  });
}

function onCustomCOInput(idx) {
  const inp = document.getElementById(`mappedCOs_${idx}`);
  if (!inp || !currentDirectRaw || !currentDirectRaw.column_configs || !currentDirectRaw.column_configs[idx]) return;
  const val = inp.value.trim();
  currentDirectRaw.column_configs[idx].mapped_cos = val.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
}

function applyBatchExpMaxMarks() {
  const batchInp = document.getElementById('batchExpMaxInput');
  if (!batchInp) return;
  const val = parseFloat(batchInp.value);
  if (isNaN(val) || val <= 0) {
    alert('Please enter a valid positive number for Experiment Max Marks.');
    return;
  }
  if (!currentDirectRaw || !currentDirectRaw.column_configs) return;
  
  let appliedCount = 0;
  currentDirectRaw.column_configs.forEach((col, idx) => {
    if (/exp|prac|lab/i.test(col.name)) {
      col.max_marks = val;
      const inp = document.getElementById(`maxMarks_${idx}`);
      if (inp) {
        inp.value = val;
        onMaxMarksChange(idx);
      }
      appliedCount++;
    }
  });

  if (appliedCount > 0) {
    showDirectSuccess(`Updated max marks to ${val} for ${appliedCount} experiment column(s).`);
    setTimeout(() => { hideDirectAlerts(); }, 3000);
  } else {
    showDirectWarning('No experiment column found in current columns.');
  }
}

let maxMarksTimer = null;
function onMaxMarksChange(idx) {
  hideDirectError();
  document.querySelectorAll('#directMarksTable tr').forEach(tr => { tr.style.backgroundColor = ''; });

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
  }
}

function toggleColumnCheck(idx) {
  const chk = document.getElementById(`chkCol_${idx}`);
  const card = document.getElementById(`colConfigCard_${idx}`);
  const badge = document.getElementById(`statusBadge_${idx}`);
  const maxInp = document.getElementById(`maxMarks_${idx}`);
  const coInp = document.getElementById(`mappedCOs_${idx}`);

  const isChecked = chk ? chk.checked : true;

  if (currentDirectRaw && currentDirectRaw.column_configs && currentDirectRaw.column_configs[idx]) {
    currentDirectRaw.column_configs[idx].checked = isChecked;
  }

  if (isChecked) {
    card.classList.remove('excluded');
    badge.textContent = 'Included';
    badge.style.background = '#dcfce7';
    badge.style.color = '#166534';
    if (maxInp) maxInp.disabled = false;
    if (coInp) coInp.disabled = false;
  } else {
    card.classList.add('excluded');
    badge.textContent = 'Excluded';
    badge.style.background = '#fee2e2';
    badge.style.color = '#991b1b';
    if (maxInp) maxInp.disabled = true;
    if (coInp) coInp.disabled = true;
  }

  // Instantly hide or show column in the marks table
  const th = document.getElementById(`thCol_${idx}`);
  if (th) th.style.display = isChecked ? '' : 'none';

  const cells = document.querySelectorAll(`.cell-col-${idx}`);
  cells.forEach(td => {
    td.style.display = isChecked ? '' : 'none';
  });
}

function renderDirectTable(students, configs) {
  document.getElementById('directStudentCount').textContent = students.length;
  const table = document.getElementById('directMarksTable');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');

  let thHtml = '<tr><th style="width: 50px;">#</th><th style="width: 110px;">Roll No</th><th>Student Name</th>';
  configs.forEach((c, idx) => {
    const isVisible = (c.checked !== false);
    thHtml += `<th id="thCol_${idx}" style="${isVisible ? '' : 'display: none;'}">${c.name}</th>`;
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
      <td><input type="text" class="cell-input" data-field="roll" value="${s.roll_no || ''}" placeholder="Roll No"></td>
      <td><input type="text" class="cell-input" data-field="name" value="${s.name || ''}" placeholder="Student Name"></td>
    `;
    configs.forEach((c, idx) => {
      const isVisible = (c.checked !== false);
      const val = s.marks ? (s.marks[c.name] ?? '') : '';
      const numVal = parseFloat(val);
      const isNeg = !isNaN(numVal) && numVal < 0;
      if (isNeg) hasNegative = true;
      const cellStyle = isNeg ? 'style="background-color: #fee2e2; border-color: #ef4444; color: #991b1b; font-weight: 700;" title="Negative mark"' : '';
      trHtml += `<td class="cell-col-${idx}" style="${isVisible ? '' : 'display: none;'}"><input type="number" step="0.01" class="cell-input" data-col="${c.name}" value="${val}" ${cellStyle} oninput="onCellMarkInput(this)"></td>`;
    });
    trHtml += `<td class="text-center"><button type="button" class="btn btn-outline btn-sm" style="color:#ef4444;padding:2px 6px;" onclick="removeDirectRow(${rIdx})" title="Delete student">&times;</button></td>`;
    tr.innerHTML = trHtml;
    tbody.appendChild(tr);
  });

  const btnFixNeg = document.getElementById('btnFixNegative');
  if (btnFixNeg) {
    btnFixNeg.style.display = hasNegative ? 'inline-flex' : 'none';
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
    showDirectSuccess(`Successfully converted ${fixedCount} negative mark(s) to 0.0 (Absent).`);
    hideDirectError();
  }
}

function addDirectRow() {
  const tbody = document.getElementById('directMarksTable').querySelector('tbody');
  const rIdx = tbody.children.length;
  const tr = document.createElement('tr');
  tr.id = `directRow_${rIdx}`;

  let configs = [];
  if (currentDirectRaw && currentDirectRaw.column_configs) {
    configs = currentDirectRaw.column_configs;
  }

  let trHtml = `
    <td class="text-center bold">${rIdx + 1}</td>
    <td><input type="text" class="cell-input" data-field="roll" value="${101 + rIdx}" placeholder="Roll No"></td>
    <td><input type="text" class="cell-input" data-field="name" value="" placeholder="Student Name"></td>
  `;
  configs.forEach((c, idx) => {
    const isVisible = (c.checked !== false);
    trHtml += `<td class="cell-col-${idx}" style="${isVisible ? '' : 'display: none;'}"><input type="number" step="0.01" class="cell-input" data-col="${c.name}" value="" placeholder="Mark"></td>`;
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

// =========================================================================
// CUSTOM EXPERIMENT / COLUMN MANAGEMENT
// =========================================================================

function openAddColumnModal() {
  const modal = document.getElementById('addColumnModal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function closeAddColumnModal() {
  const modal = document.getElementById('addColumnModal');
  if (modal) modal.style.display = 'none';
}

function confirmAddNewColumn() {
  const nameInp = document.getElementById('newColNameInput');
  const maxInp = document.getElementById('newColMaxMarksInput');
  const cosInp = document.getElementById('newColMappedCOsInput');

  const colName = nameInp ? nameInp.value.trim() : '';
  const maxMarks = maxInp ? parseFloat(maxInp.value) : 25;
  const mappedCos = cosInp ? cosInp.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : ['CO1'];

  if (!colName) {
    alert('Please enter a column / experiment name.');
    return;
  }
  if (isNaN(maxMarks) || maxMarks <= 0) {
    alert('Please enter a valid positive maximum marks value.');
    return;
  }
  if (mappedCos.length === 0) {
    alert('Please specify at least one mapped Course Outcome (e.g. CO1).');
    return;
  }

  const currentData = collectDirectDataFromUI();
  let students = [];
  let configs = [];

  if (currentData && currentData.students && currentData.students.length > 0) {
    students = currentData.students;
    configs = currentData.column_configs;
  } else if (currentDirectRaw && currentDirectRaw.students) {
    students = currentDirectRaw.students;
    configs = currentDirectRaw.column_configs || [];
  } else {
    alert('Please initialize student rows or upload data first.');
    return;
  }

  if (configs.some(c => c.name.toLowerCase() === colName.toLowerCase())) {
    alert(`A column named "${colName}" already exists. Please choose a unique name.`);
    return;
  }

  configs.push({
    name: colName,
    max_marks: maxMarks,
    mapped_cos: mappedCos,
    checked: true
  });

  students.forEach(s => {
    if (!s.marks) s.marks = {};
    s.marks[colName] = '';
  });

  currentDirectRaw = {
    success: true,
    students: students,
    column_configs: configs
  };

  closeAddColumnModal();
  renderColumnConfigs(configs);
  renderDirectTable(students, configs);
  showDirectSuccess(`Added experiment column "${colName}" (${maxMarks} Marks, Mapped to ${mappedCos.join(', ')}).`);
}

// =========================================================================
// DATA COLLECTION & CALCULATION
// =========================================================================

function collectDirectDataFromUI() {
  if (!currentDirectRaw) return null;

  const updatedConfigs = [];
  currentDirectRaw.column_configs.forEach((c, idx) => {
    const chk = document.getElementById(`chkCol_${idx}`);
    const maxInp = document.getElementById(`maxMarks_${idx}`);
    const coInp = document.getElementById(`mappedCOs_${idx}`);

    let cosList = c.mapped_cos;
    if (coInp && coInp.value.trim()) {
      cosList = coInp.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    }

    updatedConfigs.push({
      name: c.name,
      checked: chk ? chk.checked : true,
      max_marks: maxInp ? parseFloat(maxInp.value) : c.max_marks,
      mapped_cos: cosList
    });
  });

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
      if (errList.some(e => e.toLowerCase().includes('negative'))) {
        const btnFixNeg = document.getElementById('btnFixNegative');
        if (btnFixNeg) btnFixNeg.style.display = 'inline-flex';
      }
      return;
    }

    displayDirectResults(result.data);
    showDirectSuccess('✓ Direct laboratory attainment calculated successfully! All experiments have been aggregated by Course Outcome.');
    
    // Auto sync state for serverless persistence across pages
    if (typeof saveStoredState === 'function') {
      saveStoredState({ direct: result.data });
    }
    if (typeof syncStateToBackend === 'function') {
      syncStateToBackend();
    }

    setTimeout(() => {
      document.getElementById('directResultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    // Compute and display overall weighted course attainment immediately
    calculateWeightedAttainment();
  } catch (err) {
    showDirectError('Calculation error: ' + err.message);
  }
}

function displayDirectResults(data) {
  document.getElementById('directResultsSection').style.display = 'block';
  const btnTop = document.getElementById('btnGoToStep3');
  if (btnTop) btnTop.style.display = 'inline-flex';
  const btnPdfTop = document.getElementById('btnPage2PdfTop');
  if (btnPdfTop) btnPdfTop.style.display = 'inline-flex';
  const nextBar = document.getElementById('bottomNextActionBar');
  if (nextBar) nextBar.style.display = 'block';

  const total = data.total_students || 0;
  const passed = data.overall_passed_students !== undefined ? data.overall_passed_students : 0;
  const passPct = total > 0 ? Math.round((passed / total) * 100) : 0;
  const avgPct = data.avg_student_pct !== undefined ? data.avg_student_pct : 0;

  document.getElementById('statDirectAppeared').textContent = total;
  document.getElementById('statDirectPassed').textContent = `${passed} (${passPct}%)`;
  document.getElementById('statDirectAvgScore').textContent = `${avgPct}%`;
  document.getElementById('statDirectCOCount').textContent = data.all_cos ? data.all_cos.length : (data.co_summaries ? data.co_summaries.length : 0);

  // Direct CO Summary Table
  const tbodyCO = document.getElementById('directCOSummaryTable').querySelector('tbody');
  tbodyCO.innerHTML = '';
  (data.co_summaries || []).forEach(co => {
    const mappedStr = Array.isArray(co.mapped_assessments)
      ? co.mapped_assessments.join(', ')
      : (co.mapped_assessments || '-');
    const intAtt = co.has_internal ? `${co.internal_attainment}` : (co.internal_attainment !== null && co.internal_attainment !== undefined ? `${co.internal_attainment}` : '<span style="color:#94a3b8;">-</span>');
    const eseAtt = co.has_ese ? `${co.ese_attainment}` : (co.ese_attainment !== null && co.ese_attainment !== undefined ? `${co.ese_attainment}` : '<span style="color:#94a3b8;">-</span>');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bold"><strong>${co.co}</strong></td>
      <td>${mappedStr}</td>
      <td class="text-center bold">${co.pass_percentage}%</td>
      <td class="text-center bold" style="color:#b45309; font-size:14px; background:#fffbeb;">${intAtt}</td>
      <td class="text-center bold" style="color:#6d28d9; font-size:14px; background:#f5f3ff;">${eseAtt}</td>
      <td class="text-center bold" style="color:var(--accent); font-size:14px; background:#f0f9ff;">${co.attainment}</td>
      <td class="text-center">${getBadgeHtml(co.level_label)}</td>
    `;
    tbodyCO.appendChild(tr);
  });

  // Assessment summaries
  const tbodyAssess = document.getElementById('assessmentSummaryTable').querySelector('tbody');
  tbodyAssess.innerHTML = '';
  (data.assessment_summaries || []).forEach(a => {
    const minM = a.min_marks !== undefined ? a.min_marks : (a.min_scored !== undefined ? a.min_scored : '-');
    const maxM = a.max_marks_scored !== undefined ? a.max_marks_scored : (a.max_scored !== undefined ? a.max_scored : '-');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bold"><strong>${a.name}</strong></td>
      <td>${a.mapped_cos}</td>
      <td class="text-center">${a.max_marks}</td>
      <td class="text-center">${a.passing_mark}</td>
      <td class="text-center">${a.appeared}</td>
      <td class="text-center">${a.passed}</td>
      <td class="text-center">${a.failed}</td>
      <td class="text-center bold"><strong>${a.pass_pct}%</strong></td>
      <td class="text-center">${a.avg_marks}</td>
      <td class="text-center">${minM}</td>
      <td class="text-center">${maxM}</td>
    `;
    tbodyAssess.appendChild(tr);
  });

  // Student-wise table
  const tbodyStud = document.getElementById('studentSummaryTable').querySelector('tbody');
  tbodyStud.innerHTML = '';
  const studentsList = data.students || data.students_summary || [];
  studentsList.forEach((st, idx) => {
    const passedCOsStr = Array.isArray(st.passed_cos) ? st.passed_cos.join(', ') : (st.passed_cos || 'None');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-center bold">${idx + 1}</td>
      <td>${st.roll_no}</td>
      <td>${st.name}</td>
      <td class="text-center">${st.total_obtained} / ${st.total_max}</td>
      <td class="text-center bold"><strong>${st.percentage}%</strong></td>
      <td>${passedCOsStr || 'None'}</td>
    `;
    tbodyStud.appendChild(tr);
  });

  // Render direct charts
  renderDirectCharts(data);
}

// =========================================================================
// CHARTS & VISUAL ANALYTICS
// =========================================================================

function renderDirectCharts(data) {
  const cos = data.all_cos || (data.co_summaries || []).map(c => c.co);
  const passPercentages = (data.co_summaries || []).map(c => c.pass_percentage);
  const attainmentPoints = (data.co_summaries || []).map(c => c.attainment);

  // Chart 1: Pass %
  renderBarChart('chartCOPassPercent', cos, passPercentages, 'Students Passed (%)', '#3b82f6', 100);

  // Chart 2: Direct Attainment Points (0 to 3 scale)
  renderBarChart('chartCOAttainment', cos, attainmentPoints, 'Direct Attainment (Points)', '#10b981', 3.0);

  // Chart 3: Score Distribution
  const dist = [0, 0, 0, 0];
  const studentsList = data.students || data.students_summary || [];
  studentsList.forEach(s => {
    const p = s.percentage;
    if (p < 50) dist[0]++;
    else if (p < 65) dist[1]++;
    else if (p < 80) dist[2]++;
    else dist[3]++;
  });
  renderDoughnutChart('chartScoreDistribution', ['< 50% (Fail)', '50% - 64%', '65% - 79%', '≥ 80% (Distinction)'], dist, ['#ef4444', '#f59e0b', '#3b82f6', '#10b981']);

  // Chart 4: Assessment Passing Rates
  const assessNames = (data.assessment_summaries || []).map(a => a.name);
  const assessPass = (data.assessment_summaries || []).map(a => a.pass_pct);
  renderBarChart('chartAssessmentPass', assessNames, assessPass, 'Tool Pass %', '#8b5cf6', 100);
}

function renderBarChart(canvasId, labels, data, label, color, maxVal) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
  }
  chartInstances[canvasId] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: label,
        data: data,
        backgroundColor: color,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: maxVal
        }
      }
    }
  });
}

function renderDoughnutChart(canvasId, labels, data, colors) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
  }
  chartInstances[canvasId] = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

// =========================================================================
// INDIRECT SURVEY ASSESSMENT
// =========================================================================

async function uploadIndirectFile() {
  const fileInput = document.getElementById('indirectFileInput');
  if (!fileInput.files || fileInput.files.length === 0) {
    showIndirectError('Please select a survey file.');
    return;
  }
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  const scale = document.getElementById('indirectMaxRatingInput')?.value || '10';
  formData.append('rating_scale', scale);
  await sendIndirectParseRequest(formData);
}

async function uploadIndirectPasted() {
  const text = document.getElementById('indirectPasteInput').value.trim();
  if (!text) {
    showIndirectError('Please paste survey feedback data.');
    return;
  }
  const formData = new FormData();
  formData.append('pasted_text', text);
  const scale = document.getElementById('indirectMaxRatingInput')?.value || '10';
  formData.append('rating_scale', scale);
  await sendIndirectParseRequest(formData);
}

function renderDetectedCOs(cos) {
  const container = document.getElementById('detectedCOsList');
  if (!container) return;
  container.innerHTML = '';
  cos.forEach((co, idx) => {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.style.background = '#e0f2fe';
    badge.style.color = '#0369a1';
    badge.style.display = 'inline-flex';
    badge.style.alignItems = 'center';
    badge.style.gap = '6px';
    badge.innerHTML = `<span>${co}</span><button type="button" onclick="removeIndirectColumn(${idx})" title="Remove ${co} column" style="border:none;background:none;color:#dc2626;cursor:pointer;font-weight:bold;padding:0;font-size:13px;line-height:1;">&times;</button>`;
    container.appendChild(badge);
  });
}

function renderIndirectTable(ratings, cos) {
  const table = document.getElementById('indirectRatingsTable');
  if (!table) return;
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');

  let thHtml = '<tr><th style="width: 50px;" class="text-center">#</th>';
  cos.forEach((co, cIdx) => {
    thHtml += `
      <th class="text-center" style="min-width: 80px; padding: 4px 6px;">
        <div style="display: flex; flex-direction: column; align-items: center; gap: 3px;">
          <input type="text" class="cell-input text-center bold indirect-co-header" 
                 data-co-idx="${cIdx}" value="${co}" 
                 style="font-size: 11.5px; width: 66px; padding: 2px 4px; border: 1px solid var(--border-color); background: #ffffff;"
                 title="Click to rename this CO column"
                 onchange="updateIndirectColumnName(${cIdx}, this.value)">
          <button type="button" class="btn-col-cross" onclick="removeIndirectColumn(${cIdx})" title="Remove ${co} column" 
                  style="border: none; background: #fee2e2; color: #dc2626; border-radius: 50%; width: 18px; height: 18px; font-size: 13px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1; padding: 0;">&times;</button>
        </div>
      </th>
    `;
  });
  thHtml += '<th style="width: 60px;" class="text-center">Action</th></tr>';
  thead.innerHTML = thHtml;

  tbody.innerHTML = '';
  ratings.forEach((row, rIdx) => {
    const tr = document.createElement('tr');
    let trHtml = `<td class="text-center bold">${rIdx + 1}</td>`;
    cos.forEach(co => {
      const val = row[co] ?? '';
      trHtml += `<td><input type="number" step="0.5" class="cell-input" data-co="${co}" value="${val}" style="width: 100%; text-align: center;"></td>`;
    });
    trHtml += `<td class="text-center"><button type="button" class="btn-clear-file" onclick="removeIndirectRow(this)" title="Delete row" style="display:inline-block; font-size:14px; width:22px; height:22px; line-height:20px;">&times;</button></td>`;
    tr.innerHTML = trHtml;
    tbody.appendChild(tr);
  });
}

function updateIndirectColumnName(cIdx, newName) {
  if (!currentIndirectRaw) return;
  const clean = newName.trim().toUpperCase();
  if (!clean) return;
  const cos = currentIndirectRaw.detected_cos || [];
  if (cIdx < 0 || cIdx >= cos.length) return;
  const oldName = cos[cIdx];
  if (oldName === clean) return;

  cos[cIdx] = clean;
  (currentIndirectRaw.ratings_data || []).forEach(row => {
    if (row[oldName] !== undefined) {
      row[clean] = row[oldName];
      delete row[oldName];
    }
  });

  renderDetectedCOs(cos);
  renderIndirectTable(currentIndirectRaw.ratings_data, cos);
  calculateIndirectAttainment();
}

function removeIndirectColumn(cIdx) {
  if (!currentIndirectRaw) return;
  const cos = currentIndirectRaw.detected_cos || [];
  if (cIdx < 0 || cIdx >= cos.length) return;
  const colName = cos[cIdx];
  if (!confirm(`Are you sure you want to remove column ${colName}?`)) return;

  cos.splice(cIdx, 1);
  (currentIndirectRaw.ratings_data || []).forEach(row => {
    delete row[colName];
  });

  renderDetectedCOs(cos);
  renderIndirectTable(currentIndirectRaw.ratings_data, cos);
  calculateIndirectAttainment();
}

function addIndirectColumn() {
  if (!currentIndirectRaw) {
    currentIndirectRaw = { detected_cos: [], ratings_data: [] };
  }
  const cos = currentIndirectRaw.detected_cos || [];
  const nextNum = cos.length + 1;
  const name = prompt('Enter Course Outcome column name (e.g. CO' + nextNum + '):', 'CO' + nextNum);
  if (!name || !name.trim()) return;
  const clean = name.trim().toUpperCase();
  if (cos.includes(clean)) {
    alert('Column already exists!');
    return;
  }
  cos.push(clean);
  (currentIndirectRaw.ratings_data || []).forEach(row => {
    if (row[clean] === undefined) row[clean] = '';
  });
  renderDetectedCOs(cos);
  renderIndirectTable(currentIndirectRaw.ratings_data, cos);
}

function addIndirectRow() {
  const table = document.getElementById('indirectRatingsTable');
  if (!table) return;
  const tbody = table.querySelector('tbody');
  const cos = currentIndirectRaw?.detected_cos || ['CO1', 'CO2', 'CO3', 'CO4', 'CO5'];
  const rIdx = tbody.querySelectorAll('tr').length;

  const tr = document.createElement('tr');
  let trHtml = `<td class="text-center bold">${rIdx + 1}</td>`;
  cos.forEach(co => {
    trHtml += `<td><input type="number" step="0.5" class="cell-input" data-co="${co}" value="" style="width: 100%; text-align: center;"></td>`;
  });
  trHtml += `<td class="text-center"><button type="button" class="btn-clear-file" onclick="removeIndirectRow(this)" title="Delete row" style="display:inline-block; font-size:14px; width:22px; height:22px; line-height:20px;">&times;</button></td>`;
  tr.innerHTML = trHtml;
  tbody.appendChild(tr);
}

function removeIndirectRow(btn) {
  const tr = btn.closest('tr');
  if (tr) {
    tr.remove();
    const rows = document.querySelectorAll('#indirectRatingsTable tbody tr');
    rows.forEach((r, idx) => {
      const firstCol = r.querySelector('td');
      if (firstCol) firstCol.textContent = idx + 1;
    });
  }
}

function initManualIndirectTable() {
  hideIndirectAlerts();
  let cos = [];
  if (currentDirectRaw && currentDirectRaw.co_summaries && currentDirectRaw.co_summaries.length > 0) {
    cos = currentDirectRaw.co_summaries.map(c => c.co);
  } else if (currentDirectRaw && currentDirectRaw.all_cos && currentDirectRaw.all_cos.length > 0) {
    cos = currentDirectRaw.all_cos;
  } else {
    cos = ['CO1', 'CO2', 'CO3', 'CO4', 'CO5'];
  }

  const initialRatings = [];
  const studentRows = document.querySelectorAll('#directMarksTable tbody tr');
  const count = studentRows.length > 0 ? Math.min(studentRows.length, 10) : 5;
  for (let i = 0; i < count; i++) {
    const rowObj = {};
    cos.forEach(co => { rowObj[co] = ''; });
    initialRatings.push(rowObj);
  }

  currentIndirectRaw = {
    detected_cos: cos,
    ratings_data: initialRatings
  };

  renderDetectedCOs(cos);
  renderIndirectTable(initialRatings, cos);
  const sec = document.getElementById('indirectConfigSection');
  if (sec) {
    sec.style.display = 'block';
    setTimeout(() => {
      sec.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }
}

function collectIndirectDataFromUI() {
  if (!currentIndirectRaw && !document.getElementById('indirectRatingsTable')) return null;
  const cos = currentIndirectRaw?.detected_cos || ['CO1', 'CO2', 'CO3', 'CO4', 'CO5'];
  const rows = document.getElementById('indirectRatingsTable').querySelectorAll('tbody tr');
  const ratings = [];

  rows.forEach(tr => {
    const rowObj = {};
    let hasAnyValue = false;
    cos.forEach(co => {
      const inp = tr.querySelector(`input[data-co="${co}"]`);
      const v = inp ? inp.value.trim() : '';
      rowObj[co] = v;
      if (v !== '') hasAnyValue = true;
    });
    if (hasAnyValue) {
      ratings.push(rowObj);
    }
  });

  if (ratings.length === 0) {
    showIndirectError('Please enter at least one row of survey ratings in the table.');
    return null;
  }

  const maxRating = parseFloat(document.getElementById('indirectMaxRatingInput')?.value) || 10.0;

  return {
    ratings_data: ratings,
    max_rating: maxRating,
    co_columns_override: cos,
    mapping_target: 'CO'
  };
}

async function calculateIndirectAttainment() {
  hideIndirectAlerts();
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
      const errList = result.errors || [result.message || 'Indirect survey validation error.'];
      showIndirectError('Indirect Survey Validation Errors:\n• ' + errList.join('\n• '));
      return;
    }

    if (currentIndirectRaw) {
      currentIndirectRaw.ratings_data = payload.ratings_data;
      currentIndirectRaw.max_rating = payload.max_rating;
      currentIndirectRaw.detected_cos = payload.co_columns_override;
    }

    displayIndirectResults(result.data);

    if (typeof saveStoredState === 'function') {
      saveStoredState({
        indirect: result.data,
        indirect_raw: {
          detected_cos: payload.co_columns_override,
          ratings_data: payload.ratings_data,
          max_rating: payload.max_rating
        }
      });
    }
    if (typeof syncStateToBackend === 'function') {
      syncStateToBackend();
    }

    showIndirectSuccess(`✓ Indirect exit survey calculated: ${result.data.total_responses} student responses for ${result.data.co_summaries.length} COs.`);
    await calculateWeightedAttainment();
  } catch (err) {
    showIndirectError('Indirect calculation failed: ' + err.message);
  }
}

async function sendIndirectParseRequest(formData) {
  hideIndirectAlerts();
  try {
    const res = await fetch('/api/upload-indirect', {
      method: 'POST',
      body: formData
    });
    const result = await res.json();
    if (!result.success) {
      showIndirectError(result.message || 'Error parsing indirect survey.');
      return;
    }

    const detectedCOs = result.detected_cos || [];
    if (detectedCOs.length === 0) {
      showIndirectError('No Course Outcome columns detected in indirect survey (expected headers like CO1, CO2, etc.).');
      return;
    }

    currentIndirectRaw = result;

    // Render detected CO badges and the editable table so user can see and write/edit ratings!
    renderDetectedCOs(result.detected_cos);
    renderIndirectTable(result.ratings_data, result.detected_cos);

    const configSec = document.getElementById('indirectConfigSection');
    if (configSec) configSec.style.display = 'block';

    // Immediately compute indirect attainment from parsed data
    await calculateIndirectAttainment();

    setTimeout(() => {
      configSec?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  } catch (err) {
    showIndirectError('Upload failed: ' + err.message);
  }
}

function displayIndirectResults(data) {
  if (!data) return;
  const indSec = document.getElementById('indirectResultsSection');
  if (indSec) indSec.style.display = 'block';

  const totalResp = data.total_responses ?? (data.student_ratings ? data.student_ratings.length : 0);
  document.getElementById('statIndirectResponses').textContent = totalResp;

  const ratingScale = data.rating_scale || document.getElementById('indirectMaxRatingInput')?.value || 10;
  let avgRating = data.overall_avg_rating;
  let avgAtt = data.overall_attainment;

  if ((avgRating === undefined || avgRating === null) && data.co_summaries && data.co_summaries.length > 0) {
    const totalR = data.co_summaries.reduce((sum, c) => sum + (parseFloat(c.average_rating) || 0), 0);
    avgRating = (totalR / data.co_summaries.length).toFixed(2);
  }
  if ((avgAtt === undefined || avgAtt === null) && data.co_summaries && data.co_summaries.length > 0) {
    const totalA = data.co_summaries.reduce((sum, c) => sum + (parseFloat(c.attainment) || 0), 0);
    avgAtt = (totalA / data.co_summaries.length).toFixed(2);
  }

  document.getElementById('statIndirectAvgRating').textContent = `${avgRating ?? 0} / ${ratingScale}`;
  document.getElementById('statIndirectAttainment').textContent = `${avgAtt ?? 0} / 3.00`;

  const tbody = document.getElementById('indirectCOSummaryTable').querySelector('tbody');
  tbody.innerHTML = '';
  (data.co_summaries || []).forEach(co => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${co.co}</strong></td>
      <td>${co.average_rating} / ${ratingScale}</td>
      <td>${co.rating_percentage}%</td>
      <td style="font-weight: 700; color: var(--accent);">${co.attainment}</td>
      <td>${getBadgeHtml(co.level_label || co.level)}</td>
    `;
    tbody.appendChild(tr);
  });

  const cos = (data.co_summaries || []).map(c => c.co);
  const pcts = (data.co_summaries || []).map(c => c.rating_percentage);
  const atts = (data.co_summaries || []).map(c => c.attainment);
  renderBarChart('chartIndirectRatingPercent', cos, pcts, 'Exit Feedback %', '#f59e0b', 100);
  renderBarChart('chartIndirectAttainment', cos, atts, 'Indirect Attainment (Points)', '#10b981', 3.0);
}

// =========================================================================
// WEIGHTED COMBINED ATTAINMENT
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

    displayWeightedResults(result.data);
  } catch (err) {
    console.error('Weighted calculation error:', err);
  }
}

function displayWeightedResults(data) {
  document.getElementById('combinedAttainmentSection').style.display = 'block';
  document.getElementById('overallCombinedBadge').textContent = `Overall Course Attainment: ${data.overall_attainment} / 3.00 (${data.overall_level_label})`;
  const btmBar = document.getElementById('bottomNextActionBar');
  if (btmBar) btmBar.style.display = 'block';

  // Save to stored state for persistence
  if (typeof saveStoredState === 'function') {
    saveStoredState({ weighted: data });
  }
  if (typeof syncStateToBackend === 'function') {
    syncStateToBackend();
  }

  const tbody = document.getElementById('combinedAttainmentTable').querySelector('tbody');
  tbody.innerHTML = '';
  const resultsList = data.combined_results || data.co_attainments || [];
  resultsList.forEach(co => {
    const dPct = co.direct_pct !== undefined ? co.direct_pct : (co.direct_percentage || 0);
    const iPct = co.indirect_pct !== undefined ? co.indirect_pct : (co.indirect_percentage || 0);
    const cPct = co.combined_pct !== undefined ? co.combined_pct : (co.combined_percentage || 0);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${co.co}</strong></td>
      <td class="text-center">${dPct}%</td>
      <td class="text-center bold">${co.direct_attainment}</td>
      <td class="text-center">${co.indirect_attainment !== null && co.indirect_attainment !== undefined ? iPct + '%' : 'N/A'}</td>
      <td class="text-center bold">${co.indirect_attainment !== null && co.indirect_attainment !== undefined ? co.indirect_attainment : 'N/A'}</td>
      <td class="text-center"><strong>${cPct}%</strong></td>
      <td class="text-center bold" style="color: var(--accent);">${co.combined_attainment}</td>
      <td class="text-center">${getBadgeHtml(co.level_label)}</td>
    `;
    tbody.appendChild(tr);
  });

  // Render combined comparison chart
  const cos = resultsList.map(c => c.co);
  const dAtts = resultsList.map(c => c.direct_attainment);
  const iAtts = resultsList.map(c => c.indirect_attainment || 0);
  const cAtts = resultsList.map(c => c.combined_attainment);

  const canvas = document.getElementById('chartCombinedAttainment');
  if (canvas) {
    if (chartInstances['chartCombinedAttainment']) {
      chartInstances['chartCombinedAttainment'].destroy();
    }
    chartInstances['chartCombinedAttainment'] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: cos,
        datasets: [
          { label: 'Direct Attainment (80%)', data: dAtts, backgroundColor: '#3b82f6', borderRadius: 4 },
          { label: 'Indirect Attainment (20%)', data: iAtts, backgroundColor: '#f59e0b', borderRadius: 4 },
          { label: 'Combined Attainment (100%)', data: cAtts, backgroundColor: '#10b981', borderRadius: 4 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, max: 3.0 } }
      }
    });
  }
}

// =========================================================================
// ALERTS & PDF MODAL
// =========================================================================

function showDirectError(msg) {
  const el = document.getElementById('directErrorAlert');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function showDirectSuccess(msg) {
  const el = document.getElementById('directSuccessAlert');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function showDirectWarning(msg) {
  const el = document.getElementById('directWarningAlert');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function hideDirectAlerts() {
  ['directErrorAlert', 'directSuccessAlert', 'directWarningAlert'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.display = 'none'; el.textContent = ''; }
  });
}

function hideDirectError() {
  const el = document.getElementById('directErrorAlert');
  if (el) { el.style.display = 'none'; el.textContent = ''; }
}

function showIndirectError(msg) {
  const el = document.getElementById('indirectErrorAlert');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function showIndirectSuccess(msg) {
  const el = document.getElementById('indirectSuccessAlert');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function hideIndirectAlerts() {
  ['indirectErrorAlert', 'indirectSuccessAlert'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.display = 'none'; el.textContent = ''; }
  });
}

function openPage2PdfModal() {
  const modal = document.getElementById('page2PdfModal');
  if (modal) modal.style.display = 'flex';
}

function closePage2PdfModal() {
  const modal = document.getElementById('page2PdfModal');
  if (modal) modal.style.display = 'none';
}

function proceedPage2PdfDownload() {
  const option = document.querySelector('input[name="page2PdfChartOption"]:checked').value;
  closePage2PdfModal();
  const url = `/download/assessment-pdf?charts=${option}`;
  if (typeof downloadFileWithState === 'function') {
    downloadFileWithState(url, 'Laboratory_Assessment_Report.pdf');
  } else {
    window.location.href = url;
  }
}

// Auto-restore previous calculations when navigating back to Practical Assessment
window.addEventListener('DOMContentLoaded', async () => {
  renderScratchExpCOList();

  try {
    const res = await fetch('/api/get-full-state');
    let state = await res.json();
    const stored = (typeof getStoredState === 'function') ? getStoredState() : {};

    let directData = state.direct;
    if ((!directData || !directData.co_summaries || directData.co_summaries.length === 0) && stored.direct) {
      directData = stored.direct.co_summaries ? stored.direct : (stored.direct.data || stored.direct);
    }

    let indirectData = state.indirect;
    if ((!indirectData || !indirectData.co_summaries || indirectData.co_summaries.length === 0) && stored.indirect) {
      indirectData = stored.indirect.co_summaries ? stored.indirect : (stored.indirect.data || stored.indirect);
    }

    let weightedData = state.weighted;
    if ((!weightedData || (!weightedData.combined_results && !weightedData.co_attainments)) && stored.weighted) {
      weightedData = (stored.weighted.combined_results || stored.weighted.co_attainments) ? stored.weighted : (stored.weighted.data || stored.weighted);
    }

    // Sync state to backend if present in storage but missing on backend
    if ((!state.direct && directData) || (!state.indirect && indirectData) || (!state.weighted && weightedData)) {
      if (typeof syncStateToBackend === 'function') {
        syncStateToBackend(stored);
      }
    }

    if (directData && directData.co_summaries && directData.co_summaries.length > 0) {
      currentDirectRaw = directData;
      displayDirectResults(directData);
      const resSec = document.getElementById('directResultsSection');
      if (resSec) resSec.style.display = 'block';
      const btnGo = document.getElementById('btnGoToStep3');
      if (btnGo) btnGo.style.display = 'inline-flex';
      const btnPdf = document.getElementById('btnPage2PdfTop');
      if (btnPdf) btnPdf.style.display = 'inline-flex';
      const nextBar = document.getElementById('bottomNextActionBar');
      if (nextBar) nextBar.style.display = 'block';
    }

    const indirectRaw = stored.indirect_raw || (state.indirect_raw ? {
      detected_cos: (state.indirect_raw.headers || []).filter(h => h.toUpperCase().includes('CO')),
      ratings_data: state.indirect_raw.ratings_data
    } : null);

    if (indirectRaw && indirectRaw.ratings_data && indirectRaw.ratings_data.length > 0) {
      currentIndirectRaw = indirectRaw;
      renderDetectedCOs(indirectRaw.detected_cos || ['CO1', 'CO2', 'CO3', 'CO4', 'CO5']);
      renderIndirectTable(indirectRaw.ratings_data, indirectRaw.detected_cos || ['CO1', 'CO2', 'CO3', 'CO4', 'CO5']);
      const configSec = document.getElementById('indirectConfigSection');
      if (configSec) configSec.style.display = 'block';
      if (indirectRaw.max_rating) {
        const inp = document.getElementById('indirectMaxRatingInput');
        if (inp) inp.value = indirectRaw.max_rating;
      }
    }

    if (indirectData && indirectData.co_summaries && indirectData.co_summaries.length > 0) {
      currentIndirectRaw = currentIndirectRaw || indirectData;
      displayIndirectResults(indirectData);
    }

    if (weightedData && (weightedData.combined_results || weightedData.co_attainments)) {
      displayWeightedResults(weightedData);
    } else if (directData && directData.co_summaries && directData.co_summaries.length > 0) {
      // Direct exists but weighted was not cached, auto-compute it
      calculateWeightedAttainment();
    }
  } catch (err) {
    console.warn('Could not restore practical evaluation state:', err);
  }
});
