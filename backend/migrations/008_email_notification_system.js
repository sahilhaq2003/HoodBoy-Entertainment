const { ensureSchema } = require('../lib/ensureSchema');

module.exports = {
  name: '008_email_notification_system',
  async up({ sequelize }) {
    await ensureSchema(sequelize);
  },
  async down() {
    throw new Error('Email notification history rollback is intentionally non-destructive.');
  },
};
