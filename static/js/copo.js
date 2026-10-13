/**
 * Page 3 JavaScript - CO-PO Mapping and PO Attainment Evaluation
 */

let currentCOPOState = {
  co_list: ['CO1', 'CO2', 'CO3', 'CO4', 'CO5', 'CO6'],
  po_list: ['PO1', 'PO2', 'PO3', 'PO4', 'PO5', 'PO6', 'PO7', 'PO8', 'PO9', 'PO10', 'PO11', 'PSO1', 'PSO2', 'PSO3'],
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
  let co_list = ['CO1', 'CO2', 'CO3', 'CO4', 'CO5', 'CO6'];
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

  const po_list = ['PO1', 'PO2', 'PO3', 'PO4', 'PO5', 'PO6', 'PO7', 'PO8', 'PO9', 'PO10', 'PO11', 'PSO1', 'PSO2', 'PSO3'];
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

  let thHtml = '<tr><th style="width: 120px;">Course Outcome</th>';
  currentCOPOState.po_list.forEach(po => {
    thHtml += `<th class="text-center" style="min-width: 55px;">${po}</th>`;
  });
  thHtml += '<th style="width: 50px;">Action</th></tr>';
  thead.innerHTML = thHtml;

  tbody.innerHTML = '';
  currentCOPOState.co_list.forEach((co, rIdx) => {
    const tr = document.createElement('tr');
    tr.id = `copoRow_${rIdx}`;
    let trHtml = `
      <td class="bold">
        <input type="text" class="cell-input bold" data-field="co_name" value="${co}" style="width: 90px;">
      </td>
    `;
    currentCOPOState.po_list.forEach(po => {
      const val = (currentCOPOState.matrix[co] && currentCOPOState.matrix[co][po]) !== undefined ? currentCOPOState.matrix[co][po] : '';
      trHtml += `
        <td class="text-center">
          <input type="number" min="0" max="3" step="1" class="cell-input text-center bold" 
                 data-co="${co}" data-po="${po}" value="${val !== 0 ? val : ''}" placeholder="-">
        </td>
      `;
    });
    trHtml += `
      <td class="text-center">
        <button type="button" class="btn btn-outline btn-sm" style="color:#ef4444;padding:2px 6px;" onclick="removeCORow(${rIdx})">&times;</button>
      </td>
    `;
    tr.innerHTML = trHtml;
    tbody.appendChild(tr);
  });
}

function addPOColumn() {
  const count = currentCOPOState.po_list.length + 1;
  const name = prompt('Enter new Program Outcome name (e.g. PSO3 or PO13):', `PSO${count - 12 > 0 ? count - 12 : count}`);
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
  const rows = document.getElementById('copoMatrixTable').querySelectorAll('tbody tr');
  const matrix = {};
  const co_list = [];

  rows.forEach(tr => {
    const coInp = tr.querySelector('input[data-field="co_name"]');
    const co = coInp ? coInp.value.trim().toUpperCase() : 'CO';
    co_list.push(co);
    matrix[co] = {};

    currentCOPOState.po_list.forEach(po => {
      const inp = tr.querySelector(`input[data-po="${po}"]`);
      const val = inp && inp.value.trim() !== '' ? parseFloat(inp.value.trim()) : 0;
      matrix[co][po] = val;
    });
  });

  return {
    matrix: matrix,
    co_list: co_list,
    po_list: currentCOPOState.po_list
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
  const tbody = document.getElementById('poResultsTable').querySelector('tbody');
  tbody.innerHTML = '';

  document.getElementById('overallPOBadge').textContent =
    `Average PO Attainment: ${data.overall_po_attainment} / 3.00 (${data.overall_po_level})`;

  data.po_results.forEach(p => {
    const tr = document.createElement('tr');
    const attDisp = p.attainment !== null ? p.attainment : '-';
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
      <td class="text-center">${p.weighted_sum}</td>
      <td class="text-center bold" style="color:var(--accent); font-size:14px;">${attDisp}</td>
      <td class="text-center">${levelBadge}</td>
      <td><span style="font-size:12px; color:var(--text-muted);">${contribStr}</span></td>
    `;
    tbody.appendChild(tr);
  });

  renderPOCharts(data.po_results);
}

function renderPOCharts(po_results) {
  const labels = po_results.map(p => p.po);
  const dataVals = po_results.map(p => p.attainment !== null ? p.attainment : 0);

  // Bar Chart
  const ctxBar = document.getElementById('chartPOAttainmentBar');
  if (copoCharts['bar']) copoCharts['bar'].destroy();
  copoCharts['bar'] = new Chart(ctxBar, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'PO Attainment Value (0-3)',
        data: dataVals,
        backgroundColor: '#2563eb',
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

  // Radar / Spider Chart
  const ctxRadar = document.getElementById('chartPOAttainmentRadar');
  if (copoCharts['radar']) copoCharts['radar'].destroy();
  copoCharts['radar'] = new Chart(ctxRadar, {
    type: 'radar',
    data: {
      labels: labels,
      datasets: [{
        label: 'PO Attainment Profile',
        data: dataVals,
        backgroundColor: 'rgba(37, 99, 235, 0.2)',
        borderColor: '#2563eb',
        pointBackgroundColor: '#1e40af',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#1e40af'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: true,
          max: 3.0,
          ticks: { stepSize: 0.5 }
        }
      }
    }
  });
}

// Auto-restore saved matrix if user already calculated or uploaded earlier
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/get-full-state');
    const state = await res.json();
    if (state.copo && state.copo.matrix && Object.keys(state.copo.matrix).length > 0) {
      currentCOPOState.co_list = state.copo.co_list || Object.keys(state.copo.matrix);
      currentCOPOState.po_list = state.copo.po_list || [];
      currentCOPOState.matrix = state.copo.matrix;
      renderMatrixTable();
      document.getElementById('matrixSection').style.display = 'block';
      if (state.copo.po_results && state.copo.po_results.length > 0) {
        renderPOResults(state.copo);
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
