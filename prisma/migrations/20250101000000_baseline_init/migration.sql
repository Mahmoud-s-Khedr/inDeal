-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_role_enum" AS ENUM ('agent', 'admin', 'support');

-- CreateEnum
CREATE TYPE "user_status_enum" AS ENUM ('pending', 'verified', 'suspended');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(50) NOT NULL,
    "last_name" VARCHAR(50) NOT NULL,
    "job_title" VARCHAR(100),
    "role" "user_role_enum" DEFAULT 'agent',
    "status" "user_status_enum" NOT NULL DEFAULT 'pending',
    "profile_image" INTEGER,
    "preferences" JSONB,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_password_history" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_password_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" SERIAL NOT NULL,
    "file_name" VARCHAR(100) NOT NULL,
    "file_metadata" JSONB,
    "file_path" VARCHAR(255) NOT NULL,
    "uploaded_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" SERIAL NOT NULL,
    "agent_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "address" TEXT,
    "phone" VARCHAR(20),
    "email" VARCHAR(100),
    "website" VARCHAR(255),
    "logo" INTEGER,
    "company_type" VARCHAR(50),
    "company_industry" VARCHAR(50),
    "manufacturing_strategy" VARCHAR(50),
    "status" VARCHAR(32) NOT NULL DEFAULT 'active',
    "rejection_reason" TEXT,
    "contacts" JSONB,
    "locations" JSONB,
    "social_media_links" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_gallery" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "image_file_id" INTEGER NOT NULL,
    "description" TEXT,
    "uploaded_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_gallery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_documents" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "file_id" INTEGER,
    "doc_type" VARCHAR(100),
    "title" VARCHAR(150),
    "issuer" VARCHAR(150),
    "url" VARCHAR(255),
    "description" TEXT,
    "issue_date" TIMESTAMP(6),
    "expiry_date" TIMESTAMP(6),
    "uploaded_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_contributions" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "media_file_id" INTEGER,
    "media_type" VARCHAR(20),
    "media_url" VARCHAR(255),
    "type" VARCHAR(32) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_contribution_media" (
    "id" SERIAL NOT NULL,
    "contribution_id" INTEGER NOT NULL,
    "file_id" INTEGER,
    "media_type" VARCHAR(20) NOT NULL,
    "media_url" VARCHAR(255),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "caption" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_contribution_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_reviews" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "reviewer_company_id" INTEGER NOT NULL,
    "deal_id" INTEGER,
    "review_text" TEXT,
    "rating" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "deal_name" VARCHAR(100) NOT NULL,
    "deal_description" TEXT,
    "deal_value" DECIMAL(14,2),
    "deal_type" VARCHAR(16) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_attachments" (
    "id" SERIAL NOT NULL,
    "deal_id" INTEGER NOT NULL,
    "file_id" INTEGER NOT NULL,
    "kind" VARCHAR(16) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_requests" (
    "id" SERIAL NOT NULL,
    "deal_id" INTEGER,
    "applicant_company_id" INTEGER NOT NULL,
    "target_company_id" INTEGER,
    "request_kind" VARCHAR(16) NOT NULL,
    "request_type" VARCHAR(16) NOT NULL DEFAULT 'inSupply',
    "request_details" TEXT,
    "request_offer" DECIMAL(14,2),
    "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
    "canceled_at" TIMESTAMP(6),
    "canceled_by_company_id" INTEGER,
    "cancel_reason" TEXT,
    "paused_at" TIMESTAMP(6),
    "paused_by_company_id" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_request_supply_details" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "product_service_name" VARCHAR(200) NOT NULL,
    "category" VARCHAR(64) NOT NULL,
    "quantity_required" DECIMAL(14,2),
    "delivery_location" VARCHAR(255),
    "delivery_date" TIMESTAMP(6),
    "target_price_min" DECIMAL(14,2),
    "target_price_max" DECIMAL(14,2),
    "currency" VARCHAR(10),
    "payment_terms_preference" VARCHAR(500),
    "incoterm" VARCHAR(10),
    "bulk_discount_expectation" VARCHAR(500),
    "supply_type" VARCHAR(32),
    "key_specifications" TEXT,
    "material" VARCHAR(200),
    "dimensions_size" VARCHAR(200),
    "certifications_required" JSONB,
    "quality_level" VARCHAR(64),
    "quality_level_other_text" VARCHAR(255),
    "country_of_origin" VARCHAR(100),
    "max_lead_time_accepted" VARCHAR(100),
    "delivery_method_preference" VARCHAR(64),
    "packaging_requirements" TEXT,
    "special_conditions_notes" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_request_supply_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_request_demand_details" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "product_service_name" VARCHAR(200) NOT NULL,
    "available_quantity" DECIMAL(14,2),
    "offer_validity_days" INTEGER,
    "unit_price" DECIMAL(14,2),
    "currency" VARCHAR(10),
    "total_price" DECIMAL(14,2),
    "volume_discount_tiers" JSONB,
    "moq" DECIMAL(14,2),
    "availability_type" VARCHAR(32),
    "quantity_in_stock" DECIMAL(14,2),
    "max_produce_quantity" DECIMAL(14,2),
    "production_lead_time" VARCHAR(100),
    "specs_match_rfq" VARCHAR(32),
    "differences_from_rfq" TEXT,
    "material_offered" VARCHAR(200),
    "dimensions" VARCHAR(200),
    "certifications_held" JSONB,
    "payment_terms" VARCHAR(500),
    "delivery_terms" VARCHAR(10),
    "warranty_return_policy" TEXT,
    "exclusivity_confidentiality" TEXT,
    "additional_notes" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_request_demand_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_request_attachments" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "file_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_request_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_rooms" (
    "id" SERIAL NOT NULL,
    "company_a_id" INTEGER NOT NULL,
    "company_b_id" INTEGER NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'active',
    "encryption_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" SERIAL NOT NULL,
    "room_id" INTEGER NOT NULL,
    "sender_user_id" INTEGER NOT NULL,
    "message_text" TEXT,
    "attachment_file_id" INTEGER,
    "sent_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_message_reads" (
    "message_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "read_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_message_reads_pkey" PRIMARY KEY ("message_id","company_id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" SERIAL NOT NULL,
    "message_id" VARCHAR(100),
    "recipient" VARCHAR(255) NOT NULL,
    "template" VARCHAR(50),
    "subject" VARCHAR(255),
    "status" VARCHAR(20) DEFAULT 'queued',
    "error" TEXT,
    "attempts" INTEGER DEFAULT 0,
    "sent_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "user_password_history_user_id_idx" ON "user_password_history"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "companies_agent_id_key" ON "companies"("agent_id");

-- CreateIndex
CREATE INDEX "idx_companies_agent_id" ON "companies"("agent_id");

-- CreateIndex
CREATE INDEX "idx_companies_status" ON "companies"("status");

-- CreateIndex
CREATE INDEX "idx_company_gallery_company_id" ON "company_gallery"("company_id");

-- CreateIndex
CREATE INDEX "idx_company_documents_company_id" ON "company_documents"("company_id");

-- CreateIndex
CREATE INDEX "idx_company_contributions_company_id" ON "company_contributions"("company_id");

-- CreateIndex
CREATE INDEX "idx_ccm_contribution_id" ON "company_contribution_media"("contribution_id");

-- CreateIndex
CREATE INDEX "idx_company_reviews_company_id" ON "company_reviews"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_reviews_deal_id_company_id_reviewer_company_id_key" ON "company_reviews"("deal_id", "company_id", "reviewer_company_id");

-- CreateIndex
CREATE INDEX "idx_deals_company_id" ON "deals"("company_id");

-- CreateIndex
CREATE INDEX "idx_deals_status" ON "deals"("status");

-- CreateIndex
CREATE INDEX "idx_deal_requests_deal_id" ON "deal_requests"("deal_id");

-- CreateIndex
CREATE INDEX "idx_deal_requests_applicant" ON "deal_requests"("applicant_company_id");

-- CreateIndex
CREATE INDEX "idx_deal_requests_applicant_type_created" ON "deal_requests"("applicant_company_id", "request_type", "created_at");

-- CreateIndex
CREATE INDEX "idx_deal_requests_target_type_status" ON "deal_requests"("target_company_id", "request_type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "deal_request_supply_details_request_id_key" ON "deal_request_supply_details"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "deal_request_demand_details_request_id_key" ON "deal_request_demand_details"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_rooms_company_a_id_company_b_id_key" ON "chat_rooms"("company_a_id", "company_b_id");

-- CreateIndex
CREATE INDEX "idx_chat_messages_room_id" ON "chat_messages"("room_id");

-- CreateIndex
CREATE INDEX "idx_chat_messages_sent_at" ON "chat_messages"("sent_at" DESC);

-- CreateIndex
CREATE INDEX "email_logs_recipient_idx" ON "email_logs"("recipient");

-- CreateIndex
CREATE INDEX "email_logs_status_idx" ON "email_logs"("status");

-- CreateIndex
CREATE INDEX "email_logs_template_idx" ON "email_logs"("template");

-- CreateIndex
CREATE INDEX "email_logs_created_at_idx" ON "email_logs"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_profile_image_fkey" FOREIGN KEY ("profile_image") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_password_history" ADD CONSTRAINT "user_password_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_logo_fkey" FOREIGN KEY ("logo") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_gallery" ADD CONSTRAINT "company_gallery_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_gallery" ADD CONSTRAINT "company_gallery_image_file_id_fkey" FOREIGN KEY ("image_file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_documents" ADD CONSTRAINT "company_documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_documents" ADD CONSTRAINT "company_documents_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_contributions" ADD CONSTRAINT "company_contributions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_contributions" ADD CONSTRAINT "company_contributions_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_contribution_media" ADD CONSTRAINT "company_contribution_media_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "company_contributions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_contribution_media" ADD CONSTRAINT "company_contribution_media_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_reviews" ADD CONSTRAINT "company_reviews_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_reviews" ADD CONSTRAINT "company_reviews_reviewer_company_id_fkey" FOREIGN KEY ("reviewer_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_reviews" ADD CONSTRAINT "company_reviews_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_attachments" ADD CONSTRAINT "deal_attachments_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_attachments" ADD CONSTRAINT "deal_attachments_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_requests" ADD CONSTRAINT "deal_requests_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_requests" ADD CONSTRAINT "deal_requests_applicant_company_id_fkey" FOREIGN KEY ("applicant_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_requests" ADD CONSTRAINT "deal_requests_target_company_id_fkey" FOREIGN KEY ("target_company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_requests" ADD CONSTRAINT "deal_requests_canceled_by_company_id_fkey" FOREIGN KEY ("canceled_by_company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_requests" ADD CONSTRAINT "deal_requests_paused_by_company_id_fkey" FOREIGN KEY ("paused_by_company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_request_supply_details" ADD CONSTRAINT "deal_request_supply_details_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "deal_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_request_demand_details" ADD CONSTRAINT "deal_request_demand_details_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "deal_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_request_attachments" ADD CONSTRAINT "deal_request_attachments_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "deal_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_request_attachments" ADD CONSTRAINT "deal_request_attachments_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_company_a_id_fkey" FOREIGN KEY ("company_a_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_company_b_id_fkey" FOREIGN KEY ("company_b_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_attachment_file_id_fkey" FOREIGN KEY ("attachment_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message_reads" ADD CONSTRAINT "chat_message_reads_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message_reads" ADD CONSTRAINT "chat_message_reads_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

