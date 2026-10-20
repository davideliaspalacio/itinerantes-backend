-- Se ejecuta solo la primera vez que se crea el volumen de Postgres.
-- La BD de desarrollo (eia_dev) la crea POSTGRES_DB; aquí se agrega la de pruebas e2e.
CREATE DATABASE eia_test;
