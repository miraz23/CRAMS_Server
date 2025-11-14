require('dotenv').config();
const connectToDb = require('./config/db');
const cloudinary = require('./config/cloudinary');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const app = express();

// uncaught exception
process.on('uncaughtException', (err) => {
  console.log(`Error: ${err.message}`);
  console.log(`Server shutting down due to uncaught exception`);
  process.exit(1);
});

// connect to db
connectToDb();

// using middlewares
app.use(
  cors({
    origin: process.env.NODE_ENV === 'production' 
      ? [process.env.FRONTEND_URL, /\.netlify\.app$/, /\.vercel\.app$/]
      : [/localhost:\d{4}$/, /127\.0\.0\.1:\d{4}$/],
    credentials: true,
  })
);
app.use(express.json({ limit: '20mb' }));
app.use(cookieParser());

// basic api route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API service running 🚀',
  });
});

// requiring routers
const adminRouter = require('./routes/adminRouter');
const studentRouter = require('./routes/studentRouter');
const teacherRouter = require('./routes/teacherRouter');
const staffRouter = require('./routes/staffRouter');

// using routers
app.use('/api/admin', adminRouter);
app.use('/api/student', studentRouter);
app.use('/api/teacher', teacherRouter);
app.use('/api/staff', staffRouter);

const errorMiddleware = require('./middleware/Error');
app.use(errorMiddleware);

// starting server
const server = app.listen(process.env.PORT || 5000, () => {
  console.log('Server running');
});

// unhandled promise rejection
process.on('unhandledRejection', (err) => {
  console.log(`Error: ${err.message}`);
  console.log(`Server shutting down due to unhandled promise rejection`);
  server.close(() => {
    process.exit(1);
  });
});