const { Sequelize } = require('sequelize');
const orm = require('../lib/mysql-orm');

let sequelize;
const required = name => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required MySQL environment variable: ${name}`);
  return value;
};

const connectDB = async () => {
  if (sequelize) return sequelize;
  const host = required('DB_HOST');
  const port = Number.parseInt(process.env.DB_PORT || '3306', 10);
  const database = required('DB_NAME');
  const username = required('DB_USER');
  const password = required('DB_PASSWORD');
  const useSsl = String(process.env.DB_SSL || 'false').toLowerCase() === 'true';
  sequelize = new Sequelize(database, username, password, {
    dialect: 'mysql', host, port,
    logging: process.env.DB_LOGGING === 'true' ? console.log : false,
    timezone: '+00:00',
    dialectOptions: useSsl ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true } } : {},
    pool: {
      max: Math.max(5, Number.parseInt(process.env.DB_POOL_MAX || '20', 10)),
      min: Math.max(0, Number.parseInt(process.env.DB_POOL_MIN || '2', 10)),
      acquire: Number.parseInt(process.env.DB_POOL_ACQUIRE_MS || '30000', 10),
      idle: Number.parseInt(process.env.DB_POOL_IDLE_MS || '10000', 10),
    },
    define: { charset: 'utf8mb4', collate: 'utf8mb4_0900_ai_ci' },
    retry: { max: 3 },
  });
  orm.configure(sequelize);
  await sequelize.authenticate();
  console.log(`MySQL connected: ${host}:${port}/${database}`);
  return sequelize;
};
connectDB.getSequelize = () => sequelize;
module.exports = connectDB;
