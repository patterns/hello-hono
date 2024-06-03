DROP TABLE IF EXISTS users;
CREATE TABLE IF NOT EXISTS users (
  id integer PRIMARY KEY AUTOINCREMENT,
  uuid text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL
);
CREATE INDEX idx_users_uuid ON users (uuid);

-- Optionally, uncomment the below query to create data

-- INSERT INTO USERS (name, email, role) VALUES ('Kristian', 'demo@example.dev', 'member');
