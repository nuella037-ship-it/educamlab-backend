-- ============================================
-- MIGRATION: Add PIN tracking fields
-- ============================================

-- Add last_pin_generated_at to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_pin_generated_at DATETIME NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_pin_used_at DATETIME NULL;

-- Add pin_attempts for security
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_attempts INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_locked_until DATETIME NULL;

-- Add pin_used_at to user_pins
ALTER TABLE user_pins ADD COLUMN IF NOT EXISTS used_at DATETIME NULL;
ALTER TABLE user_pins ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45) NULL;
ALTER TABLE user_pins ADD COLUMN IF NOT EXISTS user_agent TEXT NULL;

-- Add index for PIN expiry
CREATE INDEX IF NOT EXISTS idx_user_pins_expires ON user_pins(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_pins_active ON user_pins(is_active);