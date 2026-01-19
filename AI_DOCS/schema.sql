-- 0. Enums
CREATE TYPE user_role_enum AS ENUM ('agent', 'admin', 'support');
CREATE TYPE user_status_enum AS ENUM ('pending', 'verified', 'suspended');
CREATE TYPE company_state_enum AS ENUM ('active', 'underReview', 'rejected', 'suspended');
CREATE TYPE deal_status_enum AS ENUM ('open', 'closed', 'negotiating', 'archived');
CREATE TYPE deal_type_enum AS ENUM ('auction', 'rfq');
CREATE TYPE deal_request_status_enum AS ENUM ('pending', 'accepted', 'rejected', 'withdrawn');
CREATE TYPE chat_room_status_enum AS ENUM ('active', 'archived');
CREATE TYPE ad_status_enum AS ENUM ('pending', 'active', 'rejected', 'paused', 'completed');
CREATE TYPE ad_location_enum AS ENUM ('homepage_banner', 'sidebar', 'search_result');
CREATE TYPE ad_type_enum AS ENUM ('banner', 'video', 'sponsored_listing');

CREATE TYPE support_ticket_status_enum AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE support_ticket_priority_enum AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TYPE company_type_enum AS ENUM ('supplier', 'manufacturer', 'distributor', 'retailer', 'serviceProvider', 'wholesaler', 'eCommerce', 'franchise', 'cooperative', 'holdingCompany', 'consultancy', 'logistics', 'other');

CREATE TYPE industry_enum AS ENUM ('agriculture', 'automotive', 'banking', 'construction', 'education', 'healthcare', 'hospitality', 'manufacturing', 'retail', 'technology', 'telecommunications', 'transportation', 'other');

CREATE TYPE manufacturing_strategy_enum AS ENUM ('makeToStock', 'makeToOrder', 'assembleToOrder', 'engineerToOrder');

-- 1. Files & Users (Standard)
create table files (
    id serial primary key,
    file_name varchar(100) not null,
    file_metadata jsonb,
    file_path varchar(255) not null,
    uploaded_at timestamp default current_timestamp,
    deleted_at timestamp  -- Soft delete support
);

create table users (
    id serial primary key,
    username varchar(50) not null unique,
    email varchar(100) not null unique,
    password_hash varchar(255) not null,
    first_name varchar(50) not null,
    last_name varchar(50) not null,
    job_title varchar(100),
    role user_role_enum default 'agent',
    status user_status_enum default 'pending' not null,
    profile_image int references files(id),
    preferences jsonb,
    created_at timestamp default current_timestamp,
    updated_at timestamp default current_timestamp
);

-- 1b. User Password History
create table user_password_history (
    id serial primary key,
    user_id int not null references users(id) on delete cascade,
    password_hash varchar(255) not null,
    created_at timestamp default current_timestamp
);

-- 2. Companies (Enforcing One Agent)
create table companies (
    id serial primary key,
    agent_id int references users(id) unique, 
    name varchar(100) not null,
    description text,
    address varchar(255),
    phone varchar(20),
    website varchar(100),
    company_type company_type_enum,
    company_industry industry_enum,
    manufacturing_strategy manufacturing_strategy_enum,
    logo int references files(id),
    status company_state_enum default 'underReview',
    contacts jsonb,
    locations jsonb,
    created_at timestamp default current_timestamp,
    updated_at timestamp default current_timestamp
);

-- 3. Assets (Gallery & Reviews)
create table company_gallery (
    id serial primary key,
    company_id int references companies(id),
    image_file_id int references files(id),
    description text,
    uploaded_at timestamp default current_timestamp
);

create table company_reviews (
    id serial primary key,
    company_id int references companies(id), -- The company being reviewed
    reviewer_company_id int references companies(id), -- B2B: Companies review Companies
    review_text text,
    rating int check (rating >= 1 and rating <= 5),
    created_at timestamp default current_timestamp
);

create table company_documents (
    id serial primary key,
    company_id int references companies(id),
    file_id int references files(id),
    doc_type varchar(100),
    title varchar(150),
    issuer varchar(150),
    url varchar(255),
    description text,
    uploaded_at timestamp default current_timestamp
);

-- 3b. Portfolio Contributions
create table company_contributions (
    id serial primary key,
    company_id int references companies(id),
    media_file_id int references files(id),  -- Legacy single-media (deprecated)
    media_type varchar(30),                  -- Legacy single-media (deprecated)
    media_url varchar(255),                  -- Legacy single-media (deprecated)
    type varchar(30) not null,
    title varchar(150) not null,
    description text,
    details jsonb,
    created_at timestamp default current_timestamp,
    updated_at timestamp default current_timestamp
);

-- 3c. Multiple Media per Contribution (junction table)
create table company_contribution_media (
    id serial primary key,
    contribution_id int not null references company_contributions(id) on delete cascade,
    file_id int references files(id),
    media_type varchar(30) not null,  -- image, video, file, url
    media_url varchar(255),           -- for external URLs
    sort_order int default 0,
    caption varchar(255),
    created_at timestamp default current_timestamp
);

-- 4. Deals (The Core Transaction)
create table deals (
    id serial primary key,
    company_id int references companies(id), -- The Publisher
    deal_name varchar(100) not null,
    deal_description text,
    deal_value numeric(15, 2),
    deal_type deal_type_enum, 
    status deal_status_enum default 'open',
    created_at timestamp default current_timestamp,
    updated_at timestamp default current_timestamp
);

create table deal_requests (
    id serial primary key,
    deal_id int references deals(id),
    applicant_company_id int references companies(id), -- Who is applying?
    request_details text,
    request_offer numeric(15, 2), -- Needed for "Lowest Price" sorting
    status deal_request_status_enum default 'pending',
    created_at timestamp default current_timestamp,
    updated_at timestamp default current_timestamp
);

-- 5. Chat System (Fixed for B2B Context)
create table chat_rooms (
    id serial primary key,
    company_a_id int references companies(id),
    company_b_id int references companies(id),
    
    status chat_room_status_enum default 'active',
    created_at timestamp default current_timestamp,
    
    unique(company_a_id, company_b_id),
    CONSTRAINT check_company_order CHECK (company_a_id < company_b_id)
);

create table chat_messages (
    id serial primary key,
    room_id int references chat_rooms(id),
    sender_user_id int references users(id), 
    message_text text,
    attachment_file_id int references files(id),  -- Optional file attachment
    sent_at timestamp default current_timestamp
);

-- 6. Ads
create table advertisements (
    id serial primary key,
    company_id int references companies(id), 
    title varchar(100) not null,
    content text,
    image_file_id int references files(id),
    target_url varchar(255),
    location ad_location_enum,
    type ad_type_enum,
    status ad_status_enum default 'pending',
    start_date date,
    end_date date,
    created_at timestamp default current_timestamp,
    updated_at timestamp default current_timestamp
);

create table ad_analytics_daily (
    id serial primary key,
    advertisement_id int references advertisements(id) on delete cascade,
    date date default current_date,
    impressions_count int default 0,
    clicks_count int default 0, 
    unique(advertisement_id, date)
);

create table ad_click_events (
    id serial primary key,
    advertisement_id int references advertisements(id) on delete cascade,
    user_id int references users(id), 
    ip_address varchar(45), 
    user_agent text, 
    clicked_at timestamp default current_timestamp
);

-- 7. Audit Logs (Optimized for Searching)
create table audit_logs (
    id serial primary key,
    user_id int references users(id),
    company_id int references companies(id),
    action varchar(100) not null,
    details jsonb, -- Optimized for searching
    timestamp timestamp default current_timestamp
);

-- 8. Support Tickets
create table support_tickets (
    id serial primary key,
    user_id int references users(id) on delete set null,
    company_id int references companies(id) on delete set null,
    subject varchar(200) not null,
    message text not null,
    email varchar(100) not null,
    priority support_ticket_priority_enum default 'medium',
    status support_ticket_status_enum default 'open',
    admin_notes text,
    created_at timestamp default current_timestamp,
    updated_at timestamp default current_timestamp
);

create table support_ticket_responses (
    id serial primary key,
    ticket_id int not null references support_tickets(id) on delete cascade,
    responder_user_id int not null references users(id),
    message text not null,
    created_at timestamp default current_timestamp
);

-- 9. Indexes (Performance)
CREATE INDEX idx_users_profile_image ON users(profile_image);
CREATE INDEX idx_companies_agent_id ON companies(agent_id);
CREATE INDEX idx_companies_logo ON companies(logo);
CREATE INDEX idx_company_gallery_company_id ON company_gallery(company_id);
CREATE INDEX idx_company_gallery_image_file_id ON company_gallery(image_file_id);
CREATE INDEX idx_company_documents_company_id ON company_documents(company_id);
CREATE INDEX idx_company_documents_file_id ON company_documents(file_id);
CREATE INDEX idx_company_reviews_company_id ON company_reviews(company_id);
CREATE INDEX idx_company_reviews_reviewer_company_id ON company_reviews(reviewer_company_id);
CREATE INDEX idx_user_password_history_user_id_created_at ON user_password_history(user_id, created_at DESC);
CREATE INDEX idx_company_contributions_company_id ON company_contributions(company_id);
CREATE INDEX idx_company_contributions_media_file_id ON company_contributions(media_file_id);
CREATE INDEX idx_company_contributions_media_type ON company_contributions(media_type);
CREATE INDEX idx_company_contributions_details ON company_contributions USING GIN (details);
CREATE INDEX idx_deals_company_id ON deals(company_id);
CREATE INDEX idx_deal_requests_deal_id ON deal_requests(deal_id);
CREATE INDEX idx_deal_requests_applicant_company_id ON deal_requests(applicant_company_id);
CREATE INDEX idx_chat_rooms_company_a_id ON chat_rooms(company_a_id);
CREATE INDEX idx_chat_rooms_company_b_id ON chat_rooms(company_b_id);
CREATE INDEX idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX idx_chat_messages_sender_user_id ON chat_messages(sender_user_id);
CREATE INDEX idx_advertisements_company_id ON advertisements(company_id);
CREATE INDEX idx_advertisements_image_file_id ON advertisements(image_file_id);
CREATE INDEX idx_ad_analytics_daily_advertisement_id ON ad_analytics_daily(advertisement_id);
CREATE INDEX idx_ad_click_events_advertisement_id ON ad_click_events(advertisement_id);
CREATE INDEX idx_ad_click_events_user_id ON ad_click_events(user_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX idx_audit_logs_details ON audit_logs USING GIN (details);

CREATE INDEX idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_company_id ON support_tickets(company_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX idx_support_ticket_responses_ticket_id ON support_ticket_responses(ticket_id);
