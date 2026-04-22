-- 0. Enums
DO $$ BEGIN CREATE TYPE user_role_enum AS ENUM ('agent', 'admin', 'support'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE user_status_enum AS ENUM ('pending', 'verified', 'suspended'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE company_state_enum AS ENUM ('active', 'underReview', 'rejected', 'suspended'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE deal_status_enum AS ENUM ('open', 'closed', 'negotiating', 'archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE deal_type_enum AS ENUM ('supply', 'demand'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE deal_request_status_enum AS ENUM ('pending', 'paused', 'accepted', 'rejected', 'canceled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE deal_request_kind_enum AS ENUM ('supply', 'demand', 'rfq'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE chat_room_status_enum AS ENUM ('active', 'archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE company_type_enum AS ENUM ('supplier', 'manufacturer', 'distributor', 'retailer', 'serviceProvider', 'wholesaler', 'eCommerce', 'franchise', 'cooperative', 'holdingCompany', 'consultancy', 'logistics', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE industry_enum AS ENUM ('agriculture', 'automotive', 'banking', 'construction', 'education', 'healthcare', 'hospitality', 'manufacturing', 'retail', 'technology', 'telecommunications', 'transportation', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE manufacturing_strategy_enum AS ENUM ('makeToStock', 'makeToOrder', 'assembleToOrder', 'engineerToOrder'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. Files & Users
CREATE TABLE IF NOT EXISTS files (
  id serial PRIMARY KEY,
  file_name varchar(100) NOT NULL,
  file_metadata jsonb,
  file_path varchar(255) NOT NULL,
  uploaded_at timestamp DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamp
);

CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  username varchar(50) NOT NULL UNIQUE,
  email varchar(100) NOT NULL UNIQUE,
  password_hash varchar(255) NOT NULL,
  first_name varchar(50) NOT NULL,
  last_name varchar(50) NOT NULL,
  job_title varchar(100),
  role user_role_enum DEFAULT 'agent',
  status user_status_enum DEFAULT 'pending' NOT NULL,
  profile_image int REFERENCES files(id),
  preferences jsonb,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_password_history (
  id serial PRIMARY KEY,
  user_id int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash varchar(255) NOT NULL,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

-- 2. Companies
CREATE TABLE IF NOT EXISTS companies (
  id serial PRIMARY KEY,
  agent_id int REFERENCES users(id) UNIQUE,
  name varchar(100) NOT NULL,
  description text,
  address varchar(255),
  phone varchar(20),
  website varchar(100),
  email varchar(100),
  company_type company_type_enum,
  company_industry industry_enum,
  manufacturing_strategy manufacturing_strategy_enum,
  logo int REFERENCES files(id),
  status company_state_enum DEFAULT 'underReview',
  contacts jsonb,
  locations jsonb,
  rejection_reason text,
  social_media_links jsonb,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp DEFAULT CURRENT_TIMESTAMP
);

-- 3. Portfolio
CREATE TABLE IF NOT EXISTS company_gallery (
  id serial PRIMARY KEY,
  company_id int REFERENCES companies(id),
  image_file_id int REFERENCES files(id),
  description text,
  uploaded_at timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS company_reviews (
  id serial PRIMARY KEY,
  company_id int REFERENCES companies(id),
  reviewer_company_id int REFERENCES companies(id),
  deal_id int,
  review_text text,
  rating int CHECK (rating >= 1 AND rating <= 5),
  created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS company_documents (
  id serial PRIMARY KEY,
  company_id int REFERENCES companies(id),
  file_id int REFERENCES files(id),
  doc_type varchar(100),
  title varchar(150),
  issuer varchar(150),
  url varchar(255),
  description text,
  issue_date date,
  expiry_date date,
  uploaded_at timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS company_contributions (
  id serial PRIMARY KEY,
  company_id int REFERENCES companies(id),
  media_file_id int REFERENCES files(id),
  media_type varchar(30),
  media_url varchar(255),
  type varchar(30) NOT NULL,
  title varchar(150) NOT NULL,
  description text,
  details jsonb,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS company_contribution_media (
  id serial PRIMARY KEY,
  contribution_id int NOT NULL REFERENCES company_contributions(id) ON DELETE CASCADE,
  file_id int REFERENCES files(id),
  media_type varchar(30) NOT NULL,
  media_url varchar(255),
  sort_order int DEFAULT 0,
  caption varchar(255),
  created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

-- 4. Deals
CREATE TABLE IF NOT EXISTS deals (
  id serial PRIMARY KEY,
  company_id int REFERENCES companies(id),
  deal_name varchar(100) NOT NULL,
  deal_description text,
  deal_value numeric(15, 2),
  deal_type deal_type_enum,
  status deal_status_enum DEFAULT 'open',
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deal_attachments (
  id serial PRIMARY KEY,
  deal_id int NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  file_id int NOT NULL REFERENCES files(id),
  kind varchar(20) NOT NULL CHECK (kind IN ('image', 'file')),
  sort_order int DEFAULT 0,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deal_requests (
  id serial PRIMARY KEY,
  deal_id int REFERENCES deals(id),
  applicant_company_id int REFERENCES companies(id),
  request_kind deal_request_kind_enum NOT NULL DEFAULT 'supply',
  request_details text,
  request_offer numeric(15, 2),
  status deal_request_status_enum DEFAULT 'pending',
  canceled_at timestamp,
  canceled_by_company_id int REFERENCES companies(id),
  cancel_reason text,
  paused_at timestamp,
  paused_by_company_id int REFERENCES companies(id),
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deal_request_supply_details (
  request_id int PRIMARY KEY REFERENCES deal_requests(id) ON DELETE CASCADE,
  product_service_name varchar(200) NOT NULL,
  category varchar(100) NOT NULL,
  quantity_required numeric(15,2),
  delivery_location varchar(255),
  delivery_date date,
  target_price_min numeric(15,2),
  target_price_max numeric(15,2),
  currency varchar(10),
  payment_terms_preference text,
  incoterm varchar(10),
  bulk_discount_expectation text,
  supply_type varchar(30),
  key_specifications text,
  material varchar(200),
  dimensions_size varchar(200),
  certifications_required jsonb,
  quality_level varchar(50),
  color_finish varchar(100),
  country_of_origin varchar(100),
  max_lead_time_accepted varchar(100),
  delivery_method_preference varchar(50),
  packaging_requirements text,
  special_conditions_notes text,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deal_request_demand_details (
  request_id int PRIMARY KEY REFERENCES deal_requests(id) ON DELETE CASCADE,
  product_service_name varchar(200) NOT NULL,
  available_quantity numeric(15,2),
  offer_validity_days int,
  unit_price numeric(15,2),
  currency varchar(10),
  total_price numeric(15,2),
  volume_discount_tiers jsonb,
  moq numeric(15,2),
  availability_type varchar(30),
  quantity_in_stock numeric(15,2),
  max_produce_quantity numeric(15,2),
  stock_delivery_time varchar(100),
  production_lead_time varchar(100),
  specs_match_rfq varchar(20),
  differences_from_rfq text,
  material_offered varchar(200),
  dimensions varchar(200),
  certifications_held jsonb,
  payment_terms text,
  delivery_terms varchar(10),
  warranty_return_policy text,
  exclusivity_confidentiality text,
  additional_notes text,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deal_request_attachments (
  id serial PRIMARY KEY,
  request_id int NOT NULL REFERENCES deal_requests(id) ON DELETE CASCADE,
  file_id int NOT NULL REFERENCES files(id),
  sort_order int DEFAULT 0,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(request_id, file_id)
);

DO $$ BEGIN
  ALTER TABLE company_reviews
    ADD CONSTRAINT fk_company_reviews_deal_id
    FOREIGN KEY (deal_id) REFERENCES deals(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Chat
CREATE TABLE IF NOT EXISTS chat_rooms (
  id serial PRIMARY KEY,
  company_a_id int REFERENCES companies(id),
  company_b_id int REFERENCES companies(id),
  status chat_room_status_enum DEFAULT 'active',
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  encryption_key text,
  UNIQUE(company_a_id, company_b_id),
  CONSTRAINT check_company_order CHECK (company_a_id < company_b_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id serial PRIMARY KEY,
  room_id int REFERENCES chat_rooms(id),
  sender_user_id int REFERENCES users(id),
  message_text text,
  attachment_file_id int REFERENCES files(id),
  sent_at timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_message_reads (
  message_id int NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  company_id int NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  read_at timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id, company_id)
);

-- 6. Email logs
CREATE TABLE IF NOT EXISTS email_logs (
  id serial PRIMARY KEY,
  message_id varchar(100),
  recipient varchar(255) NOT NULL,
  template varchar(50),
  subject varchar(255),
  status varchar(20) DEFAULT 'queued',
  error text,
  attempts int DEFAULT 0,
  sent_at timestamp,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_files_deleted_at ON files(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_profile_image ON users(profile_image);
CREATE INDEX IF NOT EXISTS idx_companies_agent_id ON companies(agent_id);
CREATE INDEX IF NOT EXISTS idx_companies_logo ON companies(logo);
CREATE INDEX IF NOT EXISTS idx_company_gallery_company_id ON company_gallery(company_id);
CREATE INDEX IF NOT EXISTS idx_company_gallery_image_file_id ON company_gallery(image_file_id);
CREATE INDEX IF NOT EXISTS idx_company_documents_company_id ON company_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_company_documents_file_id ON company_documents(file_id);
CREATE INDEX IF NOT EXISTS idx_company_reviews_company_id ON company_reviews(company_id);
CREATE INDEX IF NOT EXISTS idx_company_reviews_reviewer_company_id ON company_reviews(reviewer_company_id);
CREATE INDEX IF NOT EXISTS idx_company_reviews_deal_id ON company_reviews(deal_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_reviews_unique_deal_pair ON company_reviews(deal_id, company_id, reviewer_company_id);
CREATE INDEX IF NOT EXISTS idx_user_password_history_user_id_created_at ON user_password_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_contributions_company_id ON company_contributions(company_id);
CREATE INDEX IF NOT EXISTS idx_company_contributions_media_file_id ON company_contributions(media_file_id);
CREATE INDEX IF NOT EXISTS idx_company_contributions_media_type ON company_contributions(media_type);
CREATE INDEX IF NOT EXISTS idx_company_contributions_details ON company_contributions USING GIN (details);
CREATE INDEX IF NOT EXISTS idx_contribution_media_contribution_id ON company_contribution_media(contribution_id);
CREATE INDEX IF NOT EXISTS idx_contribution_media_file_id ON company_contribution_media(file_id);
CREATE INDEX IF NOT EXISTS idx_deals_company_id ON deals(company_id);
CREATE INDEX IF NOT EXISTS idx_deal_attachments_deal_id ON deal_attachments(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_attachments_file_id ON deal_attachments(file_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_attachments_unique ON deal_attachments(deal_id, file_id, kind);
CREATE INDEX IF NOT EXISTS idx_deal_requests_deal_id ON deal_requests(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_requests_applicant_company_id ON deal_requests(applicant_company_id);
CREATE INDEX IF NOT EXISTS idx_deal_requests_status ON deal_requests(status);
CREATE INDEX IF NOT EXISTS idx_deal_request_attachments_request_id ON deal_request_attachments(request_id);
CREATE INDEX IF NOT EXISTS idx_deal_request_attachments_file_id ON deal_request_attachments(file_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_company_a_id ON chat_rooms(company_a_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_company_b_id ON chat_rooms(company_b_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_user_id ON chat_messages(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_attachment_file_id ON chat_messages(attachment_file_id);
CREATE INDEX IF NOT EXISTS idx_chat_message_reads_company_id ON chat_message_reads(company_id);
CREATE INDEX IF NOT EXISTS idx_chat_message_reads_message_id ON chat_message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_template ON email_logs(template);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);
