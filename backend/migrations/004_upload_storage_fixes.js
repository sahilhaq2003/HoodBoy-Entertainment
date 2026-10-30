const { DataTypes } = require('sequelize');

module.exports = {
  name: '004_upload_storage_fixes',
  async up({ sequelize }) {
    const query = sequelize.getQueryInterface();
    const users = await query.describeTable('users').catch(() => null);
    if (users?.avatar) await query.changeColumn('users', 'avatar', { type: DataTypes.TEXT('medium'), allowNull: true });
  },
  async down({ sequelize }) {
    const query = sequelize.getQueryInterface();
    const users = await query.describeTable('users').catch(() => null);
    if (users?.avatar) await query.changeColumn('users', 'avatar', { type: DataTypes.STRING(255), allowNull: true, defaultValue: '' });
  },
};
