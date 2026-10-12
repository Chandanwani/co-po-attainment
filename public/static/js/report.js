/**
 * Page 4 JavaScript - Final Comprehensive Report & Visualizations
 */

let repCharts = {};

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

async function loadFinalReportData() {
  try {
    const res = await fetch('/api/get-full-state');
    const state = await res.json();
    renderReport(state);
  } catch (err) {
    console.error('Failed to load report data:', err);
  }
}

function renderReport(state) {
  const teacher = state.teacher || {};
  const direct = state.direct || {};
  const indirect = state.indirect || {};
  const weighted = state.weighted || {};
  const copo = state.copo || {};

  // Header display
  if (weighted.overall_attainment !== undefined) {
    document.getElementById('repOverallAtt').textContent =
      `${weighted.overall_attainment} / 3.00 (${weighted.overall_level_label || 'Attained'})`;
    document.getElementById('repWeightDisp').textContent =
      `${weighted.direct_weight}% Direct / ${weighted.indirect_weight}% Indirect`;
  }

  // 1. Weighted CO Attainment Table
  const tbodyWt = document.getElementById('repWeightedTable').querySelector('tbody');
  tbodyWt.innerHTML = '';
  (weighted.combined_results || []).forEach(c => {
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
    tbodyWt.appendChild(tr);
  });

  // 2. Charts for CO Attainment
  renderCOCharts(weighted, direct);

  // 3. CO-PO Correlation Matrix View
  const tableMatrix = document.getElementById('repCOPOMatrixTable');
  const theadMatrix = tableMatrix.querySelector('thead');
  const tbodyMatrix = tableMatrix.querySelector('tbody');
  const po_list = copo.po_list || [];
  const co_list = copo.co_list || [];
  const matrix = copo.matrix || {};

  let thMat = '<tr><th>CO</th>';
  po_list.forEach(po => { thMat += `<th class="text-center" style="font-size:11px;">${po}</th>`; });
  thMat += '</tr>';
  theadMatrix.innerHTML = thMat;

  tbodyMatrix.innerHTML = '';
  co_list.forEach(co => {
    const tr = document.createElement('tr');
    let trHtml = `<td class="bold">${co}</td>`;
    po_list.forEach(po => {
      const val = matrix[co] && matrix[co][po] !== undefined ? matrix[co][po] : 0;
      trHtml += `<td class="text-center ${val > 0 ? 'bold' : ''}">${val > 0 ? val : '-'}</td>`;
    });
    tr.innerHTML = trHtml;
    tbodyMatrix.appendChild(tr);
  });

  // 4. PO Attainment Table
  const tbodyPO = document.getElementById('repPOTable').querySelector('tbody');
  tbodyPO.innerHTML = '';
  if (copo.overall_po_attainment !== undefined) {
    document.getElementById('repOverallPOBadge').textContent =
      `Average PO Attainment: ${copo.overall_po_attainment} / 3.00 (${copo.overall_po_level || 'Attained'})`;
  }
  (copo.po_results || []).forEach(p => {
    const tr = document.createElement('tr');
    const attDisp = p.attainment !== null ? p.attainment : '-';
    const contribStr = (p.contributing_cos || []).map(c => `${c.co} (L${c.level})`).join(', ') || 'None';
    tr.innerHTML = `
      <td class="bold">${p.po}</td>
      <td class="text-center">${p.mapping_sum}</td>
      <td class="text-center">${p.weighted_sum}</td>
      <td class="text-center bold" style="color:var(--accent); font-size:14px;">${attDisp}</td>
      <td class="text-center">${getBadgeHtml(p.level_label)}</td>
      <td><span style="font-size:12px; color:var(--text-muted);">${contribStr}</span></td>
    `;
    tbodyPO.appendChild(tr);
  });

  // 5. PO Charts
  renderPOCharts(copo.po_results || []);

  // 6. Assessment Summaries Table
  const tbodyAss = document.getElementById('repAssessmentTable').querySelector('tbody');
  tbodyAss.innerHTML = '';
  (direct.assessment_summaries || []).forEach(a => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bold">${a.name}</td>
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

  // 7. Student Performance Table & Distribution Charts
  const tbodyStd = document.getElementById('repStudentTable').querySelector('tbody');
  tbodyStd.innerHTML = '';
  (direct.students || []).forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bold">${s.roll_no}</td>
      <td>${s.name}</td>
      <td class="text-center">${s.total_obtained}</td>
      <td class="text-center">${s.total_max}</td>
      <td class="text-center bold">${s.percentage}%</td>
      <td class="text-center">${s.passed_cos.length}</td>
      <td>${s.passed_cos.join(', ') || '<span style="color:#ef4444;">None</span>'}</td>
      <td class="text-center">${s.passed_all ? '<span class="badge badge-level-3">Yes</span>' : '<span class="badge badge-level-0">No</span>'}</td>
    `;
    tbodyStd.appendChild(tr);
  });

  renderStudentCharts(direct);

  // 8. Indirect Survey Summary Table
  const tbodyInd = document.getElementById('repIndirectTable').querySelector('tbody');
  tbodyInd.innerHTML = '';
  (indirect.co_summaries || []).forEach(c => {
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
    tbodyInd.appendChild(tr);
  });
}

function renderCOCharts(weighted, direct) {
  const cos = (weighted.combined_results || []).map(c => c.co);

  // Chart 1: Comparison
  const ctxCO = document.getElementById('repChartCO');
  if (repCharts['co']) repCharts['co'].destroy();
  repCharts['co'] = new Chart(ctxCO, {
    type: 'bar',
    data: {
      labels: cos,
      datasets: [
        {
          label: 'Direct Attainment',
          data: (weighted.combined_results || []).map(c => c.direct_attainment),
          backgroundColor: '#3b82f6',
          borderRadius: 4
        },
        {
          label: 'Indirect Attainment',
          data: (weighted.combined_results || []).map(c => c.indirect_attainment),
          backgroundColor: '#10b981',
          borderRadius: 4
        },
        {
          label: 'Combined Attainment',
          data: (weighted.combined_results || []).map(c => c.combined_attainment),
          backgroundColor: '#1e293b',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, max: 3.0, ticks: { stepSize: 0.5 } } }
    }
  });

  // Chart 2: Students Passing Each CO (%)
  const ctxPass = document.getElementById('repChartCOPass');
  if (repCharts['coPass']) repCharts['coPass'].destroy();
  repCharts['coPass'] = new Chart(ctxPass, {
    type: 'bar',
    data: {
      labels: (direct.co_summaries || []).map(c => c.co),
      datasets: [{
        label: 'Students Passed (%)',
        data: (direct.co_summaries || []).map(c => c.pass_percentage),
        backgroundColor: '#6366f1',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, max: 100 } }
    }
  });
}

function renderPOCharts(po_results) {
  const labels = po_results.map(p => p.po);
  const dataVals = po_results.map(p => p.attainment !== null ? p.attainment : 0);

  const ctxBar = document.getElementById('repChartPOBar');
  if (repCharts['poBar']) repCharts['poBar'].destroy();
  repCharts['poBar'] = new Chart(ctxBar, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'PO Attainment (0-3)',
        data: dataVals,
        backgroundColor: '#2563eb',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, max: 3.0, ticks: { stepSize: 0.5 } } }
    }
  });

  const ctxRadar = document.getElementById('repChartPORadar');
  if (repCharts['poRadar']) repCharts['poRadar'].destroy();
  repCharts['poRadar'] = new Chart(ctxRadar, {
    type: 'radar',
    data: {
      labels: labels,
      datasets: [{
        label: 'PO Attainment Profile',
        data: dataVals,
        backgroundColor: 'rgba(37, 99, 235, 0.2)',
        borderColor: '#2563eb',
        pointBackgroundColor: '#1e40af'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { r: { beginAtZero: true, max: 3.0, ticks: { stepSize: 0.5 } } }
    }
  });
}

function renderStudentCharts(direct) {
  const ranges = direct.score_ranges || {};
  const ctxDist = document.getElementById('repChartStudentDist');
  if (repCharts['dist']) repCharts['dist'].destroy();
  repCharts['dist'] = new Chart(ctxDist, {
    type: 'bar',
    data: {
      labels: Object.keys(ranges),
      datasets: [{
        label: 'Students Count',
        data: Object.values(ranges),
        backgroundColor: ['#059669', '#2563eb', '#f59e0b', '#f97316', '#ef4444'],
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });

  const ctxAss = document.getElementById('repChartAssessPass');
  if (repCharts['assess']) repCharts['assess'].destroy();
  repCharts['assess'] = new Chart(ctxAss, {
    type: 'bar',
    data: {
      labels: (direct.assessment_summaries || []).map(a => a.name),
      datasets: [{
        label: 'Pass Percentage (%)',
        data: (direct.assessment_summaries || []).map(a => a.pass_pct),
        backgroundColor: '#0ea5e9',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, max: 100 } }
    }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  loadFinalReportData();
});

// PDF Download Modal Controls
function openPdfModal() {
  const modal = document.getElementById('pdfDownloadModal');
  if (modal) modal.style.display = 'flex';
}

function closePdfModal() {
  const modal = document.getElementById('pdfDownloadModal');
  if (modal) modal.style.display = 'none';
}

function proceedPdfDownload() {
  const opts = document.getElementsByName('pdfChartOption');
  let charts = '1';
  for (let r of opts) {
    if (r.checked) {
      charts = r.value;
      break;
    }
  }
  closePdfModal();
  window.location.href = `/download/pdf-report?charts=${charts}`;
}
