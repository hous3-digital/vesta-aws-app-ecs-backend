-- Seed used for development purposes
-- Use typeid generator by https://zicklag.github.io/type-id-gen/ to generate the ids for the tables.

-- user information example
insert into "user" (user_id, is_active, status, name, email, password, created_at, updated_at, deactivated_at) values ('user_01k23d73qgecfb8d8725wdgncr', true, 'created', 'User', 'user@example.com', '$2b$10$li1nCE/pLaxiZqXfFw5hmujzJ3tsdG/mYPFHc5ZyQvocOkGS2d.Ry', generate_unique_second_timestamptz(), generate_unique_second_timestamptz(), null);
insert into "membership" (membership_id, is_active, status, created_at, updated_at, deactivated_at, user_id, role_id) values ('membership_01k2jjedpje4etytz5kt69ntvc', true, 'created', generate_unique_second_timestamptz(), generate_unique_second_timestamptz(), null, 'user_01k23d73qgecfb8d8725wdgncr', 'role_01k2jjb5yaexr8r7k6yrm50mgg');
