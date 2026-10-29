const { DataTypes } = require('sequelize');
const orm = require('../lib/mysql-orm');

const loadModels = () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const directory = path.join(__dirname, '..', 'models');
  for (const file of fs.readdirSync(directory).filter(name => name.endsWith('.js'))) require(path.join(directory, file));
};

const indexName = (table, fields, suffix = '') => `idx_${table}_${fields.join('_')}${suffix}`.slice(0, 64);
const ignoreAlreadyExists = async operation => {
  try { return await operation(); }
  catch (error) {
    if (['ER_TABLE_EXISTS_ERROR', 'ER_DUP_KEYNAME', 'ER_FK_DUP_NAME'].includes(error.original?.code)) return;
    if (error.original?.errno === 1826) return;
    throw error;
  }
};

module.exports = {
  name: '001_initial_mysql_schema',
  async up({ sequelize }) {
    loadModels();
    const query = sequelize.getQueryInterface();
    const models = [...orm.getModels().values()];
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
      await ignoreAlreadyExists(() => query.createTable(Model.collectionName, columns, {
        charset: 'utf8mb4', collate: 'utf8mb4_0900_ai_ci', engine: 'InnoDB',
      }));
    }

    for (const Model of models) {
      for (const [field, raw] of Object.entries(Model.schema.definition)) {
        const spec = Array.isArray(raw) ? { array: true, ref: raw[0]?.ref } : Array.isArray(raw?.type) ? { array: true, ref: raw.ref || raw.type[0]?.ref } : {};
        const target = spec.ref && orm.getModels().get(spec.ref);
        if (!spec.array || !target) continue;
        await ignoreAlreadyExists(() => query.createTable(orm.linkTable(Model.collectionName, field), {
          ownerId: { type: DataTypes.CHAR(24), allowNull: false, primaryKey: true, references: { model: Model.collectionName, key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
          targetId: { type: DataTypes.CHAR(24), allowNull: false, primaryKey: true, references: { model: target.collectionName, key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
          position: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        }, { charset: 'utf8mb4', collate: 'utf8mb4_0900_ai_ci', engine: 'InnoDB' }));
        await ignoreAlreadyExists(() => query.addIndex(orm.linkTable(Model.collectionName, field), ['targetId'], { name: indexName(orm.linkTable(Model.collectionName, field), ['targetId']) }));
      }
    }

    for (const Model of models) {
      const seen = new Set();
      for (const [fields, options] of Model.schema._indexes) {
        const valid = Object.keys(fields).filter(field => Object.hasOwn(Model.schema.definition, field));
        if (!valid.length || valid.some(field => Model._sql.getAttributes()[field]?.type instanceof DataTypes.JSON)) continue;
        const signature = valid.join('|');
        if (seen.has(signature)) continue;
        seen.add(signature);
        const indexedFields = valid.map(field => field === 'path' ? { name: field, length: 191 } : field);
        await ignoreAlreadyExists(() => query.addIndex(Model.collectionName, indexedFields, {
          name: indexName(Model.collectionName, valid, options.unique ? '_uq' : ''),
          unique: Boolean(options.unique),
        }));
      }
      for (const [field, raw] of Object.entries(Model.schema.definition)) {
        if (raw?.unique && !seen.has(field)) await ignoreAlreadyExists(() => query.addIndex(Model.collectionName, [field], { name: indexName(Model.collectionName, [field], '_uq'), unique: true }));
      }
    }

    for (const Model of models) {
      for (const [field, raw] of Object.entries(Model.schema.definition)) {
        const reference = raw?.ref;
        const target = reference && orm.getModels().get(reference);
        if (!target) continue;
        await ignoreAlreadyExists(() => query.addConstraint(Model.collectionName, {
          fields: [field], type: 'foreign key',
          name: `fk_${Model.collectionName}_${field}`.slice(0, 64),
          references: { table: target.collectionName, field: 'id' },
          onUpdate: 'CASCADE', onDelete: raw.required ? 'RESTRICT' : 'SET NULL',
        }));
      }
    }
  },
  async down({ sequelize }) {
    const query = sequelize.getQueryInterface();
    loadModels();
    const registered = [...orm.getModels().values()];
    for (const Model of registered) for (const [field, raw] of Object.entries(Model.schema.definition)) {
      if (raw?.ref) await query.removeConstraint(Model.collectionName, `fk_${Model.collectionName}_${field}`.slice(0, 64));
    }
    for (const Model of registered.reverse()) for (const [field, raw] of Object.entries(Model.schema.definition)) {
      const ref = Array.isArray(raw) ? raw[0]?.ref : Array.isArray(raw?.type) ? raw.ref || raw.type[0]?.ref : null;
      if (ref) await query.dropTable(orm.linkTable(Model.collectionName, field));
    }
    const models = [...orm.getModels().values()].reverse();
    for (const Model of models) await query.dropTable(Model.collectionName);
  },
};
