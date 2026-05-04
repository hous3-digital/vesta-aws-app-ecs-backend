-- Seed used for base data that is always present in the database, i.e. roles.

insert into "role" (role_id, is_active, status, type, description, created_at, updated_at, deactivated_at) values ('role_01k2jjb5yaexr8r7kem3j3x761', true, 'created', 'user',  'User',  generate_unique_second_timestamptz(), generate_unique_second_timestamptz(), null);
insert into "role" (role_id, is_active, status, type, description, created_at, updated_at, deactivated_at) values ('role_01k2jjb5yaexr8r7k6yrm50mgg', true, 'created', 'admin', 'Admin', generate_unique_second_timestamptz(), generate_unique_second_timestamptz(), null);
insert into "role" (role_id, is_active, status, type, description, created_at, updated_at, deactivated_at) values ('role_01k2jjb5y9exr8r7jta32ez2wx', true, 'created', 'super', 'Super', generate_unique_second_timestamptz(), generate_unique_second_timestamptz(), null);
