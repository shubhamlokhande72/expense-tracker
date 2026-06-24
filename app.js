/* 
   SpendSmart – app.js
   All data stored in localStorage under key "spendsmart_txns"
   */

//  STATE 
const STORAGE_KEY = 'spendsmart_txns';
let transactions = [];
let editingId    = null;
let currentType  = 'expense';

// For analytics month navigation
let analyticsDate = new Date();

// Chart instances (keep refs to destroy before redraw)
let barChartInst = null, pieChartInst = null;
let lineChartInst = null, doughnutInst = null;

//  CATEGORY EMOJI MAP
const CAT_EMOJI = {
  Food: '🍔', Transport: '🚌', Shopping: '🛍',
  Entertainment: '🎬', Health: '💊', Education: '📚',
  Salary: '💼', Freelance: '💻', Other: '📦'
};

// STORAGE
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    transactions = raw ? JSON.parse(raw) : [];
  } catch {
    transactions = [];
  }
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

//  HELPERS 
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatCurrency(n) {
  return '₹' + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getMonthKey(dateStr) {
  return dateStr.slice(0, 7); // "YYYY-MM"
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
  const [y, m] = key.split('-');
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

// TOAST 
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

//  NAVIGATION
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const view = btn.dataset.view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + view).classList.add('active');

    if (view === 'transactions') renderAllList();
    if (view === 'analytics')    renderAnalytics();
  });
});

//  MODAL
function openModal(id = null) {
  editingId = id;
  const overlay = document.getElementById('modalOverlay');
  const title   = document.getElementById('modal-title');

  clearErrors();

  if (id) {
    // Edit mode: populate fields
    const tx = transactions.find(t => t.id === id);
    title.textContent = 'Edit Transaction';
    document.getElementById('f-desc').value     = tx.description;
    document.getElementById('f-amount').value   = tx.amount;
    document.getElementById('f-date').value     = tx.date;
    document.getElementById('f-category').value = tx.category;
    document.getElementById('f-note').value     = tx.note || '';
    setType(tx.type);
  } else {
    // Add mode: reset fields
    title.textContent = 'Add Transaction';
    document.getElementById('f-desc').value     = '';
    document.getElementById('f-amount').value   = '';
    document.getElementById('f-date').value     = new Date().toISOString().split('T')[0];
    document.getElementById('f-category').value = '';
    document.getElementById('f-note').value     = '';
    setType('expense');
  }

  overlay.classList.add('open');
  document.getElementById('f-desc').focus();
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  editingId = null;
}

document.getElementById('openModal').addEventListener('click',  () => openModal());
document.getElementById('openModal2').addEventListener('click', () => openModal());
document.getElementById('closeModal').addEventListener('click',  closeModal);
document.getElementById('cancelModal').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

//  TYPE TOGGLE 
function setType(type) {
  currentType = type;
  document.querySelectorAll('.type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === type);
  });
}

document.querySelectorAll('.type-btn').forEach(btn => {
  btn.addEventListener('click', () => setType(btn.dataset.type));
});

//  FORM VALIDATION 
function clearErrors() {
  ['desc', 'amount', 'date', 'category'].forEach(f => {
    document.getElementById('err-' + f).textContent = '';
  });
}

function validateForm() {
  let valid = true;
  clearErrors();

  const desc     = document.getElementById('f-desc').value.trim();
  const amount   = parseFloat(document.getElementById('f-amount').value);
  const date     = document.getElementById('f-date').value;
  const category = document.getElementById('f-category').value;

  if (!desc) {
    document.getElementById('err-desc').textContent = 'Description is required.';
    valid = false;
  }
  if (!document.getElementById('f-amount').value || isNaN(amount) || amount <= 0) {
    document.getElementById('err-amount').textContent = 'Enter a valid positive amount.';
    valid = false;
  }
  if (!date) {
    document.getElementById('err-date').textContent = 'Please pick a date.';
    valid = false;
  }
  if (!category) {
    document.getElementById('err-category').textContent = 'Select a category.';
    valid = false;
  }
  return valid;
}

//  SAVE TRANSACTION 
document.getElementById('saveTransaction').addEventListener('click', () => {
  if (!validateForm()) return;

  const tx = {
    id:          editingId || generateId(),
    description: document.getElementById('f-desc').value.trim(),
    amount:      parseFloat(parseFloat(document.getElementById('f-amount').value).toFixed(2)),
    date:        document.getElementById('f-date').value,
    category:    document.getElementById('f-category').value,
    note:        document.getElementById('f-note').value.trim(),
    type:        currentType
  };

  if (editingId) {
    const idx = transactions.findIndex(t => t.id === editingId);
    transactions[idx] = tx;
    showToast('Transaction updated!');
  } else {
    transactions.unshift(tx);
    showToast('Transaction added!');
  }

  saveToStorage();
  closeModal();
  renderDashboard();
  // if transactions view is visible, refresh it
  if (document.getElementById('view-transactions').classList.contains('active')) {
    renderAllList();
  }
});

// DELETE 
function deleteTransaction(id) {
  if (!confirm('Delete this transaction?')) return;
  transactions = transactions.filter(t => t.id !== id);
  saveToStorage();
  renderDashboard();
  renderAllList();
  showToast('Transaction deleted.');
}

//  BUILD TX LIST ITEM 
function buildTxItem(tx) {
  const li = document.createElement('li');
  li.className = 'tx-item';
  li.innerHTML = `
    <div class="tx-icon ${tx.type}">${CAT_EMOJI[tx.category] || '📦'}</div>
    <div class="tx-info">
      <div class="tx-desc">${escapeHtml(tx.description)}</div>
      <div class="tx-meta">${tx.category} · ${formatDate(tx.date)}${tx.note ? ' · ' + escapeHtml(tx.note) : ''}</div>
    </div>
    <span class="tx-amount ${tx.type}">${tx.type === 'income' ? '+' : '-'}${formatCurrency(tx.amount)}</span>
    <div class="tx-actions">
      <button class="icon-btn edit" title="Edit" onclick="openModal('${tx.id}')">
        <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="icon-btn delete" title="Delete" onclick="deleteTransaction('${tx.id}')">
        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>
  `;
  return li;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// DASHBOARD 
function renderDashboard() {
  const mk = currentMonthKey();
  document.getElementById('month-label').textContent = monthLabel(mk);

  const monthly = transactions.filter(t => getMonthKey(t.date) === mk);

  const income  = monthly.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = monthly.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  document.getElementById('total-income').textContent  = formatCurrency(income);
  document.getElementById('total-expense').textContent = formatCurrency(expense);
  const balEl = document.getElementById('net-balance');
  balEl.textContent = formatCurrency(balance);
  balEl.style.color = balance >= 0 ? 'var(--income)' : 'var(--expense)';

  // Recent 5
  const recentList  = document.getElementById('recent-list');
  const recentEmpty = document.getElementById('recent-empty');
  recentList.innerHTML = '';
  const recent = [...transactions].slice(0, 5);
  if (recent.length === 0) {
    recentEmpty.style.display = 'block';
  } else {
    recentEmpty.style.display = 'none';
    recent.forEach(tx => recentList.appendChild(buildTxItem(tx)));
  }

  renderBarChart(income, expense);
  renderPieChart(monthly);
}

function renderBarChart(income, expense) {
  const ctx = document.getElementById('barChart').getContext('2d');
  if (barChartInst) barChartInst.destroy();
  barChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Income', 'Expense'],
      datasets: [{
        data: [income, expense],
        backgroundColor: ['rgba(34,197,94,.3)', 'rgba(244,63,94,.3)'],
        borderColor:     ['#22c55e', '#f43f5e'],
        borderWidth: 2, borderRadius: 8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#2e3250' }, ticks: { color: '#6b7280' } },
        y: { grid: { color: '#2e3250' }, ticks: { color: '#6b7280', callback: v => '₹' + v.toLocaleString('en-IN') } }
      }
    }
  });
}

function renderPieChart(monthly) {
  const ctx = document.getElementById('pieChart').getContext('2d');
  if (pieChartInst) pieChartInst.destroy();

  const expenses = monthly.filter(t => t.type === 'expense');
  const catMap = {};
  expenses.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
  const labels = Object.keys(catMap);
  const data   = Object.values(catMap);

  const colors = ['#6c63ff','#f43f5e','#22c55e','#f59e0b','#3b82f6','#ec4899','#14b8a6','#8b5cf6','#f97316'];

  pieChartInst = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#6b7280', font: { size: 11 }, padding: 12, boxWidth: 12 } }
      }
    }
  });
}

//  ALL TRANSACTIONS VIEW
function renderAllList() {
  const search   = document.getElementById('searchInput').value.trim().toLowerCase();
  const type     = document.getElementById('filterType').value;
  const category = document.getElementById('filterCategory').value;
  const month    = document.getElementById('filterMonth').value;

  let filtered = transactions.filter(t => {
    if (search && !t.description.toLowerCase().includes(search) && !t.category.toLowerCase().includes(search)) return false;
    if (type !== 'all' && t.type !== type) return false;
    if (category !== 'all' && t.category !== category) return false;
    if (month && getMonthKey(t.date) !== month) return false;
    return true;
  });

  // Sort by date descending
  filtered.sort((a, b) => b.date.localeCompare(a.date));

  const list  = document.getElementById('all-list');
  const empty = document.getElementById('all-empty');
  list.innerHTML = '';

  if (filtered.length === 0) {
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    filtered.forEach(tx => list.appendChild(buildTxItem(tx)));
  }
}

['searchInput', 'filterType', 'filterCategory', 'filterMonth'].forEach(id => {
  document.getElementById(id).addEventListener('input', renderAllList);
});

//  ANALYTICS 
function renderAnalytics() {
  const year  = analyticsDate.getFullYear();
  const month = analyticsDate.getMonth();
  const mk    = `${year}-${String(month + 1).padStart(2, '0')}`;
  document.getElementById('analyticsMonthLabel').textContent = monthLabel(mk);

  const monthly = transactions.filter(t => getMonthKey(t.date) === mk);

  renderLineChart(monthly, year, month);
  renderDoughnutChart(monthly);
  renderCategoryBars(monthly);
}

function renderLineChart(monthly, year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dailyExpense = Array(daysInMonth).fill(0);

  monthly.filter(t => t.type === 'expense').forEach(t => {
    const day = parseInt(t.date.split('-')[2]) - 1;
    dailyExpense[day] += t.amount;
  });

  const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const ctx = document.getElementById('lineChart').getContext('2d');
  if (lineChartInst) lineChartInst.destroy();

  lineChartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Daily Expense',
        data: dailyExpense,
        borderColor: '#f43f5e',
        backgroundColor: 'rgba(244,63,94,.1)',
        tension: 0.4, fill: true, pointRadius: 3
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#2e3250' }, ticks: { color: '#6b7280' } },
        y: { grid: { color: '#2e3250' }, ticks: { color: '#6b7280', callback: v => '₹' + v } }
      }
    }
  });
}

function renderDoughnutChart(monthly) {
  const ctx = document.getElementById('doughnutChart').getContext('2d');
  if (doughnutInst) doughnutInst.destroy();

  const expenses = monthly.filter(t => t.type === 'expense');
  const catMap = {};
  expenses.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
  const labels = Object.keys(catMap);
  const data   = Object.values(catMap);
  const colors = ['#6c63ff','#f43f5e','#22c55e','#f59e0b','#3b82f6','#ec4899','#14b8a6','#8b5cf6','#f97316'];

  doughnutInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }]
    },
    options: {
      responsive: true, maintainAspectRatio: true, cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#6b7280', font: { size: 11 }, padding: 10, boxWidth: 10 } }
      }
    }
  });
}

function renderCategoryBars(monthly) {
  const expenses = monthly.filter(t => t.type === 'expense');
  const catMap = {};
  expenses.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });

  const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const max    = sorted[0]?.[1] || 1;

  const container = document.getElementById('categoryBars');
  container.innerHTML = '';

  if (sorted.length === 0) {
    container.innerHTML = '<p class="empty-msg" style="padding:20px 0">No expense data this month.</p>';
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'cat-bar-row';

  sorted.forEach(([cat, amt]) => {
    const pct = Math.round((amt / max) * 100);
    wrap.innerHTML += `
      <div class="cat-bar-item">
        <div class="cat-bar-label">
          <span>${CAT_EMOJI[cat] || ''} ${cat}</span>
          <span>${formatCurrency(amt)}</span>
        </div>
        <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${pct}%"></div></div>
      </div>
    `;
  });

  container.appendChild(wrap);
}

document.getElementById('prevMonth').addEventListener('click', () => {
  analyticsDate.setMonth(analyticsDate.getMonth() - 1);
  renderAnalytics();
});
document.getElementById('nextMonth').addEventListener('click', () => {
  analyticsDate.setMonth(analyticsDate.getMonth() + 1);
  renderAnalytics();
});

// CSV EXPORT
document.getElementById('exportCSV').addEventListener('click', () => {
  if (transactions.length === 0) { showToast('No transactions to export.'); return; }

  const headers = ['Date', 'Description', 'Category', 'Type', 'Amount (₹)', 'Note'];
  const rows = transactions.map(t => [
    t.date, `"${t.description}"`, t.category, t.type,
    t.type === 'income' ? t.amount : -t.amount,
    `"${t.note || ''}"`
  ]);

  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `spendsmart_export_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported!');
});

// KEYBOARD SHORTCUT 
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('modalOverlay').classList.contains('open')) {
    closeModal();
  }
});

// INIT
loadFromStorage();
renderDashboard();
