require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });
const connectDB = require('../config/db');
const { ensureSchema } = require('../lib/ensureSchema');

const migrations = [
  require('../migrations/001_initial_mysql_schema'),
  require('../migrations/002_fix_embedded_type_objects'),
  require('../migrations/003_distribeats_columns'),
  require('../migrations/004_upload_storage_fixes'),
];
const command = process.argv[2] || 'up';

async function main() {
  const sequelize = await connectDB();
  const query = sequelize.getQueryInterface();
  await query.createTable('schema_migrations', {
    name: { type: require('sequelize').DataTypes.STRING(191), primaryKey: true },
    appliedAt: { type: require('sequelize').DataTypes.DATE(3), allowNull: false },
  }).catch(error => { if (error.original?.code !== 'ER_TABLE_EXISTS_ERROR') throw error; });
  const [rows] = await sequelize.query('SELECT name, appliedAt FROM schema_migrations ORDER BY name');
  const applied = new Set(rows.map(row => row.name));

  if (command === 'status') {
    for (const migration of migrations) console.log(`${applied.has(migration.name) ? 'up' : 'pending'}  ${migration.name}`);
    return;
  }
  if (command === 'down') {
    if (process.env.NODE_ENV === 'production' || process.env.ALLOW_LOCAL_MIGRATION_ROLLBACK !== 'true') {
      throw new Error('Rollback is disabled. Set ALLOW_LOCAL_MIGRATION_ROLLBACK=true outside production after taking a backup.');
    }
    const migration = [...migrations].reverse().find(item => applied.has(item.name));
    if (!migration) return console.log('No applied migration to roll back.');
    await migration.down({ sequelize });
    await sequelize.query('DELETE FROM schema_migrations WHERE name = ?', { replacements: [migration.name] });
    console.log(`Rolled back ${migration.name}`);
    return;
  }
  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;
    console.log(`Applying ${migration.name}`);
    await migration.up({ sequelize });
    await sequelize.query('INSERT INTO schema_migrations (name, appliedAt) VALUES (?, UTC_TIMESTAMP(3))', { replacements: [migration.name] });
    console.log(`Applied ${migration.name}`);
  }
  await ensureSchema(sequelize);
  console.log('Verified all MySQL tables and columns are up to date (preserving existing data).');
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => connectDB.getSequelize()?.close());
