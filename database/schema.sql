-- ============================================================
-- CƠ SỞ DỮ LIỆU: QUẢN LÝ HỒ CÂU (Fishing Pond Management)
-- Phiên bản: 1.0
-- Ngày tạo: 2026-04-30
-- ============================================================

-- ============================================================
-- BẢNG 1: USERS (Người dùng & Phân quyền)
-- Mục đích: Quản lý tài khoản Admin và Chủ hồ
-- ============================================================
CREATE TABLE IF NOT EXISTS Users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    username        TEXT    NOT NULL UNIQUE,
    password_hash   TEXT    NOT NULL,
    full_name       TEXT    NOT NULL,
    phone           TEXT,
    email           TEXT,
    role            TEXT    NOT NULL DEFAULT 'owner'
                            CHECK (role IN ('admin', 'owner')),
    is_active       INTEGER NOT NULL DEFAULT 1,        -- 1 = hoạt động, 0 = bị khóa
    created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Admin mặc định (mật khẩu cần hash khi triển khai thực tế)
-- INSERT INTO Users (username, password_hash, full_name, role)
-- VALUES ('admin', '<hashed_password>', 'Quản trị viên', 'admin');


-- ============================================================
-- BẢNG 2: PRODUCTS (Sản phẩm đồ ăn / nước uống)
-- Mục đích: Danh mục món ăn, nước uống bán tại hồ
-- ============================================================
CREATE TABLE IF NOT EXISTS Products (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL,                  -- Chủ hồ sở hữu sản phẩm
    name            TEXT    NOT NULL,
    price           REAL    NOT NULL CHECK (price >= 0),
    category        TEXT    DEFAULT 'other'
                            CHECK (category IN ('food', 'drink', 'other')),
    business_status TEXT    NOT NULL DEFAULT 'active'
                            CHECK (business_status IN ('active', 'inactive')),
    image_url       TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),

    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

CREATE INDEX idx_products_user ON Products(user_id);
CREATE INDEX idx_products_status ON Products(business_status);


-- ============================================================
-- BẢNG 3: FISH_BUYBACK (Bảng giá thu mua cá)
-- Mục đích: Quản lý giá thu mua lại cá theo từng loại
-- ============================================================
CREATE TABLE IF NOT EXISTS Fish_Buyback (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER NOT NULL,              -- Chủ hồ thiết lập giá
    fish_type           TEXT    NOT NULL,               -- Tên loại cá (Cá chép, Cá trắm, ...)
    buyback_price_per_kg REAL   NOT NULL CHECK (buyback_price_per_kg >= 0),
    is_active           INTEGER NOT NULL DEFAULT 1,    -- 1 = đang áp dụng
    created_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),

    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

CREATE INDEX idx_fish_buyback_user ON Fish_Buyback(user_id);


-- ============================================================
-- BẢNG 4: SESSIONS (Ca câu)
-- Mục đích: Quản lý từng ca câu của khách hàng
-- ============================================================
CREATE TABLE IF NOT EXISTS Sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_code    TEXT    NOT NULL UNIQUE,            -- Mã đơn (VD: CA-20260430-001)
    user_id         TEXT    NOT NULL,                  -- Chủ hồ quản lý ca này (đổi thành TEXT để khớp với Supabase Auth UUID)
    customer_name   TEXT    NOT NULL,                  -- Tên khách hàng
    customer_phone  TEXT,                              -- Số điện thoại khách
    start_time      TEXT    NOT NULL,                  -- Giờ bắt đầu ca câu
    end_time        TEXT,                              -- Giờ kết thúc (NULL nếu đang câu)
    duration_min    INTEGER NOT NULL DEFAULT 120,      -- Gói giờ câu (phút)
    ticket_price    REAL    NOT NULL DEFAULT 0,        -- Giá vé câu (VNĐ)
    deposit         REAL    NOT NULL DEFAULT 0         -- Tiền cọc (VNĐ)
                            CHECK (deposit >= 0),
    fish_weight_kg  REAL    DEFAULT 0                  -- Số kg cá thu lại
                            CHECK (fish_weight_kg >= 0),
    fish_buyback_total REAL DEFAULT 0                  -- Tổng tiền thu mua cá (tự tính)
                            CHECK (fish_buyback_total >= 0),
    status          TEXT    NOT NULL DEFAULT 'fishing'
                            CHECK (status IN ('fishing', 'completed', 'cancelled')),
    notes           TEXT,                              -- Ghi chú thêm
    created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);


CREATE INDEX idx_sessions_user ON Sessions(user_id);
CREATE INDEX idx_sessions_status ON Sessions(status);
CREATE INDEX idx_sessions_code ON Sessions(session_code);
CREATE INDEX idx_sessions_date ON Sessions(created_at);


-- ============================================================
-- BẢNG 5: SESSION_FISH (Chi tiết cá thu mua trong mỗi ca)
-- Mục đích: Ghi nhận từng loại cá khách bán lại trong 1 ca
-- Bảng phụ trợ giúp tính toán chính xác
-- ============================================================
CREATE TABLE IF NOT EXISTS Session_Fish (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      INTEGER NOT NULL,
    fish_buyback_id INTEGER NOT NULL,                  -- Loại cá (FK -> Fish_Buyback)
    weight_kg       REAL    NOT NULL CHECK (weight_kg > 0),
    price_per_kg    REAL    NOT NULL CHECK (price_per_kg >= 0),  -- Giá tại thời điểm thu mua
    subtotal        REAL    NOT NULL CHECK (subtotal >= 0),      -- = weight_kg * price_per_kg
    created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),

    FOREIGN KEY (session_id)      REFERENCES Sessions(id)      ON DELETE CASCADE,
    FOREIGN KEY (fish_buyback_id) REFERENCES Fish_Buyback(id)   ON DELETE RESTRICT
);

CREATE INDEX idx_session_fish_session ON Session_Fish(session_id);


-- ============================================================
-- BẢNG 6: ORDERS (Đơn đặt đồ ăn/nước uống trong ca)
-- Mục đích: Lưu danh sách các món khách gọi thêm
-- ============================================================
CREATE TABLE IF NOT EXISTS Orders (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      INTEGER NOT NULL,                  -- Ca câu liên quan
    product_id      INTEGER NOT NULL,                  -- Món đã gọi
    quantity        INTEGER NOT NULL DEFAULT 1
                            CHECK (quantity > 0),
    unit_price      REAL    NOT NULL CHECK (unit_price >= 0),   -- Giá tại thời điểm đặt
    total_price     REAL    NOT NULL CHECK (total_price >= 0),  -- = quantity * unit_price
    order_time      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),

    FOREIGN KEY (session_id) REFERENCES Sessions(id)  ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES Products(id)  ON DELETE RESTRICT
);

CREATE INDEX idx_orders_session ON Orders(session_id);
CREATE INDEX idx_orders_product ON Orders(product_id);


-- ============================================================
-- VIEW: TỔNG HỢP THANH TOÁN CA CÂU
-- Mục đích: Tính tổng tiền 1 ca câu (đồ ăn + cá thu mua - cọc)
-- ============================================================
CREATE VIEW IF NOT EXISTS V_Session_Summary AS
SELECT
    s.id                AS session_id,
    s.session_code,
    s.customer_name,
    s.customer_phone,
    s.start_time,
    s.end_time,
    s.deposit,
    s.status,
    s.fish_weight_kg,
    s.user_id,

    -- Tổng tiền đồ ăn/nước uống
    COALESCE(ord.total_food, 0)     AS total_food_drink,

    -- Tổng tiền thu mua cá
    COALESCE(fish.total_buyback, 0) AS total_fish_buyback,

    -- Tổng thanh toán = Đồ ăn - Tiền cá thu lại - Tiền cọc
    (COALESCE(ord.total_food, 0) 
     - COALESCE(fish.total_buyback, 0) 
     - s.deposit)                   AS amount_due

FROM Sessions s

LEFT JOIN (
    SELECT session_id, SUM(total_price) AS total_food
    FROM Orders
    GROUP BY session_id
) ord ON ord.session_id = s.id

LEFT JOIN (
    SELECT session_id, SUM(subtotal) AS total_buyback
    FROM Session_Fish
    GROUP BY session_id
) fish ON fish.session_id = s.id;


-- ============================================================
-- VIEW: BÁO CÁO DOANH THU THEO NGÀY
-- Mục đích: Thống kê nhanh doanh thu mỗi ngày
-- ============================================================
CREATE VIEW IF NOT EXISTS V_Daily_Revenue AS
SELECT
    DATE(s.created_at)              AS report_date,
    s.user_id,
    COUNT(s.id)                     AS total_sessions,
    SUM(COALESCE(ord.total_food, 0))    AS revenue_food_drink,
    SUM(COALESCE(fish.total_buyback, 0)) AS expense_fish_buyback,
    SUM(s.deposit)                  AS total_deposits,
    SUM(
        COALESCE(ord.total_food, 0) 
        - COALESCE(fish.total_buyback, 0) 
        - s.deposit
    )                               AS net_revenue

FROM Sessions s

LEFT JOIN (
    SELECT session_id, SUM(total_price) AS total_food
    FROM Orders
    GROUP BY session_id
) ord ON ord.session_id = s.id

LEFT JOIN (
    SELECT session_id, SUM(subtotal) AS total_buyback
    FROM Session_Fish
    GROUP BY session_id
) fish ON fish.session_id = s.id

WHERE s.status = 'completed'
GROUP BY DATE(s.created_at), s.user_id;


-- ============================================================
-- TRIGGER: Tự động cập nhật updated_at
-- ============================================================
CREATE TRIGGER IF NOT EXISTS trg_users_updated
AFTER UPDATE ON Users
BEGIN
    UPDATE Users SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_products_updated
AFTER UPDATE ON Products
BEGIN
    UPDATE Products SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_fish_buyback_updated
AFTER UPDATE ON Fish_Buyback
BEGIN
    UPDATE Fish_Buyback SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_sessions_updated
AFTER UPDATE ON Sessions
BEGIN
    UPDATE Sessions SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;
