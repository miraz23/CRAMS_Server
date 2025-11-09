const Admin = require('../models/adminModel');
const ErrorHandler = require('../utils/ErrorHandler');
const catchAsyncError = require('../middleware/CatchAsyncErrors');


exports.registerAdmin = catchAsyncError(async (req, res, next) => {
  const { name, email, password, privilege } = req.body;
  if (!name || !email || !password) {
    return next(new ErrorHandler('Missing fields', 400));
  }

  // Check if this is the first admin
  const adminCount = await Admin.countDocuments();
  const isSuperAdmin = adminCount === 0;

  // If it's the first admin, automatically set privilege to 'super'
  const adminPrivilege = isSuperAdmin ? 'super' : (privilege || 'low');

  const admin = await Admin.create({
    name,
    email,
    privilege: adminPrivilege,
    password,
  });

  res.status(200).json({
    success: true,
    message: isSuperAdmin ? 'Super admin created successfully' : 'Admin created successfully',
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

