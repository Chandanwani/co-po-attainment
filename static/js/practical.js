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
  const count = parseInt(document.getElementById('scratchExpCount').value) || 10;

  const currentSelections = {};
  for (let i = 1; i <= 35; i++) {
    const el = document.getElementById(`scratchExpCO_${i}`);
    if (el) currentSelections[i] = el.value;
  }

  container.innerHTML = '';
  for (let i = 1; i <= count; i++) {
    const chip = document.createElement('div');
    chip.style.cssText = 'background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 8px; font-size: 12px; display: flex; align-items: center; justify-content: space-between; gap: 4px;';
    
    // Default suggestion for user convenience (e.g. 2 per CO)
    const defaultCO = `CO${Math.min(5, Math.floor((i - 1) / 2) + 1)}`;
    const selVal = currentSelections[i] || defaultCO;

    chip.innerHTML = `
      <strong style="color: #1e293b; white-space: nowrap;">Exp ${i}:</strong>
      <select id="scratchExpCO_${i}" class="form-control" style="width: auto; padding: 2px 4px; font-size: 11.5px; height: 26px; font-weight: 700; color: #1e40af;">
        <option value="CO1" ${selVal === 'CO1' ? 'selected' : ''}>CO1</option>
        <option value="CO2" ${selVal === 'CO2' ? 'selected' : ''}>CO2</option>
        <option value="CO3" ${selVal === 'CO3' ? 'selected' : ''}>CO3</option>
        <option value="CO4" ${selVal === 'CO4' ? 'selected' : ''}>CO4</option>
        <option value="CO5" ${selVal === 'CO5' ? 'selected' : ''}>CO5</option>
        <option value="CO6" ${selVal === 'CO6' ? 'selected' : ''}>CO6</option>
        <option value="CO1, CO2" ${selVal === 'CO1, CO2' ? 'selected' : ''}>CO1, CO2</option>
        <option value="CO1, CO2, CO3, CO4, CO5" ${selVal.includes('CO1') && selVal.includes('CO5') ? 'selected' : ''}>All COs</option>
      </select>
    `;
    container.appendChild(chip);
  }
}

function buildPracticalSheetFromScratch() {
  hideDirectAlerts();

  const expCount = parseInt(document.getElementById('scratchExpCount').value) || 10;
  const expMax = parseFloat(document.getElementById('scratchExpMaxMarks').value) || 25;

  // 1. Build Column Configs reading the user's selected CO for each experiment
  const configs = [];
  for (let i = 1; i <= expCount; i++) {
    const selEl = document.getElementById(`scratchExpCO_${i}`);
    const selVal = selEl ? selEl.value : `CO${Math.min(5, Math.floor((i - 1) / 2) + 1)}`;
    const mappedCOs = selVal.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

    configs.push({
      name: `Exp ${i}`,
      max_marks: expMax,
      mapped_cos: mappedCOs,
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
  const sel = document.getElementById(`mappedCOSelect_${idx}`);
  const customInp = document.getElementById(`mappedCOs_${idx}`);
  if (!sel || !customInp) return;

  if (sel.value === 'custom') {
    customInp.style.display = 'inline-block';
    customInp.focus();
  } else {
    customInp.style.display = 'none';
    customInp.value = sel.value;
  }

  if (currentDirectRaw && currentDirectRaw.column_configs && currentDirectRaw.column_configs[idx]) {
    const val = (sel.value === 'custom') ? customInp.value : sel.value;
    currentDirectRaw.column_configs[idx].mapped_cos = val.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  }
}

function renderColumnConfigs(configs) {
  const container = document.getElementById('columnConfigGrid');
  container.innerHTML = '';

  configs.forEach((col, idx) => {
    const card = document.createElement('div');
    card.className = `col-config-item ${col.checked ? '' : 'excluded'}`;
    card.id = `colConfigCard_${idx}`;

    const cosStr = Array.isArray(col.mapped_cos) ? col.mapped_cos.join(', ') : (col.mapped_cos || 'CO1');
    const isStandardOption = ['CO1', 'CO2', 'CO3', 'CO4', 'CO5', 'CO6', 'CO1, CO2'].includes(cosStr) || (cosStr.includes('CO1') && cosStr.includes('CO5'));
    const isAllCOs = cosStr.includes('CO1') && cosStr.includes('CO5') && !['CO1', 'CO2', 'CO3', 'CO4', 'CO5', 'CO6', 'CO1, CO2'].includes(cosStr);

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
        <label style="font-size: 12px; font-weight: 700; color: #1e3a8a;">Select Mapped CO:</label>
        <select id="mappedCOSelect_${idx}" class="form-control" style="width: auto; padding: 2px 6px; font-size: 12px; height: 28px; font-weight: 700; color: #1e40af;" onchange="onMappedCOSelectChange(${idx})" ${col.checked ? '' : 'disabled'}>
          <option value="CO1" ${cosStr === 'CO1' ? 'selected' : ''}>CO1</option>
          <option value="CO2" ${cosStr === 'CO2' ? 'selected' : ''}>CO2</option>
          <option value="CO3" ${cosStr === 'CO3' ? 'selected' : ''}>CO3</option>
          <option value="CO4" ${cosStr === 'CO4' ? 'selected' : ''}>CO4</option>
          <option value="CO5" ${cosStr === 'CO5' ? 'selected' : ''}>CO5</option>
          <option value="CO6" ${cosStr === 'CO6' ? 'selected' : ''}>CO6</option>
          <option value="CO1, CO2" ${cosStr === 'CO1, CO2' ? 'selected' : ''}>CO1, CO2</option>
          <option value="CO1, CO2, CO3, CO4, CO5" ${isAllCOs ? 'selected' : ''}>All COs (CO1..CO5)</option>
          <option value="custom" ${!isStandardOption ? 'selected' : ''}>Custom...</option>
        </select>
        <input type="text" id="mappedCOs_${idx}" class="form-control" style="padding: 2px 6px; font-size: 12px; width: 110px; height: 28px; display: ${!isStandardOption ? 'inline-block' : 'none'};" value="${cosStr}" placeholder="e.g. CO1, CO2" title="Separate multiple COs with comma" oninput="onCustomCOInput(${idx})" ${col.checked ? '' : 'disabled'}>
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

  let thHtml = '<tr><th style="width: 50px;">#</th><th style="width: 110px;">Roll No</th><th>Student Name</th>';
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
      <td><input type="text" class="cell-input" data-field="roll" value="${s.roll_no || ''}" placeholder="Roll No"></td>
      <td><input type="text" class="cell-input" data-field="name" value="${s.name || ''}" placeholder="Student Name"></td>
    `;
    configs.forEach(c => {
      const val = s.marks ? (s.marks[c.name] ?? '') : '';
      const numVal = parseFloat(val);
      const isNeg = !isNaN(numVal) && numVal < 0;
      if (isNeg) hasNegative = true;
      const cellStyle = isNeg ? 'style="background-color: #fee2e2; border-color: #ef4444; color: #991b1b; font-weight: 700;" title="Negative mark"' : '';
      trHtml += `<td><input type="number" step="0.01" class="cell-input" data-col="${c.name}" value="${val}" ${cellStyle} oninput="onCellMarkInput(this)"></td>`;
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
  configs.forEach(c => {
    trHtml += `<td><input type="number" step="0.01" class="cell-input" data-col="${c.name}" value="" placeholder="Mark"></td>`;
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
    const coSel = document.getElementById(`mappedCOSelect_${idx}`);
    const coInp = document.getElementById(`mappedCOs_${idx}`);

    let cosList = c.mapped_cos;
    if (coSel && coSel.value !== 'custom') {
      cosList = coSel.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    } else if (coInp && coInp.value) {
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
    
    // Auto sync state for serverless persistence
    if (typeof syncFullStateToBackend === 'function') {
      syncFullStateToBackend();
    }

    setTimeout(() => {
      document.getElementById('directResultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    // If indirect already present, re-calculate combined
    if (currentIndirectRaw) {
      calculateWeightedAttainment();
    }
  } catch (err) {
    showDirectError('Calculation error: ' + err.message);
  }
}

function displayDirectResults(data) {
  document.getElementById('directResultsSection').style.display = 'block';
  document.getElementById('btnGoToStep3').style.display = 'inline-block';
  document.getElementById('btnPage2PdfTop').style.display = 'inline-block';

  document.getElementById('statDirectAppeared').textContent = data.total_students_evaluated;
  document.getElementById('statDirectPassed').textContent = `${data.total_students_passed} (${data.overall_percentage}%)`;
  document.getElementById('statDirectAvgScore').textContent = `${data.overall_percentage}%`;
  document.getElementById('statDirectCOCount').textContent = data.all_cos ? data.all_cos.length : 0;

  // Direct CO Summary Table
  const tbodyCO = document.getElementById('directCOSummaryTable').querySelector('tbody');
  tbodyCO.innerHTML = '';
  (data.co_summaries || []).forEach(co => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${co.co}</strong></td>
      <td>${co.mapped_assessments.join(', ')}</td>
      <td>${co.pass_percentage}%</td>
      <td><strong>${co.internal_attainment !== null ? co.internal_attainment : '-'}</strong></td>
      <td><strong>${co.ese_attainment !== null ? co.ese_attainment : '-'}</strong></td>
      <td style="font-weight: 700; color: var(--accent);">${co.attainment}</td>
      <td>${getBadgeHtml(co.level_label)}</td>
    `;
    tbodyCO.appendChild(tr);
  });

  // Assessment summaries
  const tbodyAssess = document.getElementById('assessmentSummaryTable').querySelector('tbody');
  tbodyAssess.innerHTML = '';
  (data.assessment_summaries || []).forEach(a => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${a.name}</strong></td>
      <td>${a.mapped_cos}</td>
      <td>${a.max_marks}</td>
      <td>${a.passing_mark}</td>
      <td>${a.appeared}</td>
      <td>${a.passed}</td>
      <td>${a.failed}</td>
      <td><strong>${a.pass_pct}%</strong></td>
      <td>${a.avg_marks}</td>
      <td>${a.min_scored}</td>
      <td>${a.max_scored}</td>
    `;
    tbodyAssess.appendChild(tr);
  });

  // Student-wise table
  const tbodyStud = document.getElementById('studentSummaryTable').querySelector('tbody');
  tbodyStud.innerHTML = '';
  (data.students_summary || []).forEach((st, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${st.roll_no}</td>
      <td>${st.name}</td>
      <td>${st.total_obtained} / ${st.total_max}</td>
      <td><strong>${st.percentage}%</strong></td>
      <td>${st.passed_cos.join(', ') || 'None'}</td>
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
  const cos = data.all_cos || [];
  const passPercentages = (data.co_summaries || []).map(c => c.pass_percentage);
  const attainmentPoints = (data.co_summaries || []).map(c => c.attainment);

  // Chart 1: Pass %
  renderBarChart('chartCOPassPercent', cos, passPercentages, 'Students Passed (%)', '#3b82f6', 100);

  // Chart 2: Direct Attainment Points (0 to 3 scale)
  renderBarChart('chartCOAttainment', cos, attainmentPoints, 'Direct Attainment (Points)', '#10b981', 3.0);

  // Chart 3: Score Distribution
  const dist = [0, 0, 0, 0];
  (data.students_summary || []).forEach(s => {
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
  formData.append('rating_scale', document.getElementById('ratingScaleSelect').value);
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
  formData.append('rating_scale', document.getElementById('ratingScaleSelect').value);
  await sendIndirectParseRequest(formData);
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
    currentIndirectRaw = result;
    displayIndirectResults(result.data);
    showIndirectSuccess(`Indirect exit survey processed: ${result.data.total_responses} student responses for ${result.data.co_summaries.length} COs.`);
    calculateWeightedAttainment();
  } catch (err) {
    showIndirectError('Upload failed: ' + err.message);
  }
}

function displayIndirectResults(data) {
  document.getElementById('indirectResultsSection').style.display = 'block';
  document.getElementById('statIndirectResponses').textContent = data.total_responses;
  document.getElementById('statIndirectAvgRating').textContent = `${data.overall_avg_rating} / ${data.rating_scale}`;
  document.getElementById('statIndirectAttainment').textContent = `${data.overall_attainment} / 3.00`;

  const tbody = document.getElementById('indirectCOSummaryTable').querySelector('tbody');
  tbody.innerHTML = '';
  (data.co_summaries || []).forEach(co => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${co.co}</strong></td>
      <td>${co.average_rating} / ${data.rating_scale}</td>
      <td>${co.rating_percentage}%</td>
      <td style="font-weight: 700; color: var(--accent);">${co.attainment}</td>
      <td>${getBadgeHtml(co.level_label)}</td>
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

  const tbody = document.getElementById('combinedAttainmentTable').querySelector('tbody');
  tbody.innerHTML = '';
  (data.co_attainments || []).forEach(co => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${co.co}</strong></td>
      <td>${co.direct_percentage}%</td>
      <td>${co.direct_attainment}</td>
      <td>${co.indirect_percentage !== null ? co.indirect_percentage + '%' : 'N/A'}</td>
      <td>${co.indirect_attainment !== null ? co.indirect_attainment : 'N/A'}</td>
      <td><strong>${co.combined_percentage}%</strong></td>
      <td style="font-weight: 700; color: var(--accent);">${co.combined_attainment}</td>
      <td>${getBadgeHtml(co.level_label)}</td>
    `;
    tbody.appendChild(tr);
  });

  // Render combined comparison chart
  const cos = (data.co_attainments || []).map(c => c.co);
  const dAtts = (data.co_attainments || []).map(c => c.direct_attainment);
  const iAtts = (data.co_attainments || []).map(c => c.indirect_attainment || 0);
  const cAtts = (data.co_attainments || []).map(c => c.combined_attainment);

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

window.addEventListener('DOMContentLoaded', () => {
  renderScratchExpCOList();
});
