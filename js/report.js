// ============================================
// REPORT — Business Logic
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireAuth();
  if (!user) return;
  
  document.getElementById('topbar-name').textContent = user.full_name;
  const roleEl = document.getElementById('topbar-role');
  roleEl.textContent = user.role === 'admin' ? '👑 Admin' : '🎣 Chủ hồ';
  roleEl.className = 'user-role ' + user.role;
  
  document.getElementById('report-date').textContent = new Date().toLocaleDateString('vi-VN');
  
  renderReport();
});

function renderReport() {
  const sessions = JSON.parse(localStorage.getItem('fm_sessions') || '[]');
  const today = new Date().toDateString();
  const todaySessions = sessions.filter(s => new Date(s.startTime).toDateString() === today);
  
  let totalRevenue = 0;
  let totalExpense = 0;
  let totalFishKg = 0;
  
  const tbody = document.getElementById('report-table-body');
  if (!todaySessions.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--gray-400)">Chưa có dữ liệu hôm nay</td></tr>';
    return;
  }
  
  tbody.innerHTML = todaySessions.map(ses => {
    const revenue = (ses.ticketPrice || 0) + ses.orders.reduce((sum, o) => sum + o.total, 0);
    const expense = ses.fishBuybackTotal || 0;
    
    totalRevenue += revenue;
    totalExpense += expense;
    totalFishKg += (ses.fishWeightKg || 0);
    
    return `
      <tr>
        <td><strong>${ses.code}</strong></td>
        <td>${ses.customerName}</td>
        <td>${new Date(ses.startTime).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}</td>
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
