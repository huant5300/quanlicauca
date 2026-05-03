# HƯỚNG DẪN CẤU HÌNH GOOGLE AUTH — FISHING MASTER

Nếu bạn vẫn gặp lỗi khi bấm nút "Đăng nhập với Google", hãy kiểm tra chính xác các thông số sau trong Dashboard của Supabase và Google Cloud.

## 1. Supabase Dashboard
Truy cập: [https://supabase.com/dashboard/project/mwhbztyfkeyqrerancmb/auth/providers](https://supabase.com/dashboard/project/mwhbztyfkeyqrerancmb/auth/providers)

### Cấu hình Google Provider:
- **Status**: Enabled (Phải có màu xanh)
- **Client ID**: Lấy từ Google Cloud Console (xem phần 2 bên dưới)
- **Client Secret**: Lấy từ Google Cloud Console
- **Skip nonce check**: Để mặc định (thường là off)

### Cấu hình URL (Redirect URLs):
Truy cập: [https://supabase.com/dashboard/project/mwhbztyfkeyqrerancmb/auth/url-configuration](https://supabase.com/dashboard/project/mwhbztyfkeyqrerancmb/auth/url-configuration)
- **Site URL**: `http://localhost:5000` (hoặc domain Vercel của bạn)
- **Redirect URLs**: Thêm dòng này -> `http://localhost:5000/dashboard.html`
- **Redirect URLs**: Thêm dòng này -> `http://localhost:5000/`

---

## 2. Google Cloud Console
Truy cập: [https://console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)

### Tạo OAuth 2.0 Client ID:
1. Click **Create Credentials** -> **OAuth client ID**.
2. **Application type**: Web application.
3. **Name**: `Fishing Master Auth`.
4. **Authorized JavaScript origins**:
   - `http://localhost:5000`
   - `https://mwhbztyfkeyqrerancmb.supabase.co`
5. **Authorized redirect URIs** (QUAN TRỌNG NHẤT):
   - `https://mwhbztyfkeyqrerancmb.supabase.co/auth/v1/callback`

---

## 3. Cách kiểm tra lỗi (Debug)
1. Mở trình duyệt, nhấn **F12** để mở Console.
2. Bấm nút đăng nhập.
3. Nếu có lỗi, hãy nhìn vào tab **Console**.
   - Nếu lỗi là `400: redirect_uri_mismatch`: Bạn chưa cấu hình đúng mục số 5 ở phần Google Cloud Console.
   - Nếu lỗi là `provider_not_enabled`: Bạn chưa bật Google trong Supabase.

---

## 4. Lưu ý về protocol
Không được mở file bằng cách click đúp (ví dụ: `C:\Users\...\login.html`).
Hãy chạy lệnh này trong terminal để khởi động server:
```bash
npm run dev
```
Sau đó truy cập: [http://localhost:5000/login.html](http://localhost:5000/login.html)
