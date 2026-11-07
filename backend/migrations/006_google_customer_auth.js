const { DataTypes } = require('sequelize');

module.exports = {
  name: '006_google_customer_auth',
  async up({ sequelize }) {
    const query = sequelize.getQueryInterface();
    const users = await query.describeTable('users');
    await query.changeColumn('users', 'role', {
      type: DataTypes.ENUM('admin','manager','artist','finance','marketing','customer'),
      allowNull: true, defaultValue: 'manager',
    });
    if (!users.googleId) await query.addColumn('users', 'googleId', { type: DataTypes.STRING(191), allowNull: true, defaultValue: '' });
    if (!users.authProvider) await query.addColumn('users', 'authProvider', { type: DataTypes.ENUM('local','google'), allowNull: true, defaultValue: 'local' });
    await query.addIndex('users', ['googleId'], { name: 'idx_users_googleId' }).catch(error => { if (error.original?.code !== 'ER_DUP_KEYNAME') throw error; });
  },
  async down({ sequelize }) {
    const query = sequelize.getQueryInterface();
    await query.removeIndex('users', 'idx_users_googleId').catch(() => {});
    await query.removeColumn('users', 'googleId').catch(() => {});
    await query.removeColumn('users', 'authProvider').catch(() => {});
    await query.changeColumn('users', 'role', { type: DataTypes.ENUM('admin','manager','artist','finance','marketing'), allowNull: true, defaultValue: 'manager' });
  },
};
