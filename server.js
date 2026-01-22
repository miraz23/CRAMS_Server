require('dotenv').config();
const connectToDb = require('./config/db');
const cloudinary = require('./config/cloudinary');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const app = express();

process.on('uncaughtException', (err) => {
  console.log(`Error: ${err.message}`);
  console.log(`Server shutting down due to uncaught exception`);
  process.exit(1);
});

connectToDb();

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

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API service running 🚀',
  });
});

const adminRouter = require('./routes/adminRouter');
const studentRouter = require('./routes/studentRouter');
const teacherRouter = require('./routes/teacherRouter');

app.use('/api/admin', adminRouter);
app.use('/api/student', studentRouter);
app.use('/api/teacher', teacherRouter);

const errorMiddleware = require('./middleware/Error');
app.use(errorMiddleware);

const server = app.listen(process.env.PORT || 5000, () => {
  console.log('Server running');
});

process.on('unhandledRejection', (err) => {
  console.log(`Error: ${err.message}`);
  console.log(`Server shutting down due to unhandled promise rejection`);
  server.close(() => {
    process.exit(1);
  });
});
