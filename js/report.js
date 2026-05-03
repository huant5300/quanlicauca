// ============================================
// REPORT — Business Logic
// ============================================
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await requireAuth();
  if (!currentUser) return;
  
  document.getElementById('topbar-name').textContent = currentUser.full_name;
  const roleEl = document.getElementById('topbar-role');
  roleEl.textContent = currentUser.role === 'admin' ? '👑 Admin' : '🎣 Chủ hồ';
  roleEl.className = 'user-role ' + currentUser.role;
  
  document.getElementById('report-date').textContent = new Date().toLocaleDateString('vi-VN');
  
  await renderReport();
});

async function renderReport() {
  let sessions = [];
  
  if (currentUser.is_demo) {
    sessions = JSON.parse(localStorage.getItem('fm_sessions') || '[]');
  } else {
    showToast('Đang tải báo cáo...', 'info');
    try {
      const reportData = await SupaDB.getDailyReport(currentUser.id, new Date());
      if (reportData) {
        // Map cloud report to local format
        sessions = reportData.sessions.map(s => {
          const sOrders = reportData.orders.filter(o => o.session_id === s.id);
          const sFish = reportData.fish.filter(f => f.session_id === s.id);
          
          return {
            ...s,
            code: s.session_code,
            customerName: s.customer_name,
            ticketPrice: s.ticket_price,
            fishBuybackTotal: s.fish_buyback_total,
            fishWeightKg: s.fish_weight_kg,
            orders: sOrders.map(o => ({ total: o.total_price })),
            fishItems: sFish
          };
        });
      }
    } catch (err) {
      console.error("Report fetch failed:", err);
      showToast('Lỗi tải báo cáo từ Cloud!', 'error');
      // Fallback to local
      sessions = JSON.parse(localStorage.getItem('fm_sessions') || '[]');
    }
  }

  const today = new Date().toDateString();
  const todaySessions = sessions.filter(s => new Date(s.startTime || s.start_time).toDateString() === today);
  
  let totalRevenue = 0;
  let totalExpense = 0;
  let totalFishKg = 0;
  
  const tbody = document.getElementById('report-table-body');
  if (!todaySessions.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--gray-400)">Chưa có dữ liệu hôm nay</td></tr>';
    return;
  }
  
  tbody.innerHTML = todaySessions.map(ses => {
    const revenue = (ses.ticketPrice || 0) + (ses.orders ? ses.orders.reduce((sum, o) => sum + o.total, 0) : 0);
    const expense = ses.fishBuybackTotal || 0;
    
    totalRevenue += revenue;
    totalExpense += expense;
    totalFishKg += (ses.fishWeightKg || 0);
    
    return `
      <tr>
        <td><strong>${ses.code}</strong></td>
        <td>${ses.customerName}</td>
        <td>${new Date(ses.startTime || ses.start_time).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}</td>
        <td style="color:var(--green-600);font-weight:600">${formatVND(revenue)}</td>
        <td style="color:var(--red-600)">${formatVND(expense)}</td>
        <td><span class="tag-completed">${ses.status === 'completed' ? 'Hoàn thành' : 'Đang câu'}</span></td>
      </tr>
    `;
  }).join('');
  
  document.getElementById('total-revenue').textContent = formatVND(totalRevenue);
  document.getElementById('total-expense').textContent = formatVND(totalExpense);
  document.getElementById('net-profit').textContent = formatVND(totalRevenue - totalExpense);
  document.getElementById('total-fish').textContent = totalFishKg.toFixed(1) + 'kg';
}

function formatVND(n) {
  return new Intl.NumberFormat('vi-VN').format(n) + 'đ';
}

function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 3000);
}
