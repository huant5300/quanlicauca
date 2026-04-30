// ============================================
// AUTH — Supabase Google Authentication
// ============================================

// ============================================
// GOOGLE LOGIN via Supabase
// ============================================
async function handleGoogleLogin() {
  const loginButtons = document.getElementById('login-buttons');
  const loginLoading = document.getElementById('login-loading');
  if (loginButtons) loginButtons.style.display = 'none';
  if (loginLoading) loginLoading.classList.add('active');

  try {
    await SupaDB.signInWithGoogle();
    // Redirect sẽ do Supabase xử lý
  } catch (err) {
    showToast('Lỗi đăng nhập: ' + err.message, 'error');
    if (loginButtons) loginButtons.style.display = '';
    if (loginLoading) loginLoading.classList.remove('active');
  }
}

// ============================================
// CHECK AUTH on page load
// ============================================
async function checkAuth() {
  const user = await SupaDB.getUser();
  if (!user) return null;
  const profile = await SupaDB.getProfile(user.id);
  return profile ? { ...user, ...profile } : null;
}

async function requireAuth() {
  const user = await checkAuth();
  if (!user) { window.location.href = 'login.html'; return null; }
  return user;
}

// ============================================
// DEMO LOGIN (fallback khi chưa cấu hình Supabase)
// ============================================
function demoLogin(role) {
  const loginButtons = document.getElementById('login-buttons');
  const loginLoading = document.getElementById('login-loading');
  if (loginButtons) loginButtons.style.display = 'none';
  if (loginLoading) loginLoading.classList.add('active');

  setTimeout(() => {
    const user = {
      id: 'demo_' + role,
      email: role === 'admin' ? ADMIN_EMAIL : 'demo_owner@gmail.com',
      full_name: role === 'admin' ? 'Huân (Admin)' : 'Nguyễn Văn Hồ Câu',
      role: role,
      login_time: new Date().toISOString(),
      is_demo: true,
    };
    localStorage.setItem('fm_demo_user', JSON.stringify(user));
    showToast(`Demo ${role === 'admin' ? 'Admin 🔑' : 'Chủ hồ 🎣'}`, 'success');
    setTimeout(() => window.location.href = 'dashboard.html', 800);
  }, 800);
}

// ============================================
// LOGOUT
// ============================================
async function handleLogout() {
  localStorage.removeItem('fm_demo_user');
  try { await SupaDB.signOut(); } catch(e) {}
  showToast('Đã đăng xuất', 'success');
  setTimeout(() => window.location.href = 'index.html', 500);
}

// ============================================
// AUTH INIT — Check on login page load
// ============================================
async function initLoginPage() {
  // Check if already logged in
  const user = await SupaDB.getUser();
  if (user) {
    window.location.href = 'dashboard.html';
    return;
  }
  // Check demo user
  const demo = JSON.parse(localStorage.getItem('fm_demo_user') || 'null');
  if (demo) {
    window.location.href = 'dashboard.html';
  }
}

// ============================================
// TOAST
// ============================================
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 3000);
}
