const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const options = {
      serverSelectionTimeoutMS: 5000,
      heartbeatFrequencyMS: 10000,
      maxPoolSize: Math.max(5, Number.parseInt(process.env.MONGODB_MAX_POOL_SIZE, 10) || 20),
      minPoolSize: Math.max(0, Number.parseInt(process.env.MONGODB_MIN_POOL_SIZE, 10) || 2),
      maxIdleTimeMS: 60000,
      socketTimeoutMS: 45000,
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
