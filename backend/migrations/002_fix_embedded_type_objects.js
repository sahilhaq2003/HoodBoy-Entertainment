const { DataTypes } = require('sequelize');

module.exports = {
  name: '002_fix_embedded_type_objects',
  async up({ sequelize }) {
    const query = sequelize.getQueryInterface();
    await query.changeColumn('contracts', 'recoupment', { type: DataTypes.JSON, allowNull: true });
    await query.changeColumn('ownerships', 'beatLicense', { type: DataTypes.JSON, allowNull: true });
  },
  async down({ sequelize }) {
    const query = sequelize.getQueryInterface();
    await query.changeColumn('contracts', 'recoupment', { type: DataTypes.STRING(191), allowNull: true });
    await query.changeColumn('ownerships', 'beatLicense', { type: DataTypes.STRING(191), allowNull: true });
  },
};
