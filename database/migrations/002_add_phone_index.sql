-- ============================================
-- MIGRATION: Add phone index for performance
-- ============================================

-- Add index on phone column for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- Add composite index for user lookups
CREATE INDEX IF NOT EXISTS idx_users_email_phone ON users(email, phone);

-- Add index for subscription queries
CREATE INDEX IF NOT EXISTS idx_users_subscription ON users(subscription_type, subscription_expires);

-- Add index for payment lookups
CREATE INDEX IF NOT EXISTS idx_payments_user_status ON payments(user_id, status);

-- Add index for activity log queries
CREATE INDEX IF NOT EXISTS idx_user_activities_user_type ON user_activities(user_id, activity_type);

-- Add index for contact messages
CREATE INDEX IF NOT EXISTS idx_contact_messages_status_created ON contact_messages(status, created_at);