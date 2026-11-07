module.exports = {
  name: '007_enforce_google_customer_roles',
  async up({ sequelize }) {
    const [result, metadata] = await sequelize.query(`
      UPDATE users
      SET role = 'customer', department = ''
      WHERE authProvider = 'google'
         OR (googleId IS NOT NULL AND googleId <> '')
    `);
    const changed = Number(metadata?.affectedRows ?? result?.affectedRows ?? 0);
    console.log(`Normalized ${changed} Google-linked account(s) to the customer role.`);
  },
  async down() {
    // Previous staff roles cannot be inferred safely. This data correction is
    // intentionally irreversible; staff accounts must use local authentication.
  },
};
