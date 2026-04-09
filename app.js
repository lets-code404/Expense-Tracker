/* ════════════════════════════════════════════════════════
   ExpenseFlow — Application Logic
   Data store · Charts · Chatbox · CSV/JSON Import
   ════════════════════════════════════════════════════════ */

;(function () {
  'use strict';

  // ─── CONSTANTS ────────────────────────────────────────
  const STORAGE_KEY = 'expenseflow_data';
  const GOAL_KEY    = 'expenseflow_goal';
  const CURRENCY    = '₹';

  // Color palette for charts
  const PALETTE = [
    '#a855f7', '#22d3ee', '#f472b6', '#facc15', '#34d399',
    '#fb923c', '#818cf8', '#f87171', '#38bdf8', '#a3e635',
    '#e879f9', '#fbbf24', '#2dd4bf', '#c084fc', '#f97316',
  ];

  // ─── DOM REFS ─────────────────────────────────────────
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const elValToday  = $('#val-today');
  const elValWeek   = $('#val-week');
  const elValMonth  = $('#val-month');
  const elValTotal  = $('#val-total');
  const elValGoal   = $('#val-goal');
  const elGoalWrap  = $('#goal-progress-wrap');
  const elGoalBar   = $('#goal-progress-bar');
  const elGoalAlert = $('#goal-alert');
  const elGoalAlertTitle = $('#goal-alert-title');
  const elGoalAlertText  = $('#goal-alert-text');

  const elTxnBody   = $('#txn-body');
  const elTxnEmpty  = $('#txn-empty');
  const elSearchTxn = $('#search-txn');
  const elChatMsgs  = $('#chat-messages');
  const elChatForm  = $('#chat-form');
  const elChatInput = $('#chat-input');

  // Goal modal
  const elBtnGoal    = $('#btn-goal');
  const elGoalModal  = $('#goal-modal');
  const elGoalClose  = $('#goal-modal-close');
  const elGoalForm   = $('#goal-form');
  const elGoalInput  = $('#goal-input');

  // Import modal
  const elModal       = $('#import-modal');
  const elModalClose  = $('#modal-close');
  const elBtnImport   = $('#btn-import');
  const elDropZone    = $('#file-drop-zone');
  const elFileInput   = $('#file-input');
  const elPreview     = $('#import-preview');
  const elBtnConfirm  = $('#btn-import-confirm');

  const elBtnDemo  = $('#btn-demo');
  const elBtnClear = $('#btn-clear');

  // ─── DATA LAYER ───────────────────────────────────────
  let expenses = loadData();
  let pendingImport = [];
  let monthlyGoal = loadGoal();

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  }

  function loadGoal() {
    const r = localStorage.getItem(GOAL_KEY);
    return r ? parseFloat(r) : 0;
  }

  function saveGoal() {
    localStorage.setItem(GOAL_KEY, monthlyGoal);
  }

  function addExpense(entry) {
    // Ensure required fields
    const item = {
      id:          entry.id || crypto.randomUUID(),
      date:        entry.date || todayStr(),
      description: entry.description || 'Expense',
      amount:      Math.abs(parseFloat(entry.amount)) || 0,
      payee:       entry.payee || 'Unknown',
      source:      entry.source || 'manual',  // manual | import | chat
    };
    expenses.unshift(item);
    saveData();
    refreshAll();
    return item;
  }

  function deleteExpense(id) {
    expenses = expenses.filter(e => e.id !== id);
    saveData();
    refreshAll();
  }

  // ─── UTILITIES ────────────────────────────────────────
  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function dateDaysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  function formatCurrency(n) {
    return CURRENCY + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  function formatDate(ds) {
    const d = new Date(ds + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  function dayLabel(ds) {
    const d = new Date(ds + 'T00:00:00');
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    return days[d.getDay()] + ' ' + d.getDate();
  }

  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  // ─── STATS ────────────────────────────────────────────
  function updateStats() {
    const today = todayStr();
    const weekAgo  = dateDaysAgo(6);
    const monthAgo = dateDaysAgo(29);

    let sumToday = 0, sumWeek = 0, sumMonth = 0;
    for (const e of expenses) {
      if (e.date === today)       sumToday += e.amount;
      if (e.date >= weekAgo)      sumWeek  += e.amount;
      if (e.date >= monthAgo)     sumMonth += e.amount;
    }
    elValToday.textContent = formatCurrency(sumToday);
    elValWeek.textContent  = formatCurrency(sumWeek);
    elValMonth.textContent = formatCurrency(sumMonth);
    elValTotal.textContent = expenses.length;
    
    updateGoalStatus(sumMonth);
  }

  function updateGoalStatus(sumMonth) {
    if (!monthlyGoal || monthlyGoal <= 0) {
      elValGoal.textContent = 'Not Set';
      elGoalWrap.classList.add('hidden');
      elGoalAlert.classList.add('hidden');
      return;
    }
    elValGoal.textContent = formatCurrency(monthlyGoal);
    elGoalWrap.classList.remove('hidden');

    const pct = Math.min((sumMonth / monthlyGoal) * 100, 100);
    elGoalBar.style.width = pct + '%';

    // Status colors: <80% success, 80-99% warning, >=100% danger
    let color = 'var(--success)';
    if (pct >= 100) color = 'var(--danger)';
    else if (pct >= 80) color = '#fbbf24'; // warning yellow
    elGoalBar.style.background = color;

    if (sumMonth >= monthlyGoal) {
      elGoalAlert.classList.remove('hidden');
      elGoalAlert.style.borderColor = 'var(--danger)';
      elGoalAlert.style.background = 'rgba(239,68,68,.15)';
      elGoalAlert.style.color = '#f87171';
      elGoalAlertTitle.textContent = 'Budget Exceeded!';
      elGoalAlertText.textContent = `You have exceeded your monthly goal of ${formatCurrency(monthlyGoal)} by ${formatCurrency(sumMonth - monthlyGoal)}.`;
    } else if (sumMonth >= 0.8 * monthlyGoal) {
      elGoalAlert.classList.remove('hidden');
      elGoalAlert.style.borderColor = '#fbbf24';
      elGoalAlert.style.background = 'rgba(251,191,36,.15)';
      elGoalAlert.style.color = '#fcd34d';
      elGoalAlertTitle.textContent = 'Budget Warning';
      elGoalAlertText.textContent = `You have spent ${pct.toFixed(1)}% of your monthly goal. Approaching limit!`;
    } else {
      elGoalAlert.classList.add('hidden');
    }
  }

  // ─── TRANSACTION LIST ─────────────────────────────────
  function renderTransactions(filter = '') {
    const lowerFilter = filter.toLowerCase();
    const filtered = filter
      ? expenses.filter(e =>
          e.description.toLowerCase().includes(lowerFilter) ||
          e.payee.toLowerCase().includes(lowerFilter) ||
          e.date.includes(lowerFilter))
      : expenses;

    if (filtered.length === 0) {
      elTxnBody.innerHTML = '';
      elTxnEmpty.classList.remove('hidden');
      return;
    }
    elTxnEmpty.classList.add('hidden');

    elTxnBody.innerHTML = filtered.slice(0, 100).map(e => `
      <tr data-id="${e.id}">
        <td>${formatDate(e.date)}</td>
        <td>${escHtml(e.description)}</td>
        <td>${escHtml(e.payee)}</td>
        <td class="col-amount">${formatCurrency(e.amount)}</td>
        <td class="col-action"><button class="btn-delete" title="Delete">&times;</button></td>
      </tr>
    `).join('');
  }

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  elTxnBody.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.btn-delete');
    if (!btn) return;
    const id = btn.closest('tr').dataset.id;
    deleteExpense(id);
    toast('Transaction deleted');
  });

  elSearchTxn.addEventListener('input', () => {
    renderTransactions(elSearchTxn.value);
  });

  // ─── CHARTS ───────────────────────────────────────────
  let chartWeek, chartMonth, chartPie;

  function buildCharts() {
    chartWeek  = createBarChart('chart-week',  7);
    chartMonth = createBarChart('chart-month', 30);
    chartPie   = createPieChart('chart-pie');
  }

  function updateCharts() {
    updateBarChart(chartWeek,  7);
    updateBarChart(chartMonth, 30);
    updatePieChart(chartPie);
  }

  function createBarChart(canvasId, days) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    const { labels, data } = barData(days);

    return new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Spending',
          data,
          backgroundColor: days === 7
            ? 'rgba(168, 85, 247, 0.6)'
            : 'rgba(34, 211, 238, 0.5)',
          borderColor: days === 7 ? '#a855f7' : '#22d3ee',
          borderWidth: 1.5,
          borderRadius: 6,
          hoverBackgroundColor: days === 7
            ? 'rgba(168, 85, 247, 0.85)'
            : 'rgba(34, 211, 238, 0.8)',
        }],
      },
      options: barOptions(),
    });
  }

  function barData(days) {
    const map = {};
    for (let i = days - 1; i >= 0; i--) {
      const key = dateDaysAgo(i);
      map[key] = 0;
    }
    for (const e of expenses) {
      if (map[e.date] !== undefined) map[e.date] += e.amount;
    }
    const labels = Object.keys(map).map(d => days <= 7 ? dayLabel(d) : formatDate(d));
    const data   = Object.values(map);
    return { labels, data };
  }

  function barOptions() {
    return {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(22,27,45,.92)',
          borderColor: 'rgba(255,255,255,.1)',
          borderWidth: 1,
          titleFont: { family: 'Inter' },
          bodyFont: { family: 'Inter' },
          callbacks: { label: c => formatCurrency(c.parsed.y) },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,.04)' },
          ticks: { color: '#94a3b8', font: { family: 'Inter', size: 12 }, maxRotation: 45 },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,.06)' },
          ticks: {
            color: '#94a3b8',
            font: { family: 'Inter', size: 12 },
            callback: v => CURRENCY + v.toLocaleString('en-IN'),
          },
        },
      },
    };
  }

  function updateBarChart(chart, days) {
    const { labels, data } = barData(days);
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update();
  }

  // ── PIE ──
  function createPieChart(canvasId) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    const { labels, data } = pieData();

    return new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: PALETTE,
          borderColor: '#0b0e17',
          borderWidth: 2,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '55%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#94a3b8', font: { family: 'Inter', size: 13 }, padding: 14, usePointStyle: true, pointStyleWidth: 10 },
          },
          tooltip: {
            backgroundColor: 'rgba(22,27,45,.92)',
            borderColor: 'rgba(255,255,255,.1)',
            borderWidth: 1,
            titleFont: { family: 'Inter' },
            bodyFont: { family: 'Inter' },
            callbacks: { label: c => ` ${c.label}: ${formatCurrency(c.parsed)}` },
          },
        },
      },
    });
  }

  function pieData() {
    const map = {};
    for (const e of expenses) {
      const key = e.payee || 'Unknown';
      map[key] = (map[key] || 0) + e.amount;
    }
    // Sort descending, keep top 12, group rest as "Others"
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 12);
    const rest = sorted.slice(12).reduce((s, e) => s + e[1], 0);
    if (rest > 0) top.push(['Others', rest]);
    return {
      labels: top.map(e => e[0]),
      data:   top.map(e => e[1]),
    };
  }

  function updatePieChart(chart) {
    const { labels, data } = pieData();
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update();
  }

  // ─── CHATBOX ──────────────────────────────────────────
  function appendChatBubble(text, type = 'bot') {
    const div = document.createElement('div');
    div.className = `chat-bubble ${type}`;
    div.innerHTML = `<p>${text}</p>`;
    elChatMsgs.appendChild(div);
    elChatMsgs.scrollTop = elChatMsgs.scrollHeight;
  }

  function parseExpenseMessage(msg) {
    // Patterns we support:
    //  "Paid 200 to tea shop"
    //  "tea shop 200"
    //  "Lunch 350 at Dominos"
    //  "Auto rickshaw 80"
    //  "Groceries 1500 BigBazaar"
    //  "500 electricity bill"

    const text = msg.trim();
    if (!text) return null;

    // Try: <description> <amount> [to|at|@|for] <payee>
    let m = text.match(/^(.+?)\s+([\d,]+(?:\.\d+)?)\s+(?:to|at|@|for)\s+(.+)$/i);
    if (m) return { description: m[1].trim(), amount: m[2].replace(/,/g,''), payee: m[3].trim() };

    // Try: paid|spent <amount> [to|at|@|for] <payee> [for|on] <desc>
    m = text.match(/^(?:paid|spent)\s+([\d,]+(?:\.\d+)?)\s+(?:to|at|@|for)\s+(.+?)(?:\s+(?:for|on)\s+(.+))?$/i);
    if (m) return { description: m[3] ? m[3].trim() : m[2].trim(), amount: m[1].replace(/,/g,''), payee: m[2].trim() };

    // Try: paid|spent <amount> <description>
    m = text.match(/^(?:paid|spent)\s+([\d,]+(?:\.\d+)?)\s+(.+)$/i);
    if (m) return { description: m[2].trim(), amount: m[1].replace(/,/g,''), payee: m[2].trim() };

    // Try: <description> <amount> <payee>
    m = text.match(/^(.+?)\s+([\d,]+(?:\.\d+)?)\s+(.+)$/i);
    if (m) return { description: m[1].trim(), amount: m[2].replace(/,/g,''), payee: m[3].trim() };

    // Try: <amount> <description>
    m = text.match(/^([\d,]+(?:\.\d+)?)\s+(.+)$/i);
    if (m) return { description: m[2].trim(), amount: m[1].replace(/,/g,''), payee: m[2].trim() };

    // Try: <description> <amount>
    m = text.match(/^(.+?)\s+([\d,]+(?:\.\d+)?)$/i);
    if (m) return { description: m[1].trim(), amount: m[2].replace(/,/g,''), payee: m[1].trim() };

    return null;
  }

  elChatForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const msg = elChatInput.value.trim();
    if (!msg) return;

    appendChatBubble(escHtml(msg), 'user');
    elChatInput.value = '';

    const parsed = parseExpenseMessage(msg);
    if (parsed && parsed.amount > 0) {
      const item = addExpense({
        description: capitalize(parsed.description),
        amount: parsed.amount,
        payee: capitalize(parsed.payee),
        source: 'chat',
      });
      appendChatBubble(
        `✅ Logged <strong>${formatCurrency(item.amount)}</strong> → <em>${escHtml(item.payee)}</em><br/>
         <small style="color:#64748b">${escHtml(item.description)} · ${formatDate(item.date)}</small>`
      );
      toast('Expense added via chat');
    } else {
      appendChatBubble(
        `😕 I couldn't understand that. Try something like:<br/>
         <em>"Paid 200 to tea shop"</em> or <em>"Lunch 350 at Dominos"</em>`
      );
    }
  });

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ─── IMPORT ───────────────────────────────────────────
  elBtnImport.addEventListener('click', () => {
    elModal.classList.remove('hidden');
    pendingImport = [];
    elPreview.classList.add('hidden');
    elPreview.innerHTML = '';
    elBtnConfirm.disabled = true;
    elFileInput.value = '';
  });
  elModalClose.addEventListener('click', () => elModal.classList.add('hidden'));
  elModal.addEventListener('click', (ev) => { if (ev.target === elModal) elModal.classList.add('hidden'); });

  // Drag-and-drop
  elDropZone.addEventListener('dragover', (ev) => { ev.preventDefault(); elDropZone.classList.add('drag-over'); });
  elDropZone.addEventListener('dragleave', () => elDropZone.classList.remove('drag-over'));
  elDropZone.addEventListener('drop', (ev) => {
    ev.preventDefault();
    elDropZone.classList.remove('drag-over');
    if (ev.dataTransfer.files.length) handleFile(ev.dataTransfer.files[0]);
  });
  elDropZone.addEventListener('click', () => elFileInput.click());
  elFileInput.addEventListener('change', () => {
    if (elFileInput.files.length) handleFile(elFileInput.files[0]);
  });

  function handleFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (ext === 'json') {
          pendingImport = parseJSON(reader.result);
        } else {
          pendingImport = parseCSV(reader.result);
        }
        showPreview(pendingImport);
      } catch (err) {
        elPreview.classList.remove('hidden');
        elPreview.innerHTML = `<p style="color:var(--danger)">Error parsing file: ${escHtml(err.message)}</p>`;
        elBtnConfirm.disabled = true;
      }
    };
    reader.readAsText(file);
  }

  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) throw new Error('CSV must have a header row + data rows.');
    // Auto-detect delimiter
    const delim = lines[0].includes('\t') ? '\t' : ',';
    const header = lines[0].split(delim).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    const iDate = header.findIndex(h => /date/.test(h));
    const iDesc = header.findIndex(h => /desc|narr|detail|remark|note/i.test(h));
    const iAmt  = header.findIndex(h => /amount|amt|value|debit/i.test(h));
    const iPay  = header.findIndex(h => /payee|to|recipient|account|beneficiary|party/i.test(h));

    if (iAmt === -1) throw new Error('Could not find an "amount" column in CSV header.');

    const results = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delim).map(c => c.trim().replace(/^['"]|['"]$/g, ''));
      const amt = parseFloat((cols[iAmt] || '0').replace(/[^0-9.\-]/g, ''));
      if (!amt || amt <= 0) continue;
      results.push({
        date:        normalizeDate(cols[iDate] || todayStr()),
        description: cols[iDesc >= 0 ? iDesc : (iDate >= 0 ? iDate : 0)] || 'Imported',
        amount:      amt,
        payee:       cols[iPay >= 0 ? iPay : (iDesc >= 0 ? iDesc : 0)] || 'Unknown',
        source:      'import',
      });
    }
    if (!results.length) throw new Error('No valid expense rows found.');
    return results;
  }

  function parseJSON(text) {
    const data = JSON.parse(text);
    const arr = Array.isArray(data) ? data : (data.transactions || data.expenses || data.data || [data]);
    if (!arr.length) throw new Error('No transaction data found in JSON.');
    return arr.map(e => ({
      date:        normalizeDate(e.date || e.Date || e.transaction_date || todayStr()),
      description: e.description || e.Description || e.narration || e.note || 'Imported',
      amount:      Math.abs(parseFloat(e.amount || e.Amount || e.value || 0)),
      payee:       e.payee || e.Payee || e.to || e.recipient || e.merchant || 'Unknown',
      source:      'import',
    })).filter(e => e.amount > 0);
  }

  function normalizeDate(raw) {
    // Handle common formats: DD/MM/YYYY, DD-MM-YYYY, MM/DD/YYYY, YYYY-MM-DD
    if (!raw) return todayStr();
    let d;
    // Try ISO first
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      d = new Date(raw);
    } else {
      const parts = raw.split(/[\/-]/);
      if (parts.length === 3) {
        let [a, b, c] = parts.map(Number);
        if (a > 31) { d = new Date(a, b - 1, c); }      // YYYY/MM/DD
        else if (c > 31) {
          // DD/MM/YYYY or MM/DD/YYYY — assume DD/MM/YYYY
          d = new Date(c, b - 1, a);
        } else { d = new Date(2026, b - 1, a); }
      }
    }
    if (!d || isNaN(d.getTime())) return todayStr();
    return d.toISOString().slice(0, 10);
  }

  function showPreview(items) {
    elPreview.classList.remove('hidden');
    elPreview.innerHTML = `
      <p style="margin-bottom:8px;color:var(--success)">Found <strong>${items.length}</strong> transactions:</p>
      <table>
        <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Payee</th></tr></thead>
        <tbody>
          ${items.slice(0, 8).map(e => `
            <tr>
              <td>${formatDate(e.date)}</td>
              <td>${escHtml(e.description).slice(0, 30)}</td>
              <td>${formatCurrency(e.amount)}</td>
              <td>${escHtml(e.payee).slice(0, 20)}</td>
            </tr>`).join('')}
          ${items.length > 8 ? `<tr><td colspan="4" style="color:var(--text-muted)">…and ${items.length - 8} more</td></tr>` : ''}
        </tbody>
      </table>`;
    elBtnConfirm.disabled = false;
  }

  elBtnConfirm.addEventListener('click', () => {
    for (const item of pendingImport) addExpense(item);
    toast(`Imported ${pendingImport.length} transactions`);
    pendingImport = [];
    elModal.classList.add('hidden');
  });

  // ─── GOAL ─────────────────────────────────────────────
  elBtnGoal.addEventListener('click', () => {
    elGoalInput.value = monthlyGoal > 0 ? monthlyGoal : '';
    elGoalModal.classList.remove('hidden');
  });
  elGoalClose.addEventListener('click', () => elGoalModal.classList.add('hidden'));
  elGoalModal.addEventListener('click', (ev) => { if (ev.target === elGoalModal) elGoalModal.classList.add('hidden'); });

  elGoalForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const val = parseFloat(elGoalInput.value);
    monthlyGoal = !isNaN(val) && val > 0 ? val : 0;
    saveGoal();
    updateStats(); // updates the goal UI
    elGoalModal.classList.add('hidden');
    toast(monthlyGoal > 0 ? 'Monthly goal updated' : 'Monthly goal removed');
  });

  // ─── DEMO DATA ────────────────────────────────────────
  function generateDemoData() {
    const payees = [
      'Amazon', 'Swiggy', 'Zomato', 'BigBazaar', 'DMart',
      'Uber', 'Ola', 'Netflix', 'Spotify', 'Airtel',
      'Electricity Board', 'Water Bill', 'PhonePe Merchant',
      'Tea Stall', 'Dominos', 'McDonald\'s', 'Local Kirana',
      'Petrol Pump', 'Medical Store', 'Gym Membership',
    ];
    const descriptions = [
      'Online shopping', 'Food delivery', 'Dinner order', 'Weekly groceries', 'Monthly groceries',
      'Cab ride', 'Auto ride', 'Streaming subscription', 'Music subscription', 'Mobile recharge',
      'Electricity bill', 'Water bill', 'UPI payment', 'Evening tea', 'Pizza night',
      'Burger + fries', 'Daily essentials', 'Fuel refill', 'Medicines', 'Monthly membership',
    ];

    const items = [];
    for (let i = 0; i < 45; i++) {
      const daysAgo = Math.floor(Math.random() * 30);
      const idx = Math.floor(Math.random() * payees.length);
      const amount = [50, 80, 120, 150, 200, 250, 349, 450, 599, 799, 999, 1200, 1500, 2000, 2500][Math.floor(Math.random() * 15)];
      items.push({
        date:        dateDaysAgo(daysAgo),
        description: descriptions[idx],
        amount,
        payee:       payees[idx],
        source:      'demo',
      });
    }
    return items;
  }

  elBtnDemo.addEventListener('click', () => {
    const demo = generateDemoData();
    for (const d of demo) addExpense(d);
    toast(`Loaded ${demo.length} demo transactions`);
  });

  elBtnClear.addEventListener('click', () => {
    if (!confirm('Clear all transaction data? This cannot be undone.')) return;
    expenses = [];
    saveData();
    refreshAll();
    toast('All data cleared');
  });

  // ─── REFRESH ALL ──────────────────────────────────────
  function refreshAll() {
    updateStats();
    renderTransactions(elSearchTxn.value);
    updateCharts();
  }

  // ─── EFFECTS & PWA ────────────────────────────────────
  function initEffects() {
    // 1. Ripple Effect on Buttons
    document.querySelectorAll('.btn, .nav-item').forEach(btn => {
      btn.addEventListener('click', function(e) {
        let ripple = document.createElement('span');
        ripple.classList.add('ripple');
        this.appendChild(ripple);
        
        let d = Math.max(this.clientWidth, this.clientHeight);
        ripple.style.width = ripple.style.height = d + 'px';
        
        let rect = this.getBoundingClientRect();
        ripple.style.left = e.clientX - rect.left - d/2 + 'px';
        ripple.style.top = e.clientY - rect.top - d/2 + 'px';
        
        setTimeout(() => ripple.remove(), 600);
      });
    });

    // 2. Vanilla 3D Tilt for Glass Cards (desktop only)
    if (window.matchMedia("(min-width: 768px)").matches) {
      document.querySelectorAll('.glass-card').forEach(card => {
        card.addEventListener('mousemove', function(e) {
          const rect = this.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const xc = rect.width / 2;
          const yc = rect.height / 2;
          const dx = x - xc;
          const dy = y - yc;
          // Calculate rotation
          const tiltX = (dy / yc) * -4; // Max 4 deg
          const tiltY = (dx / xc) * 4;
          this.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-2px)`;
        });
        card.addEventListener('mouseleave', function() {
          this.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)`;
        });
      });
    }

    // 3. Mobile Nav highlighting
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');
      });
    });
  }

  function registerPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => console.log('SW registered:', reg.scope))
          .catch(err => console.log('SW registration failed:', err));
      });
    }
  }

  // ─── INIT ─────────────────────────────────────────────
  function init() {
    expenses = generateDemoData();
    saveData();
    buildCharts();
    updateStats();
    renderTransactions();
    initEffects();
    registerPWA();
  }

  // Wait for DOM + Chart.js
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
