// ============================================
// AUTH — Supabase Google Authentication & Demo
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
    // Determine redirect URL based on current location
    const redirectUrl = window.location.origin + '/dashboard.html';
    console.log("Redirecting to:", redirectUrl);
    
    const { data, error } = await SupaDB.signInWithGoogle(redirectUrl);
    if (error) throw error;
    
    // In many environments, the redirect happens automatically.
    // If not, we use the URL from the response.
    if (data && data.url) {
      window.location.href = data.url;
    }
  } catch (err) {
    console.error("Login error:", err);
    showToast('Lỗi đăng nhập: ' + (err.message || 'Vui lòng kiểm tra cấu hình Supabase'), 'error');
    if (loginButtons) loginButtons.style.display = '';
    if (loginLoading) loginLoading.classList.remove('active');
  }
}

// ============================================
// CHECK AUTH on page load
// ============================================
async function checkAuth() {
  // 1. Check Supabase
  try {
    const user = await SupaDB.getUser();
    if (user) {
      const profile = await SupaDB.getProfile(user.id);
      
      // Normalize user data to ensure it works with dashboard display
      const fullUser = {
        id: user.id,
        email: user.email,
        full_name: (profile && profile.full_name) || 
                   (user.user_metadata && user.user_metadata.full_name) || 
                   (user.user_metadata && user.user_metadata.name) || 
                   user.email.split('@')[0],
        role: (profile && profile.role) || 'owner',
        is_demo: false,
        avatar_url: (user.user_metadata && user.user_metadata.avatar_url) || ''
      };
      
      localStorage.setItem('fm_user', JSON.stringify(fullUser));
      return fullUser;
    }
  } catch (e) {
    console.error("Supabase auth check failed:", e);
  }

  // 2. Check Demo User
  const demo = JSON.parse(localStorage.getItem('fm_demo_user') || 'null');
  if (demo) {
    localStorage.setItem('fm_user', JSON.stringify(demo));
    return demo;
  }

  return null;
}

async function requireAuth() {
  const user = await checkAuth();
  if (!user) { 
    window.location.href = 'login.html'; 
    return null; 
  }
  return user;
}

// ============================================
// DEMO LOGIN
// ============================================
function demoLogin(role) {
  const loginButtons = document.getElementById('login-buttons');
  const loginLoading = document.getElementById('login-loading');
  if (loginButtons) loginButtons.style.display = 'none';
  if (loginLoading) loginLoading.classList.add('active');

  setTimeout(() => {
    const user = {
      id: 'demo_' + role,
      email: role === 'admin' ? (typeof ADMIN_EMAIL !== 'undefined' ? ADMIN_EMAIL : 'admin@demo.com') : 'demo_owner@gmail.com',
      full_name: role === 'admin' ? 'Huân (Admin)' : 'Nguyễn Văn Hồ Câu',
      role: role,
      login_time: new Date().toISOString(),
      is_demo: true,
    };
    localStorage.setItem('fm_demo_user', JSON.stringify(user));
    localStorage.setItem('fm_user', JSON.stringify(user));
    showToast(`Demo ${role === 'admin' ? 'Admin 🔑' : 'Chủ hồ 🎣'}`, 'success');
    setTimeout(() => window.location.href = 'dashboard.html', 800);
  }, 800);
}

// ============================================
// LOGOUT
// ============================================
async function handleLogout() {
  localStorage.removeItem('fm_demo_user');
  localStorage.removeItem('fm_user');
  try { await SupaDB.signOut(); } catch(e) {}
  showToast('Đã đăng xuất', 'success');
  setTimeout(() => window.location.href = 'index.html', 500);
}

// ============================================
// AUTH INIT — Check on login page load
// ============================================
async function initLoginPage() {
  const user = await checkAuth();
  if (user) {
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


