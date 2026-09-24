-- Applicant record, written at KYC-form-submit time.
-- pan_dob_hash is HMAC(pan+dob) from src/lib/pan.ts — the raw PAN and DOB
-- are never stored here, only the masked display version of the PAN.
CREATE TABLE applicants (
  id TEXT PRIMARY KEY,
  pan_dob_hash TEXT NOT NULL UNIQUE,
  pan_masked TEXT NOT NULL,        -- e.g. "XXXXX1234F", display only
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,      -- login OTP goes here
  mobile TEXT,                     -- optional, for RM/human contact only — not used for OTP
  aadhaar_last4 TEXT,              -- masked; never store the full number
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_applicants_email ON applicants (email);

-- One row per parsed CIBIL pull. Populated by the (not-yet-built) parse
-- step — the raw PDF is never written here, only what got extracted.
CREATE TABLE cibil_reports (
  id TEXT PRIMARY KEY,
  applicant_id TEXT NOT NULL REFERENCES applicants(id),
  report_date TEXT,                 -- date the bureau generated the report
  score INTEGER,
  active_loans INTEGER,
  overdue_count INTEGER,
  inquiries_last_6m INTEGER,
  has_writeoff_or_settled INTEGER,  -- 0/1
  ai_summary TEXT,
  parsed_at INTEGER NOT NULL
);

CREATE TABLE income_declarations (
  id TEXT PRIMARY KEY,
  applicant_id TEXT NOT NULL REFERENCES applicants(id),
  monthly_income INTEGER,
  monthly_emi INTEGER,
  source TEXT NOT NULL,   -- 'manual' | 'statement'
  created_at INTEGER NOT NULL
);

-- Status + the ₹16,000 payment split from the landing page:
-- ₹10,000 capital allocation (becomes the card's usable limit) +
-- ₹6,000 professional retainer (legal/advisory fee, non-refundable).
-- final_loan_* fields fill in at the day-90+ disbursement stage.
CREATE TABLE applications (
  id TEXT PRIMARY KEY,
  applicant_id TEXT NOT NULL REFERENCES applicants(id),
  status TEXT NOT NULL DEFAULT 'account_opened',
    -- 'account_opened' | 'payment_done' | 'card_received' | 'active'
  capital_allocation_amount INTEGER NOT NULL DEFAULT 10000,
  professional_retainer_amount INTEGER NOT NULL DEFAULT 6000,
  payment_ref TEXT,
  payment_method TEXT,       -- 'razorpay' | 'cashfree' | 'manual_upi'
  paid_at INTEGER,
  card_issued_at INTEGER,
  final_loan_amount INTEGER,
  final_loan_disbursed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_applications_applicant ON applications (applicant_id);

-- Not modeled yet: the Day 6-45 "cleanup operation" (dispute filing with
-- bureaus) isn't a table here because how disputes get created and tracked
-- hasn't been designed — add a `disputes` table when that's specced.
