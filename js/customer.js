// ============================================
// CUSTOMER — Data & Logic
// ============================================

let customers = [];
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await requireAuth();
  if (!currentUser) return;
  
  document.getElementById('topbar-name').textContent = currentUser.full_name;
  const roleEl = document.getElementById('topbar-role');
  roleEl.textContent = currentUser.role === 'admin' ? '👑 Admin' : '🎣 Chủ hồ';
  roleEl.className = 'user-role ' + currentUser.role;
  
  await loadCustomers();
  renderCustomers();
});

async function loadCustomers() {
  if (currentUser.is_demo) {
    customers = JSON.parse(localStorage.getItem('fm_customers') || '[]');
    return;
  }

  showToast('Đang tải khách hàng...', 'info');
  try {
    customers = await SupaDB.getCustomers(currentUser.id);
    localStorage.setItem('fm_customers', JSON.stringify(customers));
  } catch (err) {
    console.error("Load customers failed:", err);
    showToast('Lỗi tải khách hàng từ Cloud!', 'error');
    customers = JSON.parse(localStorage.getItem('fm_customers') || '[]');
  }
}

function renderCustomers() {
  const list = document.getElementById('customer-list');
  const query = document.getElementById('search-customer').value.toLowerCase();
  
  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(query) || 
    (c.phone && c.phone.includes(query))
  );
  
  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state">
      <p>${query ? 'Không tìm thấy khách hàng nào khớp' : 'Chưa có khách hàng nào. Hãy thêm khách hàng đầu tiên!'}</p>
    </div>`;
    return;
  }
  
  // Get sessions to count frequency
  const sessions = JSON.parse(localStorage.getItem('fm_sessions') || '[]');
  
  list.innerHTML = filtered.map(c => {
    const custSessions = sessions.filter(s => s.customerPhone === c.phone || s.customerName === c.name);
    const totalKg = custSessions.reduce((sum, s) => sum + (s.fishWeightKg || 0), 0);
    
    return `
      <div class="customer-item">
        <div class="customer-info">
          <h3>${c.name}</h3>
          <p>📞 ${c.phone || 'N/A'}</p>
          <p style="font-size: 0.75rem; font-style: italic; color: var(--gray-400)">${c.notes || 'Không có ghi chú'}</p>
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

async function addCustomer() {
  const name = document.getElementById('cust-name').value.trim();
  const phone = document.getElementById('cust-phone').value.trim();
  const notes = document.getElementById('cust-notes').value.trim();
  
  if (!name) {
    showToast('Vui lòng nhập tên khách hàng!', 'error');
    return;
  }
  
  const exists = customers.find(c => phone && c.phone === phone);
  if (exists) {
    showToast('Số điện thoại này đã tồn tại!', 'error');
    return;
  }

  showToast('Đang lưu khách hàng...', 'info');
  
  try {
    let cloudCust = null;
    if (!currentUser.is_demo) {
      cloudCust = await SupaDB.addCustomer(currentUser.id, name, phone, notes);
    }

    const newCust = {
      id: cloudCust ? cloudCust.id : 'cust_' + Date.now(),
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
  } catch (err) {
    console.error("Add customer failed:", err);
    showToast('Lỗi khi thêm khách hàng lên Cloud!', 'error');
  }
}

function openModal(n) { document.getElementById('modal-' + n).classList.add('active'); }
function closeModal(n) { document.getElementById('modal-' + n).classList.remove('active'); }

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 3000);
}
