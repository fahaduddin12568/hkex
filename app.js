
const sb = window._supabase;
// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const COLS = 9;
const ROWS = 25;
const COL_LABELS = ['ACC ID','Date','Supplier','Acc. Price','Status','Unit','Quantity','Purchase Price','Purchase Value'];
const STATUS_COL       = 4;
const UNIT_COL         = 5;
const QTY_COL          = 6;
const DATE_PRICE_COL   = 7;
const PURCHASE_VAL_COL = 8;
const AMOUNT_COLS      = new Set([3, 7, 8]);
const NUMERIC_COLS     = new Set([6]);
const STATUS_OPTIONS   = ['', 'Available', 'Reserved', 'Sold'];
const ACC_ID_COL       = 0;
const DATE_COL         = 1;
const FIXED_COL        = 2;

const PRESENCE_TTL       = 120000; // 2 min
const HEARTBEAT_INTERVAL = 30000;  // 30 s

let BTC_PRICE = 70825.6;

// ─── UTILS ────────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const DATE_UNIT_PRICE = {
  '8/16/2022_BTC':  24126.13,
  '10/17/2023_BTC': 28522.09,
  '12/26/2022_BTC': 16919.20,
  '1/30/2021_BTC':  32358.14,
  '1/5/2022_BTC':   46458.22,
  '8/8/2022_BTC':   23811.31,
  '7/7/2020_BTC':    9349.21,
};

function lookupPurchasePrice(date) {
  if (!date) return '';
  const v = DATE_UNIT_PRICE[date.trim() + '_BTC'];
  return v !== undefined ? String(v) : '';
}

function calcPurchaseValue(qty) {
  const q = parseFloat(qty);
  if (isNaN(q) || q === 0) return '';
  return String((q * BTC_PRICE).toFixed(2));
}

// ─── DEFAULT DATA ─────────────────────────────────────────────────────────────
const DEFAULT_COL_A = ["47832","09341","63027","18754","82613","05490","71238","29405","56871","14293","38760","92145","07683","44519","67302","23087","80941","11574","59263","33816","76540","08127","42698","95034","16872"];
const DEFAULT_COL_B = ["8/16/2022","10/17/2023","12/26/2022","1/30/2021","8/16/2022","1/5/2022","8/8/2022","7/7/2020","8/16/2022","12/26/2022","1/30/2021","10/17/2023","8/8/2022","1/5/2022","7/7/2020","8/16/2022","10/17/2023","12/26/2022","1/5/2022","8/8/2022","1/30/2021","7/7/2020","8/16/2022","10/17/2023","8/8/2022"];
const DEFAULT_COL_D = ["284750","93610","417320","51840","368290","142750","439180","27960","315740","189430","76820","403560","234170","118650","472390","59840","326180","87430","451270","198360","344920","63740","289510","427840","156730"];
const DEFAULT_COL_E = ["Reserved","Sold","Reserved","Sold","Reserved","Reserved","Sold","Reserved","Sold","Reserved","Sold","Reserved","Sold","Reserved","Sold","Reserved","Sold","Reserved","Sold","Sold","Reserved","Reserved","Sold","Reserved","Sold"];
const DEFAULT_COL_G = ["8.76536","3.86783","12.32891","1.64029","11.45568","4.62722","13.26844","1.24276","13.08358","7.34877","2.49996","13.78353","8.05551","3.47710","13.81222","1.72669","13.81078","2.99687","18.51403","8.49207","12.82029","2.83735","8.76001","18.92548","4.43383"];

function generateDefaultTable() {
  const data = [];
  for (let r = 0; r < ROWS; r++) {
    const date  = DEFAULT_COL_B[r] || '';
    const qty   = DEFAULT_COL_G[r] || '';
    data.push([
      DEFAULT_COL_A[r] || '',
      date,
      'HKEX',
      DEFAULT_COL_D[r] || '',
      DEFAULT_COL_E[r] || '',
      'BTC',
      qty,
      lookupPurchasePrice(date),
      calcPurchaseValue(qty),
    ]);
  }
  return data;
}

function getRowColor(status) {
  if (status === 'Available') return { bg: '#f0faf0', text: '#1a6b1a', numColor: '#4caf50' };
  if (status === 'Reserved')  return { bg: '#fff8f0', text: '#8a4800', numColor: '#f07800' };
  if (status === 'Sold')      return { bg: '#fff5f5', text: '#8b1a1a', numColor: '#e53935' };
  return { bg: '', text: '', numColor: '' };
}

// ─── STATE ────────────────────────────────────────────────────────────────────
let currentUser    = null; // { id, name, role, balance }
let selectedAdminUser = null;
let deleteTargetId    = null;
const sortState = { col: null, dir: 1 };
const SORTABLE_COLS = new Set([STATUS_COL, 3, QTY_COL, PURCHASE_VAL_COL]);

// In-memory cache to avoid re-fetching on every render
const _tableCache = {};

// ─── SUPABASE HELPERS ────────────────────────────────────────────────────────

async function getUsers() {
  const { data, error } = await sb.from('profiles').select('*').neq('role','admin');
  if (error) { console.error('getUsers:', error); return []; }
  return data;
}

async function getUserById(userId) {
  const { data, error } = await sb.from('profiles').select('*').eq('id', userId).single();
  if (error) { console.error('getUserById:', error); return null; }
  return data;
}

// ─── VISIBILITY TOGGLE ────────────────────────────────────────────────────────
async function toggleVisibility(userId, field, btnEl) {
  const isOn   = btnEl.classList.contains('vis-on');
  const newVal = !isOn;
  const update = {};
  update[field] = newVal;
  const { error } = await sb.from('profiles').update(update).eq('id', userId);
  if (error) { showToast('Failed to update visibility'); return; }
  btnEl.classList.toggle('vis-on',  newVal);
  btnEl.classList.toggle('vis-off', !newVal);
  const label  = btnEl.querySelector('.vis-label');
  const prefix = field === 'visibility_btc' ? 'BTC' : field === 'visibility_projects' ? 'Projects' : 'OTC';
  if (label) label.textContent = prefix + ': ' + (newVal ? 'Visible' : 'Hidden');
  showToast(prefix + ' visibility ' + (newVal ? 'enabled' : 'disabled'), newVal ? 'success' : '');
}

async function getUserData(userId) {
  if (_tableCache[userId]) return JSON.parse(JSON.stringify(_tableCache[userId]));
  const { data, error } = await sb.from('table_data').select('data').eq('user_id', userId).single();
  if (error || !data) {
    const def = generateDefaultTable();
    _tableCache[userId] = def;
    return JSON.parse(JSON.stringify(def));
  }
  _tableCache[userId] = data.data;
  return JSON.parse(JSON.stringify(data.data));
}

async function setUserData(userId, tableData) {
  _tableCache[userId] = tableData;
  const { error } = await sb.from('table_data').upsert(
    { user_id: userId, data: tableData, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
  if (error) console.error('setUserData:', error);
}

// ─── PRESENCE ─────────────────────────────────────────────────────────────────
async function setPresence(userId) {
  await sb.from('presence').upsert({ user_id: userId, last_seen: new Date().toISOString() }, { onConflict: 'user_id' });
}

async function clearPresence(userId) {
  // Set last_seen to PRESENCE_TTL+1ms ago so admin sees "last seen Xm ago"
  const past = new Date(Date.now() - PRESENCE_TTL - 1000).toISOString();
  await sb.from('presence').upsert({ user_id: userId, last_seen: past }, { onConflict: 'user_id' });
}

async function getPresenceMap(userIds) {
  // Returns { userId: last_seen ISO string }
  if (!userIds.length) return {};
  const { data, error } = await sb.from('presence').select('user_id, last_seen').in('user_id', userIds);
  if (error) { console.error('getPresenceMap:', error); return {}; }
  const map = {};
  (data || []).forEach(r => { map[r.user_id] = r.last_seen; });
  return map;
}

function isOnlineFromTs(isoTs) {
  if (!isoTs) return false;
  return (Date.now() - new Date(isoTs).getTime()) < PRESENCE_TTL;
}

function formatLastSeenFromTs(isoTs) {
  if (!isoTs) return 'Never logged in';
  const diffMs = Date.now() - new Date(isoTs).getTime();
  if (diffMs < PRESENCE_TTL) return 'Online now';
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return 'Last seen ' + diffMin + 'm ago';
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return 'Last seen ' + diffHr + 'h ago';
  return 'Last seen ' + Math.floor(diffHr / 24) + 'd ago';
}

function startHeartbeat(userId) {
  if (window._heartbeatTimer) clearInterval(window._heartbeatTimer);
  setPresence(userId);
  window._heartbeatTimer = setInterval(() => setPresence(userId), HEARTBEAT_INTERVAL);
}

function startAdminRefresh() {
  if (window._adminRefreshTimer) clearInterval(window._adminRefreshTimer);
  window._adminRefreshTimer = setInterval(() => {
    if (currentUser && currentUser.role === 'admin') renderAdminUsersList();
  }, HEARTBEAT_INTERVAL);
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  if (el) el.classList.add('active');
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
async function doLogin() {
  const btn = document.getElementById('loginBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }

  const email    = document.getElementById('loginUsername').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;

  const { data: authData, error: authErr } = await sb.auth.signInWithPassword({ email, password });
  if (authErr || !authData.user) {
    document.getElementById('loginError').style.display = 'block';
    if (btn) { btn.disabled = false; btn.textContent = 'Sign In'; }
    return;
  }

  const profile = await getUserById(authData.user.id);
  if (!profile) {
    document.getElementById('loginError').style.display = 'block';
    if (btn) { btn.disabled = false; btn.textContent = 'Sign In'; }
    return;
  }

  currentUser = profile;
  if (btn) { btn.disabled = false; btn.textContent = 'Sign In'; }
  _afterLogin();
}

function _afterLogin() {
  document.getElementById('headerUserBadge').textContent =
    currentUser.name + (currentUser.role === 'admin' ? ' · admin' : '');
  document.getElementById('btnSignOut').style.display = '';

  if (currentUser.role === 'admin') {
    startAdminRefresh();
    showPage('admin');
    renderAdminUsersList();
  } else {
    startHeartbeat(currentUser.id);
    document.getElementById('userWelcome').textContent = 'Welcome, ' + currentUser.name;
    showPage('user');
    renderUserTable(currentUser.id, 'userTable', true);
  }
}

async function signOut() {
  if (currentUser && currentUser.role !== 'admin') {
    await clearPresence(currentUser.id);
  }
  if (window._heartbeatTimer)   { clearInterval(window._heartbeatTimer);   window._heartbeatTimer = null; }
  if (window._adminRefreshTimer){ clearInterval(window._adminRefreshTimer); window._adminRefreshTimer = null; }
  await sb.auth.signOut();
  currentUser = null;
  selectedAdminUser = null;
  document.getElementById('headerUserBadge').textContent = '';
  document.getElementById('btnSignOut').style.display = 'none';
  showPage('login');
}

// ─── FORMAT HELPERS ───────────────────────────────────────────────────────────
function formatAmount(raw) {
  const n = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
  if (isNaN(n)) return raw;
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ─── USER TABLE ───────────────────────────────────────────────────────────────
async function renderUserTable(userId, tableId = 'userTable', readonly = false) {
  const rawData = await getUserData(userId);
  const table   = document.getElementById(tableId);
  if (!table) return;

  let data = rawData.map((row, i) => ({ row, i }));
  if (sortState.col !== null) {
    const col = sortState.col;
    const statusOrder = { Available: 0, Reserved: 1, Sold: 2, '': 3 };
    data.sort((a, b) => {
      const av = (a.row && a.row[col] !== undefined) ? a.row[col] : '';
      const bv = (b.row && b.row[col] !== undefined) ? b.row[col] : '';
      if (col === STATUS_COL) return sortState.dir * ((statusOrder[av] ?? 3) - (statusOrder[bv] ?? 3));
      const an = parseFloat(String(av).replace(/[^0-9.]/g, ''));
      const bn = parseFloat(String(bv).replace(/[^0-9.]/g, ''));
      if (!isNaN(an) && !isNaN(bn)) return sortState.dir * (an - bn);
      return sortState.dir * String(av).localeCompare(String(bv));
    });
  }

  let html = '<thead><tr><th style="width:36px;color:#aaa;">#</th>';
  COL_LABELS.forEach((label, i) => {
    let cls = '';
    if (i === STATUS_COL) cls = 'col-status';
    else if (i === UNIT_COL) cls = 'col-unit';
    else if (AMOUNT_COLS.has(i)) cls = 'col-amount';
    if (SORTABLE_COLS.has(i)) {
      const isActive = sortState.col === i;
      const icon     = isActive ? (sortState.dir === 1 ? '▲' : '▼') : '⇅';
      const iconCls  = isActive ? 'sort-icon active' : 'sort-icon';
      html += `<th${cls ? ` class="${cls} sortable"` : ' class="sortable"'} onclick="toggleSort(${i},'${tableId}','${userId}',${readonly})">${label}<span class="${iconCls}">${icon}</span></th>`;
    } else {
      html += `<th${cls ? ` class="${cls}"` : ''}>${label}</th>`;
    }
  });
  html += '</tr></thead><tbody>';

  data.forEach(({ row: rowData, i: origIdx }, displayIdx) => {
    const r         = origIdx;
    const statusVal = (rowData && rowData[STATUS_COL]) ? rowData[STATUS_COL] : '';
    const { bg, text, numColor } = getRowColor(statusVal);
    const rowStyle       = bg ? `style="background:${bg}"` : '';
    const inputColorStyle = text ? `color:${text}` : '';

    html += `<tr ${rowStyle}>`;
    html += `<td style="text-align:center;font-family:'DM Mono',monospace;font-size:11px;background:${bg||'var(--cell-bg)'};padding:9px 8px;color:${numColor||'var(--text-muted)'};border-right:1px solid var(--border);border-bottom:1px solid var(--border);">${displayIdx+1}</td>`;

    for (let c = 0; c < COLS; c++) {
      const val       = (rowData && rowData[c] !== undefined) ? rowData[c] : '';
      const isStatus  = c === STATUS_COL;
      const isUnit    = c === UNIT_COL;
      const isAmount  = AMOUNT_COLS.has(c);
      const isNumeric = NUMERIC_COLS.has(c);

      if (isStatus && !readonly) {
        const selectColor = statusVal==='Available'?'#1a6b1a':statusVal==='Reserved'?'#8a4800':statusVal==='Sold'?'#8b1a1a':'var(--text-muted)';
        const opts = STATUS_OPTIONS.map(o => `<option value="${o}" ${val===o?'selected':''}>${o||'—'}</option>`).join('');
        html += `<td style="padding:6px 10px;min-width:130px;"><select class="cell-select status-select" data-row="${r}" data-col="${c}" onchange="onStatusChange(this,'${tableId}')" style="color:${selectColor};">${opts}</select></td>`;
      } else if (isStatus && readonly) {
        const pillClass = statusVal==='Available'?'status-active':statusVal==='Reserved'?'status-suspended':statusVal==='Sold'?'status-fired':'status-empty';
        const clickable = statusVal==='Available'
          ? `onclick="openReservePanel(this,${r},'${tableId}','${userId}')" class="status-pill ${pillClass} clickable-available" title="Click to reserve"`
          : `class="status-pill ${pillClass}"`;
        html += `<td style="padding:6px 10px;min-width:130px;text-align:center;"><span ${clickable}>${escHtml(val)||'—'}</span></td>`;
      } else if (isUnit) {
        html += `<td><div style="padding:9px 14px;font-size:13px;font-weight:600;color:${text||'var(--text)'};font-family:'DM Mono',monospace;letter-spacing:0.04em;text-align:center;">BTC</div></td>`;
      } else if (isAmount) {
        const displayed = val ? formatAmount(val) : '';
        if (readonly) {
          html += `<td data-td-col="${c}" data-td-row="${r}"><div class="amount-cell" style="${inputColorStyle}"><span class="dollar-sign">$</span><span class="amount-display">${escHtml(displayed)}</span></div></td>`;
        } else {
          html += `<td data-td-col="${c}" data-td-row="${r}"><div class="amount-cell"><span class="dollar-sign" style="${inputColorStyle}">$</span><input class="cell-input amount-input" data-row="${r}" data-col="${c}" value="${escHtml(displayed)}" style="${inputColorStyle}" oninput="onAmountInput(this,'${tableId}')" onblur="onAmountBlur(this)"></div></td>`;
        }
      } else if (isNumeric) {
        if (readonly) {
          html += `<td data-td-col="${c}" data-td-row="${r}"><div class="amount-cell" style="${inputColorStyle}"><span class="qty-display">${escHtml(val)}</span></div></td>`;
        } else {
          html += `<td><input class="cell-input numeric-input" data-row="${r}" data-col="${c}" value="${escHtml(val)}" style="${inputColorStyle}" oninput="onNumericInput(this,'${tableId}');onQtyChange(this,'${tableId}')"></td>`;
        }
      } else if (c === ACC_ID_COL) {
        const suffix = val || '';
        if (readonly) {
          html += `<td><div class="amount-cell" style="${inputColorStyle}"><span class="dollar-sign" style="font-family:'DM Mono',monospace;letter-spacing:0.02em;color:var(--text-muted);">ID42EX</span><span style="font-family:'DM Mono',monospace;">${escHtml(suffix)}</span></div></td>`;
        } else {
          html += `<td><div class="amount-cell"><span class="dollar-sign" style="font-family:'DM Mono',monospace;letter-spacing:0.02em;${inputColorStyle}">ID42EX</span><input class="cell-input amount-input" data-row="${r}" data-col="${c}" value="${escHtml(suffix)}" style="${inputColorStyle};font-family:'DM Mono',monospace;width:56px;" maxlength="5" oninput="onAccIdInput(this,'${tableId}')"></div></td>`;
        }
      } else if (c === DATE_COL) {
        if (readonly) {
          html += `<td><input class="cell-input" data-row="${r}" data-col="${c}" value="${escHtml(val)}" readonly style="text-align:center;${inputColorStyle}"></td>`;
        } else {
          html += `<td><input class="cell-input" data-row="${r}" data-col="${c}" value="${escHtml(val)}" placeholder="M/D/YYYY" style="text-align:center;${inputColorStyle}" oninput="onDateOrUnitChange(this,'${tableId}');markUnsaved('${tableId}')"></td>`;
        }
      } else if (c === FIXED_COL) {
        html += `<td><div style="padding:9px 14px;font-size:13px;font-weight:500;color:${text||'var(--text-muted)'};letter-spacing:0.05em;text-align:center;">${escHtml(val)||'HK'}</div></td>`;
      } else {
        const ro = readonly ? 'readonly' : '';
        html += `<td><input class="cell-input" data-row="${r}" data-col="${c}" value="${escHtml(val)}" ${ro} oninput="markUnsaved('${tableId}')" style="${inputColorStyle}"></td>`;
      }
    }
    html += '</tr>';
  });
  html += '</tbody>';
  table.innerHTML = html;
}

async function toggleSort(col, tableId, userId, readonly) {
  closeReservePanel();
  sortState.col = sortState.col === col ? col : col;
  sortState.dir = sortState.col === col ? sortState.dir * -1 : 1;
  // re-derive correctly
  if (sortState.col !== col) { sortState.col = col; sortState.dir = 1; }
  await renderUserTable(userId, tableId, readonly);
}

// ─── RESERVE: INLINE PANEL ────────────────────────────────────────────────────
let reserveTarget = null;

function closeReservePanel() {
  document.querySelectorAll('.reserve-panel-row').forEach(r => r.remove());
  reserveTarget = null;
}

async function openReservePanel(pillEl, rowIdx, tableId, userId) {
  const existing = document.querySelector('.reserve-panel-row');
  if (existing) {
    const existingRow = existing.previousElementSibling;
    closeReservePanel();
    const clickedTr = pillEl.closest('tr');
    if (existingRow === clickedTr) return;
  }

  const data    = await getUserData(userId);
  const rowData = data[rowIdx] || [];
  const user    = await getUserById(userId);
  const balance = user && user.balance != null ? parseFloat(user.balance) : 0;

  const accId      = 'ID42EX' + (rowData[ACC_ID_COL] || '—');
  const suppli     = rowData[FIXED_COL]  || 'HK';
  const accPxRaw   = parseFloat(rowData[3]) || 0;
  const accPx      = accPxRaw ? '$' + formatAmount(rowData[3]) : '—';
  const qty        = rowData[QTY_COL]    || '—';
  const purVal     = rowData[PURCHASE_VAL_COL] ? '$' + formatAmount(rowData[PURCHASE_VAL_COL]) : '—';
  const reqFunding = accPxRaw > 0 ? Math.max(0, accPxRaw - balance) : null;
  const reqFundingFmt = reqFunding != null ? '$' + formatAmount(String(reqFunding)) : '—';

  const colCount = COL_LABELS.length + 1;
  const panelRow = document.createElement('tr');
  panelRow.className = 'reserve-panel-row';
  panelRow.innerHTML = `
    <td colspan="${colCount}">
      <div class="reserve-panel">
        <div class="reserve-panel-info">
          <div class="rp-label">Account Selected for Reservation</div>
          <div style="display:flex;gap:24px;flex-wrap:wrap;margin-top:4px;">
            <div><span style="color:var(--text-muted);font-size:11px;">ACC ID</span><br><strong>${escHtml(accId)}</strong></div>
            <div><span style="color:var(--text-muted);font-size:11px;">Supplier</span><br><strong>${escHtml(suppli)}</strong></div>
            <div><span style="color:var(--text-muted);font-size:11px;">Acc. Price</span><br><strong>${escHtml(accPx)}</strong></div>
            <div><span style="color:var(--text-muted);font-size:11px;">Qty (BTC)</span><br><strong>${escHtml(String(qty))}</strong></div>
            <div><span style="color:var(--text-muted);font-size:11px;">Purchase Value</span><br><strong>${escHtml(purVal)}</strong></div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">
          ${reqFunding > 0 ? `<div style="font-size:11px;color:#c41e35;background:#fdeef0;border:1px solid #f5b0bb;border-radius:6px;padding:4px 10px;text-align:right;">⚠ Requires <strong>${escHtml(reqFundingFmt)}</strong> additional funding</div>` : ''}
          <button class="btn-reserve" onclick="openReserveConfirm()">Reserve this Account →</button>
          <button class="btn-reserve-cancel" onclick="closeReservePanel()">Cancel</button>
        </div>
      </div>
    </td>`;

  const clickedTr = pillEl.closest('tr');
  clickedTr.insertAdjacentElement('afterend', panelRow);
  reserveTarget = { rowIdx, tableId, userId, rowData, accId, suppli, accPx, accPxRaw, qty, purVal, balance, reqFunding, reqFundingFmt };
  panelRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function openReserveConfirm() {
  if (!reserveTarget) return;
  const { accId, suppli, accPx, qty, purVal, balance, reqFundingFmt } = reserveTarget;
  const balanceFmt = '$' + formatAmount(String(balance));
  document.getElementById('reserveModalDetails').innerHTML = `
    <div class="rd-row"><span class="rd-label">Account ID</span><span class="rd-val">${escHtml(accId)}</span></div>
    <div class="rd-row"><span class="rd-label">Supplier</span><span class="rd-val">${escHtml(suppli)}</span></div>
    <div class="rd-row"><span class="rd-label">Account Price</span><span class="rd-val">${escHtml(accPx)}</span></div>
    <div class="rd-row"><span class="rd-label">Quantity (BTC)</span><span class="rd-val">${escHtml(String(qty))}</span></div>
    <div class="rd-row"><span class="rd-label">Purchase Value</span><span class="rd-val">${escHtml(purVal)}</span></div>
    <div class="rd-row" style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px;"><span class="rd-label">Current Balance</span><span class="rd-val" style="color:#1a6b1a;">${escHtml(balanceFmt)}</span></div>
    <div class="rd-row"><span class="rd-label">Required Funding</span><span class="rd-val" style="color:${reserveTarget.reqFunding > 0 ? '#c41e35' : '#1a6b1a'};">${escHtml(reqFundingFmt)}</span></div>
  `;
  document.getElementById('reserveModal').classList.add('open');
}

async function confirmReservation() {
  if (!reserveTarget) return;
  const { rowIdx, tableId, userId } = reserveTarget;
  const data = await getUserData(userId);
  if (!data[rowIdx]) data[rowIdx] = [];
  data[rowIdx][STATUS_COL] = 'Reserved';
  await setUserData(userId, data);
  closeModal();
  closeReservePanel();
  await renderUserTable(userId, tableId, true);
  showToast('Account reserved successfully', 'success');
  generateReservationPDF(reserveTarget);
  sendReservationEmail(reserveTarget);
  reserveTarget = null;
}

// ─── PDF RECEIPT ──────────────────────────────────────────────────────────────
function generateReservationPDF(target) {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const now = new Date();
    const ts  = now.toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });
    const userName = currentUser ? currentUser.name : 'User';

    doc.setFillColor(0, 52, 101);
    doc.rect(0, 0, 595, 70, 'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(20); doc.setFont('helvetica','bold');
    doc.text('HKEX WorkSpace', 40, 38);
    doc.setFontSize(10); doc.setFont('helvetica','normal');
    doc.text('Reservation Receipt', 40, 56);

    doc.setTextColor(0,52,101);
    doc.setFontSize(15); doc.setFont('helvetica','bold');
    doc.text('Account Reservation Confirmation', 40, 105);
    doc.setTextColor(100,100,100); doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text(`Issued: ${ts}`, 40, 122);
    doc.text(`Client: ${userName}`, 40, 136);
    doc.setDrawColor(0,52,101); doc.setLineWidth(0.5);
    doc.line(40, 148, 555, 148);

    const fields = [
      ['Account ID',       target.accId],
      ['Supplier',         target.suppli],
      ['Account Price',    target.accPx],
      ['Quantity (BTC)',   String(target.qty)],
      ['Purchase Value',   target.purVal],
      ['Current Balance',  '$' + formatAmount(String(target.balance))],
      ['Required Funding', target.reqFundingFmt],
      ['Status',           'Reserved'],
      ['Reserved By',      userName],
      ['Reservation Time', ts],
    ];

    let y = 172;
    fields.forEach(([label, value], i) => {
      const rowBg = i % 2 === 0 ? [248,250,253] : [255,255,255];
      doc.setFillColor(...rowBg);
      doc.rect(40, y-13, 515, 22, 'F');
      doc.setTextColor(120,130,145); doc.setFontSize(9); doc.setFont('helvetica','normal');
      doc.text(label, 52, y);
      doc.setTextColor(20,40,70); doc.setFont('helvetica','bold');
      doc.text(String(value), 240, y);
      y += 22;
    });

    doc.setFillColor(0,52,101);
    doc.rect(0, 780, 595, 62, 'F');
    doc.setTextColor(180,200,220); doc.setFontSize(8); doc.setFont('helvetica','normal');
    doc.text('This document is an automatically generated receipt from HKEX WorkSpace.', 40, 800);
    doc.text('Please retain it for your records. For queries contact your broker.', 40, 814);
    doc.setTextColor(255,255,255);
    doc.text('HKEX WorkSpace © ' + now.getFullYear(), 40, 828);
    doc.save(`HKEX_Reservation_${target.accId}_${now.toISOString().slice(0,10)}.pdf`);
  } catch(e) {
    console.warn('PDF generation failed:', e);
    showToast('Reservation confirmed (PDF unavailable)');
  }
}

function sendReservationEmail(target) {
  if (!currentUser) return;
  const toEmail = currentUser.username || '';
  const now     = new Date().toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });
  const subject = encodeURIComponent(`HKEX Account Reservation Confirmed – ${target.accId}`);
  const body = encodeURIComponent(
`Dear ${currentUser.name},\n\nYour account reservation has been confirmed.\n\n  Account ID:       ${target.accId}\n  Supplier:         ${target.suppli}\n  Account Price:    ${target.accPx}\n  Quantity (BTC):   ${target.qty}\n  Purchase Value:   ${target.purVal}\n  Status:           Reserved\n  Reservation Time: ${now}\n\nA PDF receipt has been downloaded to your device.\n\nKind regards,\nHKEX WorkSpace`
  );
  window.open(`mailto:${toEmail}?subject=${subject}&body=${body}`, '_blank');
}

// ─── INPUT HANDLERS ───────────────────────────────────────────────────────────
function onAmountInput(input, tableId) {
  input.dataset.raw = input.value.replace(/[^0-9.]/g, '');
  markUnsaved(tableId);
}

function onAmountBlur(input) {
  const raw = (input.dataset.raw !== undefined ? input.dataset.raw : input.value).replace(/[^0-9.]/g, '');
  if (raw === '') { input.value = ''; return; }
  const n = parseFloat(raw);
  if (!isNaN(n)) input.value = n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function onAccIdInput(input, tableId) {
  input.value = input.value.replace(/\D/g, '').slice(0, 5);
  markUnsaved(tableId);
}

function onNumericInput(input, tableId) {
  let v = input.value.replace(/[^0-9.]/g, '');
  const parts = v.split('.');
  if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
  input.value = v;
  markUnsaved(tableId);
}

function onDateOrUnitChange(el, tableId) {
  const row  = el.closest('tr');
  if (!row) return;
  const dateEl = row.querySelector(`[data-col="${DATE_COL}"]`);
  const qtyEl  = row.querySelector(`[data-col="${QTY_COL}"]`);
  if (!dateEl) return;
  const date = dateEl.value.trim();
  const qty  = qtyEl ? qtyEl.value.trim() : '';
  const price   = lookupPurchasePrice(date);
  const ppInput = row.querySelector(`[data-col="${DATE_PRICE_COL}"]`);
  if (ppInput && price) ppInput.value = formatAmount(price);
  const pvInput = row.querySelector(`[data-col="${PURCHASE_VAL_COL}"]`);
  if (pvInput) {
    const pv = calcPurchaseValue(qty);
    pvInput.value = pv ? formatAmount(pv) : '';
  }
}

function onQtyChange(el, tableId) {
  const row = el.closest('tr');
  if (!row) return;
  const pvInput = row.querySelector(`[data-col="${PURCHASE_VAL_COL}"]`);
  if (!pvInput) return;
  const pv = calcPurchaseValue(el.value.trim());
  pvInput.value = pv ? formatAmount(pv) : '';
}

function onStatusChange(select, tableId) {
  const row       = select.closest('tr');
  const statusVal = select.value;
  const { bg, text, numColor } = getRowColor(statusVal);
  const selectColor = statusVal==='Available'?'#1a6b1a':statusVal==='Reserved'?'#8a4800':statusVal==='Sold'?'#8b1a1a':'var(--text-muted)';
  select.style.color = selectColor;
  row.style.background = bg || '';
  row.querySelectorAll('.cell-input').forEach(el => { el.style.color = text || ''; });
  const numCell = row.cells[0];
  numCell.style.background = bg || 'var(--cell-bg)';
  numCell.style.color = numColor || 'var(--text-muted)';
  markUnsaved(tableId);
}

async function getTableData(tableId) {
  const userId = tableId === 'editTable' ? selectedAdminUser : (currentUser ? currentUser.id : null);
  const data   = userId ? await getUserData(userId) : generateDefaultTable();
  document.querySelectorAll(`#${tableId} .cell-input`).forEach(el => {
    const r = +el.dataset.row, c = +el.dataset.col;
    data[r][c] = AMOUNT_COLS.has(c) ? el.value.replace(/,/g, '') : el.value;
  });
  document.querySelectorAll(`#${tableId} .cell-select`).forEach(el => {
    const r = +el.dataset.row, c = +el.dataset.col;
    data[r][c] = el.value;
  });
  return data;
}

async function saveUserTable() {
  if (!currentUser) return;
  const data = await getTableData('userTable');
  await setUserData(currentUser.id, data);
  const el = document.getElementById('userTableSaveStatus');
  if (el) {
    el.textContent = '✓ Saved';
    el.className = 'save-status saved';
    setTimeout(() => { el.textContent = ''; el.className = 'save-status'; }, 2000);
  }
  showToast('Data saved successfully', 'success');
}

async function resetUserTable() {
  if (confirm('Reset all your data? This cannot be undone.')) {
    const def = generateDefaultTable();
    await setUserData(currentUser.id, def);
    await renderUserTable(currentUser.id);
    showToast('Table reset');
  }
}

function markUnsaved(tableId) {
  if (tableId === 'userTable') {
    const el = document.getElementById('userTableSaveStatus');
    if (!el) return;
    el.textContent = '● Unsaved changes';
    el.className = 'save-status';
  }
}

// ─── ADMIN: USERS LIST ────────────────────────────────────────────────────────
async function renderAdminUsersList() {
  const users   = await getUsers();
  const list    = document.getElementById('adminUsersList');
  if (!list) return;

  if (users.length === 0) {
    list.innerHTML = '<li style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">No users yet. Add one!</li>';
    return;
  }

  const userIds    = users.map(u => u.id);
  const presenceMap = await getPresenceMap(userIds);

  list.innerHTML = users.map(u => {
    const online   = isOnlineFromTs(presenceMap[u.id]);
    const presenceBadge = online
      ? `<span class="presence-badge presence-online"><span class="presence-dot"></span>Online</span>`
      : `<span class="presence-badge presence-offline">${escHtml(formatLastSeenFromTs(presenceMap[u.id]))}</span>`;
    const btcVis  = u.visibility_btc      !== false;
    const projVis = u.visibility_projects !== false;
    const otcVis  = u.visibility_otc      === true;
    return `
    <li class="user-item ${selectedAdminUser === u.id ? 'selected' : ''}" onclick="selectUserToEdit('${u.id}')">
      <div style="flex:1;min-width:0;">
        <div class="user-item-name">${escHtml(u.name)}</div>
        <div class="user-item-role">${escHtml(u.email || '')}</div>
        <div style="margin-top:4px;display:flex;align-items:center;gap:8px;">
          <span style="font-size:11px;color:#1a6b1a;font-family:'DM Mono',monospace;">Balance: $${formatAmount(String(u.balance || 0))}</span>
          <button class="btn btn-outline btn-sm" style="padding:1px 7px;font-size:10px;" onclick="event.stopPropagation();openEditCredentialsModal('${u.id}')">Edit</button>
        </div>
        <div class="vis-toggles" style="margin-top:6px;">
          <button class="vis-toggle ${btcVis?'vis-on':'vis-off'}" onclick="event.stopPropagation();toggleVisibility('${u.id}','visibility_btc',this)"><span class="vis-dot"></span><span class="vis-label">BTC: ${btcVis?'Visible':'Hidden'}</span></button>
          <button class="vis-toggle ${projVis?'vis-on':'vis-off'}" onclick="event.stopPropagation();toggleVisibility('${u.id}','visibility_projects',this)"><span class="vis-dot"></span><span class="vis-label">Projects: ${projVis?'Visible':'Hidden'}</span></button>
          <button class="vis-toggle ${otcVis?'vis-on':'vis-off'}" onclick="event.stopPropagation();toggleVisibility('${u.id}','visibility_otc',this)"><span class="vis-dot"></span><span class="vis-label">OTC: ${otcVis?'Visible':'Hidden'}</span></button>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;justify-content:flex-start;gap:5px;flex-shrink:0;padding-top:2px;">
        ${presenceBadge}
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();openDeleteModal('${u.id}')">&#x2715;</button>
      </div>
    </li>`;
  }).join('');
}

async function selectUserToEdit(userId) {
  selectedAdminUser = userId;
  await renderAdminUsersList();
  const user = await getUserById(userId);
  document.getElementById('editPanelEmpty').style.display = 'none';
  document.getElementById('editPanelContent').style.display = 'block';
  document.getElementById('editPanelTitle').textContent = 'Editing: ' + user.name;
  await renderUserTable(userId, 'editTable');
  document.getElementById('adminSaveStatus').textContent = '';
}

async function saveEditTable() {
  if (!selectedAdminUser) return;
  const data = await getTableData('editTable');
  await setUserData(selectedAdminUser, data);
  const el = document.getElementById('adminSaveStatus');
  el.textContent = '✓ Saved';
  el.className = 'save-status saved';
  setTimeout(() => { el.textContent = ''; el.className = 'save-status'; }, 2000);
  showToast('User data saved', 'success');
}

// ─── ADMIN: ADD USER ──────────────────────────────────────────────────────────
function openAddUserModal() {
  ['newUserName','newUserUsername','newUserPassword','newUserBalance'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('addUserModal').classList.add('open');
}

async function createUser() {
  const name     = document.getElementById('newUserName').value.trim();
  const email    = document.getElementById('newUserUsername').value.trim().toLowerCase();
  const password = document.getElementById('newUserPassword').value;
  const balance  = parseFloat(document.getElementById('newUserBalance').value) || 0;

  if (!name || !email || !password) { alert('Please fill in all fields.'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { alert('Please enter a valid email address.'); return; }

  // 1 — Create auth user (Supabase sends a confirmation email automatically;
  //     for an internal tool you can disable email confirmation in Supabase Auth settings)
  const { data: authData, error: authErr } = await sb.auth.admin
    ? await sb.auth.admin.createUser({ email, password, email_confirm: true })
    : { data: null, error: { message: 'Admin API not available from browser' } };

  // Fallback: use signUp (works when email confirmation is OFF in Supabase)
  let userId;
  if (authErr || !authData?.user) {
    const { data: signUpData, error: signUpErr } = await sb.auth.signUp({ email, password });
    if (signUpErr || !signUpData?.user) {
      alert('Failed to create auth user: ' + (signUpErr?.message || 'Unknown error'));
      return;
    }
    userId = signUpData.user.id;
  } else {
    userId = authData.user.id;
  }

  // 2 — Insert profile
  const { error: profileErr } = await sb.from('profiles').insert({ id: userId, name, role: 'user', balance });
  if (profileErr) { alert('Profile creation failed: ' + profileErr.message); return; }

  // 3 — Seed default table
  await setUserData(userId, generateDefaultTable());

  closeModal();
  await renderAdminUsersList();
  showToast('User "' + name + '" created');
}

async function openEditCredentialsModal(userId) {
  const user = await getUserById(userId);
  if (!user) return;
  document.getElementById('editCredUserId').value = userId;
  document.getElementById('editCredName').value = user.name;
  document.getElementById('editCredUsername').value = user.email || '';
  document.getElementById('editCredPassword').value = '';
  document.getElementById('editCredBalance').value = user.balance != null ? user.balance : '';
  document.getElementById('editCredError').style.display = 'none';
  document.getElementById('editCredentialsSubtitle').textContent = 'Editing credentials for ' + user.name;
  document.getElementById('editCredentialsModal').classList.add('open');
}

async function saveCredentials() {
  const userId  = document.getElementById('editCredUserId').value;
  const name    = document.getElementById('editCredName').value.trim();
  const balance = parseFloat(document.getElementById('editCredBalance').value) || 0;
  const errEl   = document.getElementById('editCredError');

  if (!name) { errEl.textContent = 'Name is required.'; errEl.style.display = 'block'; return; }

  const { error } = await sb.from('profiles').update({ name, balance }).eq('id', userId);
  if (error) { errEl.textContent = error.message; errEl.style.display = 'block'; return; }

  closeModal();
  await renderAdminUsersList();
  if (selectedAdminUser === userId) document.getElementById('editPanelTitle').textContent = 'Editing: ' + name;
  showToast('Credentials updated', 'success');
}

// ─── ADMIN: DELETE USER ───────────────────────────────────────────────────────
async function openDeleteModal(userId) {
  deleteTargetId = userId;
  const user = await getUserById(userId);
  const userName = user ? user.name : userId;
  document.getElementById('deleteUserMsg').textContent = `Delete "${userName}"? This cannot be undone.`;
  document.getElementById('deleteUserModal').classList.add('open');
}

async function confirmDeleteUser() {
  if (!deleteTargetId) return;
  // Delete auth user — requires service_role key (do this server-side in production).
  // For now, just delete the profile (cascades to table_data + presence via FK).
  const { error } = await sb.from('profiles').delete().eq('id', deleteTargetId);
  if (error) { alert('Delete failed: ' + error.message); return; }

  if (selectedAdminUser === deleteTargetId) {
    selectedAdminUser = null;
    document.getElementById('editPanelEmpty').style.display = 'flex';
    document.getElementById('editPanelContent').style.display = 'none';
  }
  deleteTargetId = null;
  closeModal();
  await renderAdminUsersList();
  showToast('User deleted');
}

function closeModal() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  t.className = 'toast show' + (type === 'success' ? ' toast-success' : '');
  setTimeout(() => t.classList.remove('show','toast-success'), 2500);
}

// ─── EVENT LISTENERS ──────────────────────────────────────────────────────────
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeReservePanel(); }
});

// ─── BTC PRICE ────────────────────────────────────────────────────────────────
async function fetchBtcPrice() {
  try {
    const res  = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
    const json = await res.json();
    const price = parseFloat(json?.price);
    if (price) {
      BTC_PRICE = price;
      const el = document.getElementById('btcPrice');
      if (el) el.textContent = '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      updateAllPurchaseValues();
    }
  } catch(e) { /* silently fail */ }
}

function updateAllPurchaseValues() {
  document.querySelectorAll('tr').forEach(row => {
    const qtyInput = row.querySelector(`input[data-col="${QTY_COL}"]`);
    const qtySpan  = row.querySelector(`td[data-td-col="${QTY_COL}"] .qty-display`);
    const rawQty   = qtyInput ? qtyInput.value.trim() : (qtySpan ? qtySpan.textContent.trim() : null);
    if (!rawQty) return;
    const pv = calcPurchaseValue(rawQty);
    if (!pv) return;
    const formatted = formatAmount(pv);
    const pvInput = row.querySelector(`input[data-col="${PURCHASE_VAL_COL}"]`);
    if (pvInput) { pvInput.value = formatted; return; }
    const pvSpan = row.querySelector(`td[data-td-col="${PURCHASE_VAL_COL}"] .amount-display`);
    if (pvSpan) pvSpan.textContent = formatted;
  });
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
fetchBtcPrice();
setInterval(fetchBtcPrice, 5000);

(function updateCopyright() {
  const el = document.getElementById('footerCopyright');
  if (el) {
    const yr = new Date().getFullYear().toString().slice(2);
    el.textContent = '©2017-' + yr + ' Hong Kong Exchanges and Clearing Limited. All rights reserved.';
  }
})();

// Restore session from Supabase's persisted auth token
(async function restoreSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return; // page-login is already active by default

  const profile = await getUserById(session.user.id);
  if (!profile) {
    await sb.auth.signOut();
    return;
  }

  currentUser = profile;
  document.getElementById('headerUserBadge').textContent =
    currentUser.name + (currentUser.role === 'admin' ? ' · admin' : '');
  document.getElementById('btnSignOut').style.display = '';

  _afterLogin();
})();

