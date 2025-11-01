const mongoose = require('mongoose');

const connectToDb = () => {
  mongoose
    .connect(process.env.DB_URI)
    .then((data) =>
      console.log(`Database connected with ${data.connection.host}`)
    )
    .catch((error) => {
      console.error('Database connection error:', error.message);
      process.exit(1);
    });
};

module.exports = connectToDb;