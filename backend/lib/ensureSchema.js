const fs = require('node:fs');
const path = require('node:path');
const { DataTypes } = require('sequelize');
const orm = require('./mysql-orm');

const loadModels = () => {
  const directory = path.join(__dirname, '..', 'models');
  for (const file of fs.readdirSync(directory).filter(name => name.endsWith('.js'))) {
    require(path.join(directory, file));
  }
};

const indexName = (table, fields, suffix = '') => `idx_${table}_${fields.join('_')}${suffix}`.slice(0, 64);

const ignoreBenignSchemaError = async operation => {
  try {
    return await operation();
  } catch (error) {
    const code = error.original?.code || error.parent?.code;
    const errno = error.original?.errno || error.parent?.errno;
    if ([
      'ER_TABLE_EXISTS_ERROR',
      'ER_DUP_FIELDNAME',
      'ER_DUP_KEYNAME',
      'ER_FK_DUP_NAME',
      'ER_CANT_CREATE_TABLE',
    ].includes(code)) return;
    if ([1050, 1060, 1061, 1826].includes(errno)) return;
    throw error;
  }
};

/**
 * Safely ensures all MySQL tables, columns, link tables, indexes, and foreign keys
 * exist without deleting or truncating any existing data.
 */
async function ensureSchema(sequelize) {
  loadModels();
  const query = sequelize.getQueryInterface();
  const models = [...orm.getModels().values()];

  // 1. Create missing tables & add any missing columns to existing tables
  for (const Model of models) {
    await Model._ready();
    const attributes = Model._sql.getAttributes();
    const columns = {};
    for (const [field, attribute] of Object.entries(attributes)) {
      columns[field] = {
        type: attribute.type,
        allowNull: attribute.allowNull,
        primaryKey: attribute.primaryKey,
        autoIncrement: attribute.autoIncrement,
        unique: attribute.unique,
        defaultValue: attribute.defaultValue,
      };
    }

    const existingTable = await query.describeTable(Model.collectionName).catch(() => null);
    if (!existingTable) {
      await ignoreBenignSchemaError(() => query.createTable(Model.collectionName, columns, {
        charset: 'utf8mb4', collate: 'utf8mb4_0900_ai_ci', engine: 'InnoDB',
      }));
    } else {
      for (const [field, colDef] of Object.entries(columns)) {
        if (!existingTable[field]) {
          await ignoreBenignSchemaError(() => query.addColumn(Model.collectionName, field, {
            type: colDef.type,
            allowNull: colDef.allowNull !== false,
            defaultValue: colDef.defaultValue,
          }));
        }
      }
    }
  }

  // 2. Ensure JSON column types for embedded objects (safe in-place alter)
  const contractsTable = await query.describeTable('contracts').catch(() => null);
  if (contractsTable?.recoupment && !String(contractsTable.recoupment.type).toUpperCase().includes('JSON')) {
    await ignoreBenignSchemaError(() => query.changeColumn('contracts', 'recoupment', { type: DataTypes.JSON, allowNull: true }));
  }
  const ownershipsTable = await query.describeTable('ownerships').catch(() => null);
  if (ownershipsTable?.beatLicense && !String(ownershipsTable.beatLicense.type).toUpperCase().includes('JSON')) {
    await ignoreBenignSchemaError(() => query.changeColumn('ownerships', 'beatLicense', { type: DataTypes.JSON, allowNull: true }));
  }

  // 3. Create missing many-to-many link tables
  for (const Model of models) {
    for (const [field, raw] of Object.entries(Model.schema.definition)) {
      const spec = Array.isArray(raw)
        ? { array: true, ref: raw[0]?.ref }
        : Array.isArray(raw?.type)
          ? { array: true, ref: raw.ref || raw.type[0]?.ref }
          : {};
      const target = spec.ref && orm.getModels().get(spec.ref);
      if (!spec.array || !target) continue;
      const linkTableName = orm.linkTable(Model.collectionName, field);
      const existingLink = await query.describeTable(linkTableName).catch(() => null);
      if (!existingLink) {
        await ignoreBenignSchemaError(() => query.createTable(linkTableName, {
          ownerId: {
            type: DataTypes.CHAR(24), allowNull: false, primaryKey: true,
            references: { model: Model.collectionName, key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE',
          },
          targetId: {
            type: DataTypes.CHAR(24), allowNull: false, primaryKey: true,
            references: { model: target.collectionName, key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE',
          },
          position: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        }, { charset: 'utf8mb4', collate: 'utf8mb4_0900_ai_ci', engine: 'InnoDB' }));
        await ignoreBenignSchemaError(() => query.addIndex(linkTableName, ['targetId'], {
          name: indexName(linkTableName, ['targetId']),
        }));
      }
    }
  }

  // 4. Ensure indexes exist
  for (const Model of models) {
    const seen = new Set();
    for (const [fields, options] of Model.schema._indexes) {
      const valid = Object.keys(fields).filter(field => Object.hasOwn(Model.schema.definition, field));
      if (!valid.length || valid.some(field => Model._sql.getAttributes()[field]?.type instanceof DataTypes.JSON)) continue;
      const signature = valid.join('|');
      if (seen.has(signature)) continue;
      seen.add(signature);
      const indexedFields = valid.map(field => field === 'path' ? { name: field, length: 191 } : field);
      await ignoreBenignSchemaError(() => query.addIndex(Model.collectionName, indexedFields, {
        name: indexName(Model.collectionName, valid, options.unique ? '_uq' : ''),
        unique: Boolean(options.unique),
      }));
    }
    for (const [field, raw] of Object.entries(Model.schema.definition)) {
      if (raw?.unique && !seen.has(field)) {
        await ignoreBenignSchemaError(() => query.addIndex(Model.collectionName, [field], {
          name: indexName(Model.collectionName, [field], '_uq'),
          unique: true,
        }));
      }
    }
  }

  // 5. Ensure foreign key constraints exist
  for (const Model of models) {
    for (const [field, raw] of Object.entries(Model.schema.definition)) {
      const reference = raw?.ref;
      const target = reference && orm.getModels().get(reference);
      if (!target) continue;
      await ignoreBenignSchemaError(() => query.addConstraint(Model.collectionName, {
        fields: [field],
        type: 'foreign key',
        name: `fk_${Model.collectionName}_${field}`.slice(0, 64),
        references: { table: target.collectionName, field: 'id' },
        onUpdate: 'CASCADE',
        onDelete: raw.required ? 'RESTRICT' : 'SET NULL',
      }));
    }
  }

  // 6. Ensure at least one admin user exists if the users table is completely empty
  const User = orm.getModels().get('User');
  if (User) {
    const userCount = await User.countDocuments({});
    if (userCount === 0) {
      const defaultEmail = (process.env.INITIAL_ADMIN_EMAIL || 'admin@hbelabel.com').toLowerCase();
      const defaultPassword = process.env.INITIAL_ADMIN_PASSWORD || 'HBEAdmin@2026';
      await User.create({
        name: 'System Administrator',
        email: defaultEmail,
        password: defaultPassword,
        role: 'admin',
        department: 'Executive Management',
        isActive: true,
      });
      console.log(`Created initial admin user: ${defaultEmail}`);
    }
  }
}

module.exports = { ensureSchema };

