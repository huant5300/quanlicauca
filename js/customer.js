// ============================================
// CUSTOMER — Data & Logic
// ============================================

let customers = JSON.parse(localStorage.getItem('fm_customers') || '[]');

document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireAuth();
  if (!user) return;
  
  document.getElementById('topbar-name').textContent = user.full_name;
  const roleEl = document.getElementById('topbar-role');
  roleEl.textContent = user.role === 'admin' ? '👑 Admin' : '🎣 Chủ hồ';
  roleEl.className = 'user-role ' + user.role;
  
  renderCustomers();
});

function renderCustomers() {
  const list = document.getElementById('customer-list');
  const query = document.getElementById('search-customer').value.toLowerCase();
  
  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(query) || 
    c.phone.includes(query)
  );
  
  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state">
      <p>${query ? 'Không tìm thấy khách hàng nào khớp' : 'Chưa có khách hàng nào. Hãy thêm khách hàng đầu tiên!'}</p>
    </div>`;
    return;
  }
  
  // Get sessions to count frequency (optional optimization)
  const sessions = JSON.parse(localStorage.getItem('fm_sessions') || '[]');
  
  list.innerHTML = filtered.map(c => {
    const custSessions = sessions.filter(s => s.customerPhone === c.phone || s.customerName === c.name);
    const totalKg = custSessions.reduce((sum, s) => sum + (s.fishWeightKg || 0), 0);
    
    return `
      <div class="customer-item">
        <div class="customer-info">
          <h3>${c.name}</h3>
          <p>📞 ${c.phone}</p>
          <p style="font-size: 0.75rem; font-style: italic;">${c.notes || 'Không có ghi chú'}</p>
        </div>
        <div class="customer-stats">
          <div class="stat-box">
            <span class="stat-label">Số lần câu</span>
            <span class="stat-val">${custSessions.length} lần</span>
          </div>
          <div class="stat-box">
            <span class="stat-label">Tổng cá câu</span>
            <span class="stat-val">${totalKg.toFixed(1)}kg</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function addCustomer() {
  const name = document.getElementById('cust-name').value.trim();
  const phone = document.getElementById('cust-phone').value.trim();
  const notes = document.getElementById('cust-notes').value.trim();
  
  if (!name || !phone) {
    showToast('Vui lòng nhập tên và số điện thoại!', 'error');
    return;
  }
  
  const exists = customers.find(c => c.phone === phone);
  if (exists) {
    showToast('Số điện thoại này đã tồn tại!', 'error');
    return;
  }
  
  const newCust = {
    id: 'cust_' + Date.now(),
    name,
    phone,
    notes,
    createdAt: new Date().toISOString()
  };
  
  customers.push(newCust);
  localStorage.setItem('fm_customers', JSON.stringify(customers));
  
  document.getElementById('cust-name').value = '';
  document.getElementById('cust-phone').value = '';
  document.getElementById('cust-notes').value = '';
  
  closeModal('add-customer');
  showToast('Đã thêm khách hàng thành công!', 'success');
  renderCustomers();
}

function openModal(n) { document.getElementById('modal-' + n).classList.add('active'); }
function closeModal(n) { document.getElementById('modal-' + n).classList.remove('active'); }

// Close modal on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});
