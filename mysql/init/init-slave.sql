CREATE DATABASE IF NOT EXISTS productsdb
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE productsdb;

CREATE TABLE IF NOT EXISTS products (
  id         INT            NOT NULL AUTO_INCREMENT,
  name       VARCHAR(255)   NOT NULL,
  price      DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
