-- Add read receipts for B2B chat

CREATE TABLE IF NOT EXISTS chat_message_reads (
    message_id INT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (message_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_message_reads_company_id
ON chat_message_reads(company_id);

CREATE INDEX IF NOT EXISTS idx_chat_message_reads_message_id
ON chat_message_reads(message_id);
