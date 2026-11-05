CREATE TABLE IF NOT EXISTS pickup_self_test_setups (
  admin_user_id CHAR(36) PRIMARY KEY,
  company_id CHAR(36) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_user_id) REFERENCES users(id),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);
