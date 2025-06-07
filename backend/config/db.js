// config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
      useFindAndModify: false,
      // Connection pool for better performance
      poolSize: 10,
      // Keep alive connection to prevent timeouts
      socketTimeoutMS: 30000,
      keepAlive: true,
      // Write concerns for better reliability
      w: 'majority',
      // ReadPreference for better read performance
      readPreference: 'nearest'
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Set up global configuration options for mongoose
    mongoose.set('debug', process.env.NODE_ENV === 'development');
    
    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;