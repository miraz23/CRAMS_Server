const Admin = require('../models/adminModel');
const ErrorHandler = require('../utils/ErrorHandler');
const catchAsyncError = require('../middleware/CatchAsyncErrors');
const jwt = require('jsonwebtoken');

exports.getAllAdminDetails = catchAsyncError(async (req, res, next) => {
  const admin = await Admin.find();
  
  const adminData = admin.map((item) => {
    return {
      id: item._id,
      name: item.name,
      email: item.email,
      privilege: item.privilege,
    };
  });

  res.status(200).json({
    success: true,
    message: 'Admin details fetched successfully',
    data: adminData,
  });
});

exports.registerAdmin = catchAsyncError(async (req, res, next) => {
  const { name, email, password, privilege } = req.body;
  if (!name || !email || !password) {
    return next(new ErrorHandler('Missing fields', 400));
  }

  // Check if this is the first admin
  const adminCount = await Admin.countDocuments();
  const isFirstAdmin = adminCount === 0;
  // If it's the first admin, automatically set privilege to 'Super Admin'
  const adminPrivilege = isFirstAdmin ? 'Super Admin' : (privilege || 'Admin');

  const admin = await Admin.create({
    name,
    email,
    privilege: adminPrivilege,
    password,
  });

  res.status(200).json({
    success: true,
    message: isFirstAdmin ? 'Super Admin created successfully' : 'Admin created successfully',
    data: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      privilege: admin.privilege,
    },
  });
});

exports.loginAdmin = catchAsyncError(async(req, res, next) => {
  const { email, password } = req.body;

  if(!email || !password){
    return next(new ErrorHandler('Missing fields', 400));
  }

  // Find an admin by email and explicitly include the password field in the query result
  const admin = await Admin.findOne({ email }).select('+password');
  if(!admin){
    return next(new ErrorHandler('Invalid email or password', 401));
  }

  const isPasswordCorrect = await admin.comparePassword(password);
  if(!isPasswordCorrect){
    return next(new ErrorHandler('Invalid email or password', 401));
  }

  const token = admin.getJwtToken();
  // Set token in cookie
  const cookieExpire = process.env.COOKIE_EXPIRE;
  const options = {
    expires: new Date(Date.now() + cookieExpire * 24 * 60 * 60 * 1000),
    httpOnly: true,
  };
  
  res.cookie('token', token, options);
  
  res.status(200).json({
    success: true,
    message: 'Admin logged in successfully',
    data: {
      token,
    },
  });
})

exports.logoutAdmin = catchAsyncError(async(req, res, next) => {
  res.cookie('token', null, {
    expires: new Date(Date.now()),
    httpOnly: true,
  });
  res.status(200).json({
    success: true,
    message: 'Admin logged out successfully',
  });
})

exports.getSingleAdminDetails = catchAsyncError(async (req, res, next) => {
  if (!req.params.id) {
    return next(new ErrorHandler('User not found', 400));
  }
  const admin = await Admin.findById(req.params.id);
  if (!admin) {
    return next(new ErrorHandler('User not found', 200));
  }
  const adminData = {
    id: admin._id,
    name: admin.name,
    email: admin.email,
    privilege: admin.privilege,
  };
  res.status(200).json({
    success: true,
    message: 'Admin details fetched successfully',
    data: adminData,
  });
});