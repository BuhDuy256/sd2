#!/usr/bin/env bash

set -e

MASTER_HOST="mysql-master"
SLAVE_HOST="mysql-slave"
ROOT_PASS="rootpass"

until mysql -h "$MASTER_HOST" -u root -p"$ROOT_PASS" -e "SELECT 1;" > /dev/null 2>&1; do
  sleep 2
done

until mysql -h "$SLAVE_HOST" -u root -p"$ROOT_PASS" -e "SELECT 1;" > /dev/null 2>&1; do
  sleep 2
done

MASTER_STATUS=$(mysql -h "$MASTER_HOST" -u root -p"$ROOT_PASS" \
  -e "SHOW MASTER STATUS\G" 2>/dev/null)

MASTER_LOG_FILE=$(echo "$MASTER_STATUS" | grep "File:" | awk '{print $2}')
MASTER_LOG_POS=$(echo  "$MASTER_STATUS" | grep "Position:" | awk '{print $2}')

mysql -h "$SLAVE_HOST" -u root -p"$ROOT_PASS" <<SQL
STOP SLAVE;
RESET SLAVE ALL;

CHANGE MASTER TO
  MASTER_HOST     = '$MASTER_HOST',
  MASTER_USER     = 'replicator',
  MASTER_PASSWORD = 'replicapass',
  MASTER_LOG_FILE = '$MASTER_LOG_FILE',
  MASTER_LOG_POS  =  $MASTER_LOG_POS;

START SLAVE;
SQL

sleep 3

SLAVE_STATUS=$(mysql -h "$SLAVE_HOST" -u root -p"$ROOT_PASS" \
  -e "SHOW SLAVE STATUS\G" 2>/dev/null)

IO_RUNNING=$(echo  "$SLAVE_STATUS" | grep "Slave_IO_Running:"  | awk '{print $2}')
SQL_RUNNING=$(echo "$SLAVE_STATUS" | grep "Slave_SQL_Running:" | awk '{print $2}')

if [ "$IO_RUNNING" = "Yes" ] && [ "$SQL_RUNNING" = "Yes" ]; then
  mysql -h "$SLAVE_HOST" -u root -p"$ROOT_PASS" \
    -e "SET GLOBAL read_only = ON; SET GLOBAL super_read_only = ON;"
fi
