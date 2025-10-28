-- Add PendingRegistration table
CREATE TABLE IF NOT EXISTS pending_registrations (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'STUDENT',
  otp TEXT NOT NULL,
  "otpExpiry" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster email lookup
CREATE INDEX IF NOT EXISTS idx_pending_registrations_email ON pending_registrations(email);

-- Create index for OTP expiry cleanup
CREATE INDEX IF NOT EXISTS idx_pending_registrations_expiry ON pending_registrations("otpExpiry");

-- Verify table
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'pending_registrations' 
ORDER BY ordinal_position;
