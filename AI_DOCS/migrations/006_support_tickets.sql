-- Migration: Add support tickets tables
-- Date: 2026-01-19
-- Description: Creates support_tickets and support_ticket_responses tables

-- Enum for ticket status
CREATE TYPE support_ticket_status_enum AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE support_ticket_priority_enum AS ENUM ('low', 'medium', 'high', 'urgent');

-- Support Tickets table
CREATE TABLE support_tickets (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    company_id INT REFERENCES companies(id) ON DELETE SET NULL,
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    email VARCHAR(100) NOT NULL,
    priority support_ticket_priority_enum DEFAULT 'medium',
    status support_ticket_status_enum DEFAULT 'open',
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ticket Responses table
CREATE TABLE support_ticket_responses (
    id SERIAL PRIMARY KEY,
    ticket_id INT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    responder_user_id INT NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_company_id ON support_tickets(company_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX idx_support_ticket_responses_ticket_id ON support_ticket_responses(ticket_id);
