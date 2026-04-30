// ============================================
// DASHBOARD — Data & Logic v2
// ============================================
const DB = {
  sessions: JSON.parse(localStorage.getItem('fm_sessions') || '[]'),
  products: JSON.parse(localStorage.getItem('fm_products') || '[]'),
  orders: JSON.parse(localStorage.getItem('fm_orders') || '[]'),
  fishTypes: JSON.parse(localStorage.getItem('fm_fish_types') || '[]'),
  fishCollected: JSON.parse(localStorage.getItem('fm_fish_collected') || '[]'),
  leaderboard: JSON.parse(localStorage.getItem('fm_leaderboard') || '[]'),
  pondStock: parseInt(localStorage.getItem('fm_pond_stock') || '500'),
  save() {
    localStorage.setItem('fm_sessions', JSON.stringify(this.sessions));
    localStorage.setItem('fm_products', JSON.stringify(this.products));
    localStorage.setItem('fm_orders', JSON.stringify(this.orders));
    localStorage.setItem('fm_fish_types', JSON.stringify(this.fishTypes));
    localStorage.setItem('fm_fish_collected', JSON.stringify(this.fishCollected));
    localStorage.setItem('fm_leaderboard', JSON.stringify(this.leaderboard));
    localStorage.setItem('fm_pond_stock', this.pondStock);
  }
};

// Seed defaults
if (!DB.products.length) {
  DB.products = [
    {id:'p1',name:'Mì tôm',price:25000,category:'food',status:'active'},
    {id:'p2',name:'Cơm chiên',price:35000,category:'food',status:'active'},
    {id:'p3',name:'Nước suối',price:10000,category:'drink',status:'active'},
    {id:'p4',name:'Trà đá',price:8000,category:'drink',status:'active'},
    {id:'p5',name:'Nước ngọt',price:15000,category:'drink',status:'active'},
    {id:'p6',name:'Bánh mì',price:20000,category:'food',status:'active'},
  ];
  DB.save();
}
if (!DB.fishTypes.length) {
  DB.fishTypes = [
    {id:'f1',name:'Cá chép',pricePerKg:60000,active:true},
    {id:'f2',name:'Cá trắm',pricePerKg:55000,active:true},
    {id:'f3',name:'Cá lóc',pricePerKg:70000,active:true},
    {id:'f4',name:'Cá rô phi',pricePerKg:45000,active:true},
  ];
  DB.save();
}

let currentSessionId = null;

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireAuth();
  if (!user) return;
  document.getElementById('topbar-name').textContent = user.full_name;
  const roleEl = document.getElementById('topbar-role');
  roleEl.textContent = user.role === 'admin' ? '👑 Admin' : '🎣 Chủ hồ';
  roleEl.className = 'user-role ' + user.role;
  populateProductSelect();
  renderAll();
  setInterval(updateAllCountdowns, 1000);
  setupModalHandlers();
});

// ============================================
// MODALS
// ============================================
function openModal(n) { document.getElementById('modal-' + n).classList.add('active'); if (n === 'manage-fish') renderFishTypeList(); }
function closeModal(n) { document.getElementById('modal-' + n).classList.remove('active'); }
document.addEventListener('click', e => { if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('active'); });

function setupModalHandlers() {
  const ps = document.getElementById('inp-initial-product');
  const qr = document.getElementById('initial-qty-row');
  const qi = document.getElementById('inp-initial-qty');
  const ti = document.getElementById('inp-initial-total');
  ps.addEventListener('change', () => { if (ps.value) { qr.style.display = 'grid'; const p = DB.products.find(x => x.id === ps.value); ti.value = formatVND(p.price * parseInt(qi.value||1)); } else { qr.style.display = 'none'; }});
  qi.addEventListener('input', () => { const p = DB.products.find(x => x.id === ps.value); if (p) ti.value = formatVND(p.price * parseInt(qi.value||1)); });
  document.getElementById('order-product').addEventListener('change', calcOrderTotal);
  document.getElementById('order-qty').addEventListener('input', calcOrderTotal);
  document.getElementById('fish-type').addEventListener('change', calcFishTotal);
  document.getElementById('fish-weight').addEventListener('input', calcFishTotal);
}
function calcOrderTotal() {
  const p = DB.products.find(x => x.id === document.getElementById('order-product').value);
  const q = parseInt(document.getElementById('order-qty').value || 1);
  document.getElementById('order-total').value = p ? formatVND(p.price * q) : '';
}
function calcFishTotal() {
  const f = DB.fishTypes.find(x => x.id === document.getElementById('fish-type').value);
  const w = parseFloat(document.getElementById('fish-weight').value || 0);
  document.getElementById('fish-total').value = f ? formatVND(f.pricePerKg * w) : '';
}

// ============================================
// SELECTS
// ============================================
function populateProductSelect() {
  const active = DB.products.filter(p => p.status === 'active');
  const opts = active.map(p => `<option value="${p.id}">${p.name} — ${formatVND(p.price)}</option>`).join('');
  document.getElementById('inp-initial-product').innerHTML = '<option value="">— Không gọi —</option>' + opts;
  document.getElementById('order-product').innerHTML = opts;
}
function populateFishSelect() {
  const active = DB.fishTypes.filter(f => f.active);
  document.getElementById('fish-type').innerHTML = active.map(f => `<option value="${f.id}">${f.name} — ${formatVND(f.pricePerKg)}/kg</option>`).join('');
}

// ============================================
// CREATE SESSION (có giá vé)
// ============================================
function createSession() {
  const name = document.getElementById('inp-customer-name').value.trim();
  if (!name) { showToast('Vui lòng nhập tên khách!', 'error'); return; }
  const minutes = parseInt(document.getElementById('inp-time-package').value);
  const ticketPrice = parseInt(document.getElementById('inp-ticket-price').value || 0);
  const now = new Date();
  const end = new Date(now.getTime() + minutes * 60000);
  const code = 'CA-' + fmtDateCode(now) + '-' + String(DB.sessions.length + 1).padStart(3, '0');
  const session = {
    id: 'ses_' + Date.now(), code, customerName: name,
    customerPhone: document.getElementById('inp-customer-phone').value.trim(),
    startTime: now.toISOString(), endTime: end.toISOString(), durationMin: minutes,
    ticketPrice: ticketPrice,
    deposit: parseInt(document.getElementById('inp-deposit').value || 0),
    fishWeightKg: 0, fishBuybackTotal: 0, status: 'fishing',
    notes: document.getElementById('inp-notes').value.trim(),
    orders: [], fishItems: [],
  };
  const prodId = document.getElementById('inp-initial-product').value;
  if (prodId) {
    const p = DB.products.find(x => x.id === prodId);
    const qty = parseInt(document.getElementById('inp-initial-qty').value || 1);
    session.orders.push({ id:'ord_'+Date.now(), productId:p.id, productName:p.name, qty, unitPrice:p.price, total:p.price*qty, time:now.toISOString() });
  }
  DB.sessions.push(session);
  DB.save();
  document.getElementById('inp-customer-name').value='';
  document.getElementById('inp-customer-phone').value='';
  document.getElementById('inp-deposit').value='100000';
  document.getElementById('inp-ticket-price').value='150000';
  document.getElementById('inp-notes').value='';
  document.getElementById('inp-initial-product').value='';
  document.getElementById('initial-qty-row').style.display='none';
  closeModal('create-session');
  showToast(`Ca ${code} đã bắt đầu! 🎣`, 'success');
  renderAll();
}

// ============================================
// ADD ORDER
// ============================================
function openAddOrder(sid) {
  currentSessionId = sid;
  const ses = DB.sessions.find(s => s.id === sid);
  document.getElementById('order-session-code').value = ses.code;
  populateProductSelect(); calcOrderTotal();
  openModal('add-order');
}
function addOrder() {
  const ses = DB.sessions.find(s => s.id === currentSessionId);
  const p = DB.products.find(x => x.id === document.getElementById('order-product').value);
  if (!p) { showToast('Chọn món!','error'); return; }
  const qty = parseInt(document.getElementById('order-qty').value||1);
  ses.orders.push({ id:'ord_'+Date.now(), productId:p.id, productName:p.name, qty, unitPrice:p.price, total:p.price*qty, time:new Date().toISOString() });
  DB.save(); closeModal('add-order');
  showToast(`Đã thêm ${qty}x ${p.name} ✅`, 'success'); renderAll();
}

// ============================================
// COLLECT FISH
// ============================================
function openCollectFish(sid) {
  currentSessionId = sid;
  const ses = DB.sessions.find(s => s.id === sid);
  document.getElementById('fish-session-code').value = ses.code;
  populateFishSelect(); calcFishTotal();
  openModal('collect-fish');
}
function collectFish() {
  const ses = DB.sessions.find(s => s.id === currentSessionId);
  const f = DB.fishTypes.find(x => x.id === document.getElementById('fish-type').value);
  if (!f) { showToast('Chọn loại cá!','error'); return; }
  const w = parseFloat(document.getElementById('fish-weight').value||0);
  if (w <= 0) { showToast('Nhập số kg!','error'); return; }
  const item = { id:'fc_'+Date.now(), fishTypeId:f.id, fishName:f.name, weightKg:w, pricePerKg:f.pricePerKg, subtotal:w*f.pricePerKg };
  ses.fishItems.push(item);
  ses.fishWeightKg += w;
  ses.fishBuybackTotal += item.subtotal;
  updateLeaderboard(ses.customerName, ses.customerPhone, w);
  DB.pondStock = Math.max(0, DB.pondStock - w);
  DB.save(); closeModal('collect-fish');
  showToast(`Thu ${w}kg ${f.name} — ${formatVND(item.subtotal)} ✅`, 'success'); renderAll();
}

// ============================================
// FINISH SESSION & BILL
// ============================================
function calcBill(ses) {
  const totalFood = ses.orders.reduce((s, o) => s + o.total, 0);
  const totalFish = ses.fishBuybackTotal;
  const ticket = ses.ticketPrice || 0;
  // Tổng trả = (Giá vé + Đồ gọi thêm) - (Tiền cọc + Tiền cá thu lại)
  const amountDue = (ticket + totalFood) - (ses.deposit + totalFish);
  return { totalFood, totalFish, ticket, deposit: ses.deposit, amountDue };
}

function openFinishSession(sid) {
  currentSessionId = sid;
  const ses = DB.sessions.find(s => s.id === sid);
  const bill = calcBill(ses);
  const ordersHTML = ses.orders.length
    ? ses.orders.map(o => `<div class="bill-line"><span>${o.qty}x ${o.productName}</span><span>${formatVND(o.total)}</span></div>`).join('')
    : '<p class="bill-empty">Không gọi đồ</p>';
  const fishHTML = ses.fishItems.length
    ? ses.fishItems.map(f => `<div class="bill-line"><span>${f.fishName} — ${f.weightKg}kg × ${formatVND(f.pricePerKg)}</span><span>${formatVND(f.subtotal)}</span></div>`).join('')
    : '<p class="bill-empty">Không có cá thu lại</p>';

  document.getElementById('finish-body').innerHTML = `
    <div class="bill-preview" id="bill-content">
      <div class="bill-header-info">
        <div class="bill-logo">🎣 FISHING MASTER</div>
        <div class="bill-code">${ses.code}</div>
        <div class="bill-date">${new Date().toLocaleString('vi-VN')}</div>
      </div>
      <div class="bill-customer">
        <strong>${ses.customerName}</strong> · ${ses.customerPhone||'N/A'}<br>
        Gói ${ses.durationMin/60}h · ${new Date(ses.startTime).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})} → ${new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}
      </div>
      <div class="bill-section-title">GIÁ VÉ CÂU</div>
      <div class="bill-line"><span>Vé câu ${ses.durationMin/60} giờ</span><span>${formatVND(bill.ticket)}</span></div>
      <div class="bill-section-title">ĐỒ ĂN / NƯỚC UỐNG</div>
      ${ordersHTML}
      <div class="bill-section-title">CÁ THU MUA LẠI (KHẤU TRỪ)</div>
      ${fishHTML}
      <div class="bill-summary">
        <div class="bill-sum-line"><span>Giá vé câu</span><span>+${formatVND(bill.ticket)}</span></div>
        <div class="bill-sum-line"><span>Đồ ăn/nước</span><span>+${formatVND(bill.totalFood)}</span></div>
        <div class="bill-sum-line deduct"><span>Tiền cọc (ứng trước)</span><span>-${formatVND(bill.deposit)}</span></div>
        <div class="bill-sum-line deduct"><span>Tiền cá thu lại</span><span>-${formatVND(bill.totalFish)}</span></div>
        <div class="bill-total">
          <span>${bill.amountDue >= 0 ? 'KHÁCH TRẢ THÊM' : 'HOÀN LẠI KHÁCH'}</span>
          <span class="${bill.amountDue >= 0 ? 'pay' : 'refund'}">${formatVND(Math.abs(bill.amountDue))}</span>
        </div>
      </div>
      <div class="bill-footer">Cảm ơn quý khách! Hẹn gặp lại 🎣</div>
    </div>
    <div style="display:flex;gap:10px;margin-top:20px">
      <button class="btn-submit" style="flex:1" onclick="finishAndPrint()">🖨️ Kết thúc & In Bill</button>
      <button class="btn-submit" style="flex:1;background:linear-gradient(135deg,var(--green-500),var(--green-600))" onclick="finishSession()">✅ Kết thúc</button>
    </div>`;
  openModal('finish-session');
}

function finishSession() {
  const ses = DB.sessions.find(s => s.id === currentSessionId);
  if (!ses) return;
  ses.status = 'completed'; ses.endTime = new Date().toISOString();
  DB.save(); closeModal('finish-session');
  showToast(`Ca ${ses.code} hoàn thành! ✅`, 'success'); renderAll();
}

function finishAndPrint() {
  const ses = DB.sessions.find(s => s.id === currentSessionId);
  if (!ses) return;
  ses.status = 'completed'; ses.endTime = new Date().toISOString();
  DB.save();
  printBill();
  closeModal('finish-session');
  showToast(`Ca ${ses.code} hoàn thành & đã in bill! 🖨️`, 'success'); renderAll();
}

function printBill() {
  const content = document.getElementById('bill-content');
  if (!content) return;
  const w = window.open('', '_blank', 'width=400,height=700');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Hóa đơn</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Courier New',monospace;padding:20px;max-width:350px;margin:0 auto;color:#000;background:#fff}
      .bill-preview{background:#fff!important;color:#000!important}
      .bill-header-info{text-align:center;padding-bottom:12px;border-bottom:2px dashed #000;margin-bottom:12px}
      .bill-logo{font-size:18px;font-weight:900;letter-spacing:2px}
      .bill-code{font-size:14px;font-weight:700;margin:4px 0}
      .bill-date{font-size:11px;color:#555}
      .bill-customer{padding:10px 0;border-bottom:1px dashed #999;margin-bottom:10px;font-size:12px;line-height:1.6}
      .bill-section-title{font-size:11px;font-weight:700;color:#333;margin:10px 0 6px;text-transform:uppercase;letter-spacing:1px}
      .bill-line{display:flex;justify-content:space-between;padding:3px 0;font-size:12px}
      .bill-empty{font-size:11px;color:#999;font-style:italic}
      .bill-summary{margin-top:12px;padding-top:12px;border-top:2px dashed #000}
      .bill-sum-line{display:flex;justify-content:space-between;padding:3px 0;font-size:12px}
      .bill-sum-line.deduct span:last-child{color:#c00}
      .bill-total{display:flex;justify-content:space-between;padding:10px 0;margin-top:8px;border-top:2px solid #000;font-size:16px;font-weight:900}
      .bill-total .pay{color:#000} .bill-total .refund{color:#c00}
      .bill-footer{text-align:center;margin-top:16px;font-size:11px;color:#666;border-top:1px dashed #999;padding-top:10px}
      @media print{body{padding:5px}}
    </style></head><body>${content.innerHTML}</body></html>`);
  w.document.close();
  setTimeout(() => { w.print(); }, 300);
}

// ============================================
// PRODUCTS & FISH TYPES
// ============================================
function addProduct() {
  const name = document.getElementById('prod-name').value.trim();
  const price = parseInt(document.getElementById('prod-price').value||0);
  if (!name || price <= 0) { showToast('Nhập đầy đủ!','error'); return; }
  DB.products.push({ id:'p'+Date.now(), name, price, category:document.getElementById('prod-category').value, status:'active' });
  DB.save(); document.getElementById('prod-name').value=''; document.getElementById('prod-price').value='';
  populateProductSelect(); closeModal('add-product');
  showToast(`Đã thêm "${name}" ✅`, 'success');
}
function addFishType() {
  const name = document.getElementById('fish-type-name').value.trim();
  const price = parseInt(document.getElementById('fish-buyback-price').value||0);
  if (!name || price <= 0) { showToast('Nhập đầy đủ!','error'); return; }
  DB.fishTypes.push({id:'f'+Date.now(), name, pricePerKg:price, active:true});
  DB.save(); document.getElementById('fish-type-name').value=''; document.getElementById('fish-buyback-price').value='';
  renderFishTypeList(); showToast(`Đã thêm "${name}" ✅`, 'success');
}
function renderFishTypeList() {
  const el = document.getElementById('fish-type-list');
  if (!DB.fishTypes.length) { el.innerHTML = '<p style="color:var(--gray-500);text-align:center;font-size:0.85rem">Chưa có loại cá</p>'; return; }
  el.innerHTML = DB.fishTypes.map(f => `<div class="leader-row"><span class="leader-info"><span class="leader-name">🐟 ${f.name}</span><span class="leader-phone">${f.active?'Đang áp dụng':'Ngừng'}</span></span><span class="leader-weight">${formatVND(f.pricePerKg)}<span>/kg</span></span></div>`).join('');
}

// ============================================
// LEADERBOARD
// ============================================
function updateLeaderboard(name, phone, weight) {
  const today = new Date().toDateString();
  let e = DB.leaderboard.find(l => l.name === name && l.date === today);
  if (e) { e.totalKg += weight; if (weight > e.biggestCatch) e.biggestCatch = weight; }
  else DB.leaderboard.push({name, phone:phone||'', totalKg:weight, biggestCatch:weight, date:today});
  DB.save();
}
function renderLeaderboard() {
  const today = new Date().toDateString();
  const data = DB.leaderboard.filter(l => l.date === today).sort((a,b) => b.biggestCatch - a.biggestCatch).slice(0,5);
  const c = document.getElementById('leaderboard-list');
  if (!data.length) { c.innerHTML = '<div class="empty-state" style="padding:24px"><p>Chưa có dữ liệu hôm nay</p></div>'; return; }
  const ranks = ['gold','silver','bronze','normal','normal'], medals = ['🥇','🥈','🥉','4','5'];
  c.innerHTML = data.map((l,i) => `<div class="leader-row"><div class="leader-rank ${ranks[i]}">${medals[i]}</div><div class="leader-info"><div class="leader-name">${l.name}</div><div class="leader-phone">${l.phone||'N/A'} · Tổng ${l.totalKg.toFixed(1)}kg</div></div><div class="leader-weight">${l.biggestCatch.toFixed(1)}<span>kg</span></div></div>`).join('');
}

// ============================================
// RENDER
// ============================================
function renderAll() { renderStats(); renderSessions(); renderLeaderboard(); }

function renderStats() {
  const today = new Date().toDateString();
  const ts = DB.sessions.filter(s => new Date(s.startTime).toDateString() === today);
  document.getElementById('stat-active').textContent = ts.filter(s => s.status === 'fishing').length;
  document.getElementById('stat-done').textContent = ts.filter(s => s.status === 'completed').length;
  document.getElementById('stat-fish').textContent = ts.reduce((s,x) => s + x.fishWeightKg, 0).toFixed(1);
  document.getElementById('stat-remain').textContent = DB.pondStock;
}

function renderSessions() {
  const grid = document.getElementById('sessions-grid');
  const active = DB.sessions.filter(s => s.status === 'fishing');
  if (!active.length) { grid.innerHTML = '<div class="empty-state"><div class="icon">🎣</div><p>Chưa có ca câu. Bấm <strong>"Tạo đơn câu"</strong> để bắt đầu!</p></div>'; return; }
  grid.innerHTML = active.map(ses => {
    const totalOrders = ses.orders.reduce((s,o) => s + o.total, 0);
    const ticket = ses.ticketPrice || 0;
    return `<div class="session-card" id="card-${ses.id}">
      <div class="session-header"><span class="session-code">${ses.code}</span><span class="session-status fishing">● Đang câu</span></div>
      <div class="session-body">
        <div class="session-customer">${ses.customerName}</div>
        <div class="session-phone">📞 ${ses.customerPhone||'N/A'}${ses.notes?' · '+ses.notes:''}</div>
        <div class="countdown-wrap"><span class="countdown-icon">⏱️</span><div><div class="countdown-timer" id="timer-${ses.id}">--:--:--</div><div class="countdown-label">Gói ${ses.durationMin/60}h · Hết ${new Date(ses.endTime).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</div></div></div>
        <div class="session-info-grid">
          <div class="session-info-item"><span class="label">Giá vé</span><br><span class="value">${formatVND(ticket)}</span></div>
          <div class="session-info-item"><span class="label">Tiền cọc</span><br><span class="value">${formatVND(ses.deposit)}</span></div>
          <div class="session-info-item"><span class="label">Đồ ăn/nước</span><br><span class="value">${formatVND(totalOrders)}</span></div>
          <div class="session-info-item"><span class="label">Cá thu ${ses.fishWeightKg.toFixed(1)}kg</span><br><span class="value">${formatVND(ses.fishBuybackTotal)}</span></div>
        </div>
        <div class="session-actions">
          <button class="btn-session" onclick="openAddOrder('${ses.id}')">🍜 Thêm đồ</button>
          <button class="btn-session" onclick="openCollectFish('${ses.id}')">🐟 Thu cá</button>
          <button class="btn-session finish" onclick="openFinishSession('${ses.id}')">✅ Kết thúc</button>
        </div>
      </div>
    </div>`;
  }).join('');
  active.forEach(ses => updateCountdown(ses));
}

// ============================================
// COUNTDOWN
// ============================================
function updateAllCountdowns() { DB.sessions.filter(s => s.status === 'fishing').forEach(updateCountdown); }
function updateCountdown(ses) {
  const te = document.getElementById('timer-' + ses.id);
  const ce = document.getElementById('card-' + ses.id);
  if (!te || !ce) return;
  const diff = new Date(ses.endTime).getTime() - Date.now();
  if (diff <= 0) { te.textContent = 'HẾT GIỜ!'; ce.classList.add('warning'); return; }
  const h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000), s = Math.floor((diff%60000)/1000);
  te.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
  if (diff < 15*60000) ce.classList.add('warning'); else ce.classList.remove('warning');
}

// ============================================
// UTILS
// ============================================
function formatVND(n) { return new Intl.NumberFormat('vi-VN').format(n) + 'đ'; }
function pad(n) { return String(n).padStart(2,'0'); }
function fmtDateCode(d) { return d.getFullYear() + pad(d.getMonth()+1) + pad(d.getDate()); }
function showToast(msg, type='success') { const t=document.getElementById('toast'); if(!t) return; t.textContent=msg; t.className=`toast ${type} show`; setTimeout(()=>t.classList.remove('show'),3000); }
