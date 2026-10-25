/**
 * Page 3 JavaScript - CO-PO Mapping and PO Attainment Evaluation
 */

let currentCOPOState = {
  co_list: ['CO1', 'CO2', 'CO3', 'CO4', 'CO5', 'CO6'],
  po_list: ['PO1', 'PO2', 'PO3', 'PO4', 'PO5', 'PO6', 'PO7', 'PO8', 'PO9', 'PO10', 'PO11', 'PO12', 'PSO1', 'PSO2', 'PSO3'],
  matrix: {}
};
let copoCharts = {};

function switchCOPOTab(mode) {
  document.querySelectorAll('#copoFileTab, #copoPasteTab').forEach(el => el.classList.remove('active'));
  const btns = event.target.parentElement.querySelectorAll('.tab-btn');
  btns.forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');

  if (mode === 'file') {
    document.getElementById('copoFileTab').classList.add('active');
  } else {
    document.getElementById('copoPasteTab').classList.add('active');
  }
}

function showCOPOError(msg) {
  const el = document.getElementById('copoErrorAlert');
  el.textContent = msg;
  el.style.display = 'block';
}

function hideCOPOError() {
  const el = document.getElementById('copoErrorAlert');
  el.style.display = 'none';
  el.textContent = '';
}

async function uploadCOPOFile() {
  const inp = document.getElementById('copoFileInput');
  if (!inp.files || inp.files.length === 0) {
    showCOPOError('Please choose a CO-PO matrix file.');
    return;
  }
  const formData = new FormData();
  formData.append('file', inp.files[0]);
  await sendCOPOParseRequest(formData);
}

async function uploadCOPOPasted() {
  const text = document.getElementById('copoPasteInput').value.trim();
  if (!text) {
    showCOPOError('Please paste CO-PO matrix data into the text box.');
    return;
  }
  const formData = new FormData();
  formData.append('pasted_text', text);
  await sendCOPOParseRequest(formData);
}


async function sendCOPOParseRequest(formData) {
  hideCOPOError();
  try {
    const res = await fetch('/api/upload-copo', {
      method: 'POST',
      body: formData
    });
    const result = await res.json();
    if (!result.success) {
      showCOPOError(result.message || 'Error parsing CO-PO matrix.');
      return;
    }

    currentCOPOState.co_list = result.co_list;
    currentCOPOState.po_list = result.po_list;
    currentCOPOState.matrix = result.matrix;

    renderMatrixTable();
    document.getElementById('matrixSection').style.display = 'block';
    await calculatePOAttainment();
  } catch (err) {
    showCOPOError('Upload failed: ' + err.message);
  }
}

async function initializeBlankMatrix() {
  hideCOPOError();
  let co_list = ['CO1', 'CO2', 'CO3', 'CO4', 'CO5'];
  try {
    const res = await fetch('/api/get-full-state');
    const state = await res.json();
    if (state.direct && state.direct.all_cos && state.direct.all_cos.length > 0) {
      co_list = state.direct.all_cos;
    } else if (state.weighted && state.weighted.combined_results && state.weighted.combined_results.length > 0) {
      co_list = state.weighted.combined_results.map(c => c.co);
    }
  } catch (e) {
    console.warn('Could not fetch evaluated COs:', e);
  }

  const po_list = ['PO1', 'PO2', 'PO3', 'PO4', 'PO5', 'PO6', 'PO7', 'PO8', 'PO9', 'PO10', 'PO11', 'PO12', 'PSO1', 'PSO2', 'PSO3'];
  const matrix = {};

  co_list.forEach(co => {
    matrix[co] = {};
    po_list.forEach(po => {
      matrix[co][po] = 0;
    });
  });

  currentCOPOState.co_list = co_list;
  currentCOPOState.po_list = po_list;
  currentCOPOState.matrix = matrix;

  renderMatrixTable();
  document.getElementById('matrixSection').style.display = 'block';
}

function renderMatrixTable() {
  const table = document.getElementById('copoMatrixTable');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');

  let thHtml = '<tr><th style="width: 130px;">Course Outcome</th>';
  currentCOPOState.po_list.forEach((po, cIdx) => {
    thHtml += `
      <th class="text-center" style="min-width: 70px; padding: 4px 6px;">
        <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
          <input type="text" class="cell-input text-center bold po-header-input" 
                 data-po-index="${cIdx}" value="${po}" 
                 style="font-size: 11px; width: 62px; padding: 2px 4px; border: 1px solid var(--border-color); background: #ffffff;"
                 title="Click to rename this Program Outcome column"
                 onchange="updatePOColumnName(${cIdx}, this.value)">
          <button type="button" onclick="removePOColumn(${cIdx})" title="Remove ${po} column" 
                  style="border: none; background: none; color: #ef4444; font-size: 13px; cursor: pointer; line-height: 1; padding: 0;">&times;</button>
        </div>
      </th>
    `;
  });
  thHtml += '<th style="width: 60px;">Action</th></tr>';
  thead.innerHTML = thHtml;

  tbody.innerHTML = '';
  currentCOPOState.co_list.forEach((co, rIdx) => {
    const tr = document.createElement('tr');
    tr.id = `copoRow_${rIdx}`;
    let trHtml = `
      <td class="bold">
        <input type="text" class="cell-input bold" data-field="co_name" value="${co}" style="width: 95px;" 
               title="Course Outcome name - click to edit"
               onchange="updateCORowName(${rIdx}, this.value)">
      </td>
    `;
    currentCOPOState.po_list.forEach((po, cIdx) => {
      const val = (currentCOPOState.matrix[co] && currentCOPOState.matrix[co][po]) !== undefined ? currentCOPOState.matrix[co][po] : '';
      trHtml += `
        <td class="text-center">
          <input type="number" min="0" max="3" step="1" class="cell-input text-center bold" 
                 data-po-col="${cIdx}" data-co="${co}" data-po="${po}" value="${val !== 0 ? val : ''}" placeholder="-">
        </td>
      `;
    });
    trHtml += `
      <td class="text-center">
        <button type="button" class="btn btn-outline btn-sm" style="color:#ef4444;padding:2px 6px;" onclick="removeCORow(${rIdx})" title="Delete row">&times;</button>
      </td>
    `;
    tr.innerHTML = trHtml;
    tbody.appendChild(tr);
  });
}

function updateCORowName(rIdx, newName) {
  const clean = newName.trim().toUpperCase();
  if (!clean) return;
  const oldName = currentCOPOState.co_list[rIdx];
  if (oldName === clean) return;

  if (currentCOPOState.matrix[oldName]) {
    const rowVals = currentCOPOState.matrix[oldName];
    delete currentCOPOState.matrix[oldName];
    currentCOPOState.matrix[clean] = rowVals;
  }
  currentCOPOState.co_list[rIdx] = clean;
  renderMatrixTable();
}

function updatePOColumnName(cIdx, newName) {
  const clean = newName.trim().toUpperCase();
  if (!clean) return;
  const oldName = currentCOPOState.po_list[cIdx];
  if (oldName === clean) return;
  
  // Update in matrix dict for each CO
  currentCOPOState.co_list.forEach(co => {
    if (currentCOPOState.matrix[co]) {
      const val = currentCOPOState.matrix[co][oldName] || 0;
      delete currentCOPOState.matrix[co][oldName];
      currentCOPOState.matrix[co][clean] = val;
    }
  });
  currentCOPOState.po_list[cIdx] = clean;
  renderMatrixTable();
}

function removePOColumn(cIdx) {
  const poName = currentCOPOState.po_list[cIdx];
  if (!confirm(`Are you sure you want to remove column ${poName}?`)) return;
  currentCOPOState.po_list.splice(cIdx, 1);
  currentCOPOState.co_list.forEach(co => {
    if (currentCOPOState.matrix[co]) {
      delete currentCOPOState.matrix[co][poName];
    }
  });
  renderMatrixTable();
}

function addPOColumn() {
  const count = currentCOPOState.po_list.length + 1;
  const name = prompt('Enter new Program Outcome name (e.g. PSO3 or PO12):', `PSO${count - 11 > 0 ? count - 11 : count}`);
  if (!name || !name.trim()) return;

  const cleanName = name.trim().toUpperCase();
  if (currentCOPOState.po_list.includes(cleanName)) {
    alert('Column already exists!');
    return;
  }
  currentCOPOState.po_list.push(cleanName);
  currentCOPOState.co_list.forEach(co => {
    if (!currentCOPOState.matrix[co]) currentCOPOState.matrix[co] = {};
    currentCOPOState.matrix[co][cleanName] = 0;
  });
  renderMatrixTable();
}

function addCORow() {
  const nextNum = currentCOPOState.co_list.length + 1;
  const newCO = `CO${nextNum}`;
  currentCOPOState.co_list.push(newCO);
  currentCOPOState.matrix[newCO] = {};
  currentCOPOState.po_list.forEach(po => {
    currentCOPOState.matrix[newCO][po] = 0;
  });
  renderMatrixTable();
}

function removeCORow(idx) {
  const co = currentCOPOState.co_list[idx];
  currentCOPOState.co_list.splice(idx, 1);
  delete currentCOPOState.matrix[co];
  renderMatrixTable();
}

function collectMatrixFromUI() {
  const table = document.getElementById('copoMatrixTable');
  const rows = table.querySelectorAll('tbody tr');
  const matrix = {};
  const co_list = [];

  // Read current header names directly from header inputs
  const headerInputs = table.querySelectorAll('thead .po-header-input');
  const active_po_list = [];
  headerInputs.forEach((inp, idx) => {
    const val = inp.value.trim().toUpperCase() || currentCOPOState.po_list[idx] || `PO${idx+1}`;
    active_po_list.push(val);
  });
  if (active_po_list.length > 0) {
    currentCOPOState.po_list = active_po_list;
  }

  rows.forEach(tr => {
    const coInp = tr.querySelector('input[data-field="co_name"]');
    const co = coInp ? coInp.value.trim().toUpperCase() : 'CO';
    co_list.push(co);
    matrix[co] = {};

    active_po_list.forEach((po, cIdx) => {
      const inp = tr.querySelector(`input[data-po-col="${cIdx}"]`) || tr.querySelector(`input[data-po="${po}"]`);
      const val = inp && inp.value.trim() !== '' ? parseFloat(inp.value.trim()) : 0;
      matrix[co][po] = val;
    });
  });

  currentCOPOState.co_list = co_list;
  currentCOPOState.matrix = matrix;

  return {
    matrix: matrix,
    co_list: co_list,
    po_list: active_po_list
  };
}

async function calculatePOAttainment() {
  hideCOPOError();
  const payload = collectMatrixFromUI();
  try {
    const res = await fetch('/api/compute-copo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (!result.success) {
      showCOPOError(result.message || 'Error computing PO attainment.');
      return;
    }

    renderPOResults(result.data);
    if (typeof saveStoredState === 'function') {
      saveStoredState({ copo: result.data });
    }
    document.getElementById('poResultsSection').style.display = 'block';
    document.getElementById('btnGoToStep4').style.display = 'inline-flex';
    const btnPdfTop = document.getElementById('btnCOPOPdfTop');
    if (btnPdfTop) btnPdfTop.style.display = 'inline-flex';
  } catch (err) {
    showCOPOError('PO calculation error: ' + err.message);
  }
}

function renderPOResults(data) {
  currentCOPOState.lastResult = data;
  const tbody = document.getElementById('poResultsTable').querySelector('tbody');
  tbody.innerHTML = '';

  document.getElementById('overallPOBadge').textContent =
    `Average PO Attainment: ${data.overall_po_attainment} / 3.00 (${data.overall_po_level})`;

  data.po_results.forEach(p => {
    const tr = document.createElement('tr');
    const attDisp = p.attainment !== null ? p.attainment : '-';
    const directDisp = (p.direct_attainment !== undefined && p.direct_attainment !== null) ? p.direct_attainment : '-';
    const indirectDisp = (p.indirect_attainment !== undefined && p.indirect_attainment !== null) ? p.indirect_attainment : '-';
    const avgMapDisp = (p.mapping_avg !== undefined && p.mapping_avg !== null) ? p.mapping_avg : '-';
    const contribStr = p.contributing_cos.map(c => `${c.co} (L${c.level})`).join(', ') || 'None';

    let levelBadge = '<span class="badge" style="background:#f1f5f9;color:#64748b;">Not Mapped</span>';
    if (p.attainment !== null) {
      if (p.attainment >= 2.4) levelBadge = '<span class="badge badge-level-3">Level 3 (High)</span>';
      else if (p.attainment >= 1.5) levelBadge = '<span class="badge badge-level-2">Level 2 (Medium)</span>';
      else if (p.attainment >= 1.0) levelBadge = '<span class="badge badge-level-1">Level 1 (Low)</span>';
      else levelBadge = '<span class="badge badge-level-0">Level 0 (Unattained)</span>';
    }

    tr.innerHTML = `
      <td class="bold">${p.po}</td>
      <td class="text-center">${p.mapping_sum}</td>
      <td class="text-center bold">${avgMapDisp}</td>
      <td class="text-center" style="color:#166534; font-weight:600;">${directDisp}</td>
      <td class="text-center" style="color:#854d0e; font-weight:600;">${indirectDisp}</td>
      <td class="text-center bold" style="color:var(--accent); font-size:14px;">${attDisp}</td>
      <td class="text-center">${levelBadge}</td>
      <td><span style="font-size:12px; color:var(--text-muted);">${contribStr}</span></td>
    `;
    tbody.appendChild(tr);
  });

  renderMatrixFooter(data);
  renderPOCharts(data.po_results);
}

function renderMatrixFooter(data) {
  const table = document.getElementById('copoMatrixTable');
  if (!table) return;
  let tfoot = table.querySelector('tfoot');
  if (!tfoot) {
    tfoot = document.createElement('tfoot');
    table.appendChild(tfoot);
  }
  tfoot.innerHTML = '';

  const poResultsMap = {};
  if (data && data.po_results) {
    data.po_results.forEach(p => {
      poResultsMap[p.po] = p;
    });
  }

  const rowsConfig = [
    { label: 'CO-PO-PSO Mapping (Average Level)', key: 'mapping_avg', bg: '#f8fafc', color: '#1e293b' },
    { label: 'Direct PO Attainment', key: 'direct_attainment', bg: '#f0fdf4', color: '#166534' },
    { label: 'Indirect PO Attainment', key: 'indirect_attainment', bg: '#fefce8', color: '#854d0e' },
    { label: 'Final Combined Attainment', key: 'attainment', bg: '#eff6ff', color: '#1d4ed8' }
  ];

  rowsConfig.forEach(cfg => {
    const tr = document.createElement('tr');
    tr.style.backgroundColor = cfg.bg;
    let html = `<td class="bold" style="color: ${cfg.color}; font-size: 11.5px; white-space: nowrap; padding: 6px 8px;">${cfg.label}</td>`;
    currentCOPOState.po_list.forEach(po => {
      const p = poResultsMap[po];
      let val = '-';
      if (p && p[cfg.key] !== undefined && p[cfg.key] !== null) {
        val = p[cfg.key];
      }
      html += `<td class="text-center bold" style="color: ${cfg.color}; font-size: 12px; padding: 6px 4px;">${val}</td>`;
    });
    html += `<td></td>`;
    tr.innerHTML = html;
    tfoot.appendChild(tr);
  });
}

// Custom Chart.js Plugin: Draw data value on top of each bar
const barTopValuePlugin = {
  id: 'barTopValuePlugin',
  afterDatasetsDraw(chart) {
    const { ctx, data } = chart;
    if (chart.config.type !== 'bar') return;
    ctx.save();
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (meta.hidden) return;
      meta.data.forEach((bar, index) => {
        const val = dataset.data[index];
        if (val === null || val === undefined || val === 0) return;
        const valStr = typeof val === 'number' ? (Number.isInteger(val) ? val.toString() : val.toFixed(2)) : val.toString();
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 9.5px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(valStr, bar.x, bar.y - 3);
      });
    });
    ctx.restore();
  }
};

if (typeof Chart !== 'undefined' && Chart.register) {
  try {
    Chart.register(barTopValuePlugin);
  } catch (e) {
    // plugin may already be registered
  }
}

function renderPOCharts(po_results) {
  const labels = po_results.map(p => p.po);
  const mappingVals = po_results.map(p => (p.mapping_avg !== undefined && p.mapping_avg !== null) ? p.mapping_avg : 0);
  const directVals = po_results.map(p => (p.direct_attainment !== undefined && p.direct_attainment !== null) ? p.direct_attainment : 0);
  const indirectVals = po_results.map(p => (p.indirect_attainment !== undefined && p.indirect_attainment !== null) ? p.indirect_attainment : 0);

  // 1. Direct Attainment vs Mapping Bar Chart (Excel Style: Blue #4F81BD vs Red #C0504D)
  const ctxDirect = document.getElementById('chartPODirectBar');
  if (ctxDirect) {
    if (copoCharts['directBar']) copoCharts['directBar'].destroy();
    copoCharts['directBar'] = new Chart(ctxDirect, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'CO-PO-PSO Mapping',
            data: mappingVals,
            backgroundColor: '#4F81BD',
            borderColor: '#385D8A',
            borderWidth: 1,
            borderRadius: 3
          },
          {
            label: 'CO-PO-PSO Direct Attainment',
            data: directVals,
            backgroundColor: '#C0504D',
            borderColor: '#943734',
            borderWidth: 1,
            borderRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 11, weight: 'bold' } } }
        },
        scales: {
          y: { beginAtZero: true, max: 3.5, ticks: { stepSize: 0.5 } },
          x: { ticks: { font: { size: 10, weight: 'bold' } } }
        }
      }
    });
  }

  // 2. Indirect Attainment vs Mapping Bar Chart (Excel Style: Blue #4F81BD vs Red #C0504D)
  const ctxIndirect = document.getElementById('chartPOIndirectBar');
  if (ctxIndirect) {
    if (copoCharts['indirectBar']) copoCharts['indirectBar'].destroy();
    copoCharts['indirectBar'] = new Chart(ctxIndirect, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'CO-PO-PSO Mapping',
            data: mappingVals,
            backgroundColor: '#4F81BD',
            borderColor: '#385D8A',
            borderWidth: 1,
            borderRadius: 3
          },
          {
            label: 'CO-PO-PSO Indirect Attainment',
            data: indirectVals,
            backgroundColor: '#C0504D',
            borderColor: '#943734',
            borderWidth: 1,
            borderRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 11, weight: 'bold' } } }
        },
        scales: {
          y: { beginAtZero: true, max: 3.5, ticks: { stepSize: 0.5 } },
          x: { ticks: { font: { size: 10, weight: 'bold' } } }
        }
      }
    });
  }
}

// Auto-restore saved matrix if user already calculated or uploaded earlier
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/get-full-state');
    let state = await res.json();
    const stored = (typeof getStoredState === 'function') ? getStoredState() : {};
    
    let copoData = state.copo;
    if ((!copoData || !copoData.matrix || Object.keys(copoData.matrix).length === 0) && stored.copo) {
      copoData = stored.copo;
      if (typeof syncStateToBackend === 'function') {
        syncStateToBackend(stored);
      }
    }

    if (copoData && copoData.matrix && Object.keys(copoData.matrix).length > 0) {
      currentCOPOState.co_list = copoData.co_list || Object.keys(copoData.matrix);
      currentCOPOState.po_list = copoData.po_list || [];
      currentCOPOState.matrix = copoData.matrix;
      renderMatrixTable();
      document.getElementById('matrixSection').style.display = 'block';
      if (copoData.po_results && copoData.po_results.length > 0) {
        renderPOResults(copoData);
        document.getElementById('poResultsSection').style.display = 'block';
        document.getElementById('btnGoToStep4').style.display = 'inline-flex';
        const btnPdfTop = document.getElementById('btnCOPOPdfTop');
        if (btnPdfTop) btnPdfTop.style.display = 'inline-flex';
      }
    }
  } catch (err) {
    console.warn('Could not restore saved CO-PO state:', err);
  }
});
