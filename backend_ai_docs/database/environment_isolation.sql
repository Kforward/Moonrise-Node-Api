-- Moonrise database environment isolation template.
-- Run these statements as a PostgreSQL administrator, for example the postgres role.
-- Replace the passwords before executing.

create database moonrise_prod;
create database moonrise_test;

create user moonrise_prod_user with encrypted password 'replace-with-strong-production-password';
create user moonrise_test_user with encrypted password 'replace-with-strong-test-password';

grant all privileges on database moonrise_prod to moonrise_prod_user;
grant all privileges on database moonrise_test to moonrise_test_user;

-- Run this block while connected to the moonrise_prod database.
grant all on schema public to moonrise_prod_user;
grant all privileges on all tables in schema public to moonrise_prod_user;
grant all privileges on all sequences in schema public to moonrise_prod_user;
alter default privileges in schema public grant all on tables to moonrise_prod_user;
alter default privileges in schema public grant all on sequences to moonrise_prod_user;

-- Run this block while connected to the moonrise_test database.
grant all on schema public to moonrise_test_user;
grant all privileges on all tables in schema public to moonrise_test_user;
grant all privileges on all sequences in schema public to moonrise_test_user;
alter default privileges in schema public grant all on tables to moonrise_test_user;
alter default privileges in schema public grant all on sequences to moonrise_test_user;
