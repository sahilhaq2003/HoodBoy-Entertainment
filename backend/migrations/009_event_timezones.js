const { ensureSchema } = require('../lib/ensureSchema');

module.exports = {
  name: '009_event_timezones',
  async up({ sequelize }) {
    await ensureSchema(sequelize);
    await sequelize.query("UPDATE linkup_events SET timeZone = 'UTC' WHERE timeZone IS NULL OR TRIM(timeZone) = ''");
    await sequelize.query("UPDATE linkup_events SET timeZone = 'Asia/Colombo' WHERE timeZone = 'UTC' AND (LOWER(location) LIKE '%colombo%' OR LOWER(location) LIKE '%sri lanka%')");
  },
  async down() {
    // Additive migration: retain event time zones to avoid losing scheduling data.
  },
};
