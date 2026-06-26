-- ============================================
-- MIGRATION: Create user_pins table
-- ============================================

CREATE TABLE IF NOT EXISTS user_pins (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    pin_code VARCHAR(10) NOT NULL,
    plan ENUM('daily', 'weekly', 'monthly', 'annual') NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at DATETIME NOT NULL,
    last_used DATETIME NULL,
    created_by INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    revoked_at DATETIME NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_active_pin (user_id, pin_code),
    INDEX idx_user_pin (user_id, pin_code),
    INDEX idx_active (is_active),
    INDEX idx_expires (expires_at)
);

-- ============================================
-- MIGRATION: Add settings table
-- ============================================

CREATE TABLE IF NOT EXISTS settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    type VARCHAR(50) UNIQUE NOT NULL,
    settings JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- MIGRATION: Add pin column to payments
-- ============================================

ALTER TABLE payments ADD COLUMN IF NOT EXISTS pin VARCHAR(10) NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference VARCHAR(100) NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes TEXT NULL;

-- ============================================
-- MIGRATION: Add phone column to users
-- ============================================

ALTER TABLE users MODIFY COLUMN phone VARCHAR(20) NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin VARCHAR(255) NULL;

-- ============================================
-- MIGRATION: Add indexes for performance
-- ============================================

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at);