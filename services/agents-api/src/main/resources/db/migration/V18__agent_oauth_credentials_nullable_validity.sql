ALTER TABLE agent_oauth_credentials
    ALTER COLUMN token_valid DROP NOT NULL,
    ALTER COLUMN token_valid DROP DEFAULT;
