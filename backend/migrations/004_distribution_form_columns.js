const orm = require('../lib/mysql-orm');

const loadModels = () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const directory = path.join(__dirname, '..', 'models');
  for (const file of fs.readdirSync(directory).filter(name => name.endsWith('.js'))) {
    require(path.join(directory, file));
  }
};

module.exports = {
  name: '004_distribution_form_columns',
  async up({ sequelize }) {
    loadModels();
    const query = sequelize.getQueryInterface();
    for (const Model of orm.getModels().values()) {
      await Model._ready();
      const tableDesc = await query.describeTable(Model.collectionName).catch(() => null);
      if (!tableDesc) continue;
      const attrs = Model._sql.getAttributes();
      for (const [col, attribute] of Object.entries(attrs)) {
        if (!tableDesc[col]) {
          await query.addColumn(Model.collectionName, col, {
            type: attribute.type,
            allowNull: attribute.allowNull,
            defaultValue: attribute.defaultValue,
          });
        }
      }
    }
  },
  async down({ sequelize }) {
    const query = sequelize.getQueryInterface();
    for (const col of ['worldwide', 'originalReleaseDate', 'coverArtMeta']) {
      await query.removeColumn('distributionreleases', col).catch(() => {});
    }
  },
};

