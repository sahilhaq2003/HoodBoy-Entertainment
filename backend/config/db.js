const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const options = {
      serverSelectionTimeoutMS: 5000,
      heartbeatFrequencyMS: 10000,
    };

    const uri = process.env.MONGODB_URI;

    const conn = await mongoose.connect(uri, options);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.error('⚠️  Running without database. Start MongoDB to enable full functionality.');
  }
};

module.exports = connectDB;
