const catchAsyncErrors = require('./CatchAsyncErrors');
const ErrorHandler = require('../utils/ErrorHandler');
const jwt = require('jsonwebtoken');
const Admin = require('../models/adminModel');
const Student = require('../models/studentModel');

exports.checkUserAuthentication = catchAsyncErrors(async (req, res, next) => {
  const { token } = req.cookies;
  if (!token) {
    return next(
      new ErrorHandler('Please login again to access this resource', 401)
    );
  }
  const decodedData = await jwt.verify(token, process.env.JWT_SECRET);
  const user = await Admin.findById(decodedData.id);
  if (!user) {
    return next(new ErrorHandler('User not found', 401));
  }
  req.user = user;
  next();
});

exports.checkAdminPrivileges = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ErrorHandler('User not authenticated', 401));
    }
    
    if (!roles.includes(req.user.privilege)) {
      return next(
        new ErrorHandler(
          `Role: ${req.user.privilege} is not allowed to access this resouce `,
          403
        )
      );
    }

    next();
  };
};

exports.checkStudentAuthentication = catchAsyncErrors(async (req, res, next) => {
  const { token } = req.cookies;
  if (!token) {
    return next(
      new ErrorHandler('Please login again to access this resource', 401)
    );
  }
  const decodedData = await jwt.verify(token, process.env.JWT_SECRET);
  const student = await Student.findById(decodedData.id);
  if (!student) {
    return next(new ErrorHandler('Student not found', 401));
  }
  req.student = student;
  next();
});
