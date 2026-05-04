// ============================================
// SUPABASE CLIENT — Data Access Layer
// ============================================
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SupaDB = {
  // ---- AUTH ----
  async signInWithGoogle(redirectTo) {
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo || window.location.origin + '/dashboard.html' }
    });
    if (error) throw error;
    return data;
  },
  async signOut() {
    await supabaseClient.auth.signOut();
  },
  async getUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user;
  },
  async getProfile(userId) {
    const { data } = await supabaseClient.from('profiles').select('*').eq('id', userId).single();
    return data;
  },
  async createProfile(profile) {
    const { data, error } = await supabaseClient.from('profiles').insert(profile).select().single();
    if (error) throw error;
    return data;
  },
  async initializePondStock(userId) {
    const { data, error } = await supabaseClient.from('pond_stock').insert({ user_id: userId, stock_kg: 500 }).select().single();
    if (error) return null; // Might already exist
    return data;
  },
  onAuthChange(callback) {
    supabaseClient.auth.onAuthStateChange(callback);
  },

  // ---- PRODUCTS ----
  async getProducts(userId) {
    const { data } = await supabaseClient.from('products').select('*').eq('user_id', userId).eq('business_status', 'active').order('name');
    return data || [];
  },
  async addProduct(userId, name, price, category) {
    const { data, error } = await supabaseClient.from('products').insert({ user_id: userId, name, price, category }).select().single();
    if (error) throw error;
    return data;
  },

  // ---- FISH BUYBACK ----
  async getFishTypes(userId) {
    const { data } = await supabaseClient.from('fish_buyback').select('*').eq('user_id', userId).eq('is_active', true).order('fish_type');
    return data || [];
  },
  async addFishType(userId, fishType, pricePerKg) {
    const { data, error } = await supabaseClient.from('fish_buyback').insert({ user_id: userId, fish_type: fishType, buyback_price_per_kg: pricePerKg }).select().single();
    if (error) throw error;
    return data;
  },

  // ---- SESSIONS ----
  async getSessions(userId, status) {
    let q = supabaseClient.from('sessions').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data } = await q;
    return data || [];
  },
  async getTodaySessions(userId) {
    const today = new Date(); today.setHours(0,0,0,0);
    let q = supabaseClient.from('sessions').select('*').eq('user_id', userId).gte('created_at', today.toISOString()).order('created_at', { ascending: false });
    const { data } = await q;
    return data || [];
  },
  async createSession(session) {
    const { data, error } = await supabaseClient.from('sessions').insert(session).select().single();
    if (error) throw error;
    return data;
  },
  async updateSession(id, updates) {
    const { data, error } = await supabaseClient.from('sessions').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // ---- ORDERS ----
  async getOrders(sessionId) {
    const { data } = await supabaseClient.from('orders').select('*').eq('session_id', sessionId).order('order_time');
    return data || [];
  },
  async addOrder(order) {
    const { data, error } = await supabaseClient.from('orders').insert(order).select().single();
    if (error) throw error;
    return data;
  },

  // ---- SESSION FISH ----
  async getSessionFish(sessionId) {
    const { data } = await supabaseClient.from('session_fish').select('*').eq('session_id', sessionId).order('created_at');
    return data || [];
  },
  async addSessionFish(item) {
    const { data, error } = await supabaseClient.from('session_fish').insert(item).select().single();
    if (error) throw error;
    return data;
  },

  // ---- POND STOCK ----
  async getPondStock(userId) {
    const { data } = await supabaseClient.from('pond_stock').select('stock_kg').eq('user_id', userId).single();
    return data ? data.stock_kg : 500;
  },
  async updatePondStock(userId, newStock) {
    await supabaseClient.from('pond_stock').update({ stock_kg: newStock, updated_at: new Date().toISOString() }).eq('user_id', userId);
  },

  // ---- CUSTOMERS ----
  async getCustomers(userId) {
    const { data } = await supabaseClient.from('customers').select('*').eq('user_id', userId).order('name');
    return data || [];
  },
  async addCustomer(userId, name, phone, notes) {
    const { data, error } = await supabaseClient.from('customers').insert({ user_id: userId, name, phone, notes }).select().single();
    if (error) throw error;
    return data;
  },

  // ---- ADMIN SPECIAL ----
  async getAllProfiles() {
    const { data, error } = await supabaseClient.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  async getAllSessions() {
    const { data, error } = await supabaseClient.from('sessions').select('*, profiles(full_name, email)').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // ---- REPORTS ----
  async getDailyReport(userId, date) {
    const start = new Date(date); start.setHours(0,0,0,0);
    const end = new Date(date); end.setHours(23,59,59,999);
    
    let q = supabaseClient.from('sessions').select('*');
    if (userId) q = q.eq('user_id', userId);
    
    const { data: sessions } = await q.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
    
    if (!sessions || !sessions.length) return null;
    const sessionIds = sessions.map(s => s.id);
    const { data: allOrders } = await supabaseClient.from('orders').select('*').in('session_id', sessionIds);
    const { data: allFish } = await supabaseClient.from('session_fish').select('*').in('session_id', sessionIds);
    return { sessions, orders: allOrders || [], fish: allFish || [] };
  }
};
