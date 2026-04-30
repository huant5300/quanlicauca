// ============================================
// SYNC — Đồng bộ dữ liệu Local lên Supabase Cloud
// ============================================

async function syncToCloud() {
  const user = await checkAuth();
  if (!user) {
    showToast('Vui lòng đăng nhập để đồng bộ!', 'error');
    return;
  }
  if (user.is_demo) {
    showToast('Tài khoản Demo không thể đồng bộ lên Cloud!', 'error');
    return;
  }

  const btn = document.getElementById('btn-sync');
  if (btn) btn.innerHTML = '⏳ Đang đồng bộ...';

  try {
    // 1. Kiểm tra xem các bảng trên Supabase đã được tạo chưa
    const { error: checkErr } = await supabase.from('products').select('id').limit(1);
    if (checkErr && checkErr.code === '42P01') { // relation does not exist
      alert('LỖI: Chưa tạo bảng trên Supabase!\n\nVui lòng copy nội dung file "database/supabase-migration.sql" và chạy trong phần SQL Editor của Supabase trước khi đồng bộ.');
      if (btn) btn.innerHTML = '☁️ Đồng bộ Cloud';
      return;
    }

    // 2. Lấy dữ liệu LocalStorage
    const localProducts = JSON.parse(localStorage.getItem('fm_products') || '[]');
    const localFish = JSON.parse(localStorage.getItem('fm_fish_types') || '[]');
    const localSessions = JSON.parse(localStorage.getItem('fm_sessions') || '[]');
    const pondStock = parseInt(localStorage.getItem('fm_pond_stock') || '500');

    let syncedSessions = 0;

    // 3. Cập nhật tồn kho cá
    await SupaDB.updatePondStock(user.id, pondStock);

    // 4. Đồng bộ Products
    // Lấy product hiện tại trên cloud để tránh trùng tên
    const cloudProducts = await SupaDB.getProducts(user.id);
    const prodIdMap = {}; // Map local ID -> Cloud ID
    
    for (const lp of localProducts) {
      let cp = cloudProducts.find(c => c.name === lp.name);
      if (!cp) {
        cp = await SupaDB.addProduct(user.id, lp.name, lp.price, lp.category);
      }
      prodIdMap[lp.id] = cp.id;
    }

    // 5. Đồng bộ Fish Types
    const cloudFish = await SupaDB.getFishTypes(user.id);
    const fishIdMap = {};
    for (const lf of localFish) {
      let cf = cloudFish.find(c => c.fish_type === lf.name);
      if (!cf) {
        cf = await SupaDB.addFishType(user.id, lf.name, lf.pricePerKg);
      }
      fishIdMap[lf.id] = cf.id;
    }

    // 6. Đồng bộ Sessions
    // Lấy danh sách session đã đồng bộ (kiểm tra theo session_code)
    const cloudSessions = await SupaDB.getSessions(user.id);
    
    for (const ls of localSessions) {
      const exists = cloudSessions.find(c => c.session_code === ls.code);
      if (exists) continue; // Bỏ qua nếu đã đồng bộ

      // Đẩy Session
      const sessionData = {
        session_code: ls.code,
        user_id: user.id,
        customer_name: ls.customerName,
        customer_phone: ls.customerPhone || '',
        start_time: ls.startTime,
        end_time: ls.endTime || null,
        duration_min: ls.durationMin || 120,
        ticket_price: ls.ticketPrice || 0,
        deposit: ls.deposit || 0,
        fish_weight_kg: ls.fishWeightKg || 0,
        fish_buyback_total: ls.fishBuybackTotal || 0,
        status: ls.status,
        notes: ls.notes || ''
      };
      
      const newSession = await SupaDB.createSession(sessionData);

      // Đẩy Orders cho Session này
      if (ls.orders && ls.orders.length > 0) {
        for (const lo of ls.orders) {
          // Lấy ID product mới trên cloud, nếu ko có thì dùng mặc định
          const cloudProdId = prodIdMap[lo.productId];
          if (cloudProdId) {
            await SupaDB.addOrder({
              session_id: newSession.id,
              product_id: cloudProdId,
              product_name: lo.productName,
              quantity: lo.qty,
              unit_price: lo.unitPrice,
              total_price: lo.total,
              order_time: lo.time || new Date().toISOString()
            });
          }
        }
      }

      // Đẩy Session Fish cho Session này
      if (ls.fishItems && ls.fishItems.length > 0) {
        for (const lf of ls.fishItems) {
          const cloudFishId = fishIdMap[lf.fishTypeId];
          if (cloudFishId) {
            await SupaDB.addSessionFish({
              session_id: newSession.id,
              fish_buyback_id: cloudFishId,
              fish_name: lf.fishName,
              weight_kg: lf.weightKg,
              price_per_kg: lf.pricePerKg,
              subtotal: lf.subtotal
            });
          }
        }
      }
      
      syncedSessions++;
    }

    if (syncedSessions > 0) {
      showToast(`Đã đồng bộ thành công ${syncedSessions} ca câu lên Cloud! ☁️`, 'success');
    } else {
      showToast('Dữ liệu đã được đồng bộ mới nhất!', 'success');
    }

  } catch (err) {
    console.error("Sync error:", err);
    showToast('Lỗi đồng bộ: ' + err.message, 'error');
  } finally {
    if (btn) btn.innerHTML = '☁️ Đồng bộ Cloud';
  }
}
