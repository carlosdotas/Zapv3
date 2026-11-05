CREATE TABLE IF NOT EXISTS pickup_test_details (
  call_id CHAR(36) PRIMARY KEY,
  company_name VARCHAR(160) NOT NULL,
  pickup_name VARCHAR(160) NULL,
  pickup_address VARCHAR(300) NULL,
  pickup_latitude DECIMAL(10,7) NULL,
  pickup_longitude DECIMAL(10,7) NULL,
  distance_km DECIMAL(9,2) NULL,
  FOREIGN KEY (call_id) REFERENCES pickup_test_calls(id)
);
