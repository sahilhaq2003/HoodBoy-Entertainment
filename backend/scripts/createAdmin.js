require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('../lib/mysql-orm');
const User = require('../models/User');

async function createAdmin() {
  const email = process.argv[2] || 'admin@hbelabel.com';
  const password = process.argv[3] || 'HBEAdmin@2026';
  const name = process.argv[4] || 'System Administrator';

  try {
    await mongoose.connect();
    console.log('Connected to MySQL...');

    let user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      console.log(`Found existing user with email: ${email}`);
      user.name = name;
      user.password = password; // Will be hashed in pre-save hook
      user.role = 'admin';
      user.isActive = true;
      await user.save();
      console.log(`Successfully updated admin user: ${email}`);
    } else {
      user = new User({
        name,
        email: email.toLowerCase(),
        password,
        role: 'admin',
        department: 'Executive Management',
        isActive: true
      });
      await user.save();
      console.log(`Successfully created new admin user: ${email}`);
    }

    console.log('\n--- Admin Credentials ---');
    console.log(`Email:    ${user.email}`);
    console.log(`Password: ${password}`);
    console.log(`Role:     ${user.role}`);
    console.log(`Status:   Active`);
    console.log('-------------------------\n');

  } catch (err) {
    console.error('Error creating admin user:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MySQL.');
  }
}

createAdmin();
