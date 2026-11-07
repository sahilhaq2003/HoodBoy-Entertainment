const { ensureSchema } = require('../lib/ensureSchema');

module.exports = {
  name: '005_linkup_booking_platform',
  async up({ sequelize }) {
    // ensureSchema is additive: it creates the new Linkup tables, relationships,
    // and indexes without dropping or rewriting the legacy episode table.
    await ensureSchema(sequelize);
  },
  async down() {
    throw new Error('Linkup platform rollback is intentionally non-destructive; restore from a verified backup if required.');
  },
};
