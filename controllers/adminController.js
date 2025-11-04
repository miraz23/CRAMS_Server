const Admin = require('../models/adminModel');
const ErrorHandler = require('../utils/ErrorHandler');
const catchAsyncError = require('../middleware/CatchAsyncErrors');


exports.registerAdmin = catchAsyncError(async (req, res, next) => {
  const { name, email, password, privilege } = req.body;
  if (!name || !email || !password) {
    return next(new ErrorHandler('Missing fields', 400));
  }

  // Check if this is the first admin (no admins exist in database)
  const adminCount = await Admin.countDocuments();
  const isFirstAdmin = adminCount === 0;

  // If it's the first admin, automatically set privilege to 'super'
  const adminPrivilege = isFirstAdmin ? 'super' : (privilege || 'low');

  const admin = await Admin.create({
    name,
    email,
    privilege: adminPrivilege,
    password,
  });

  res.status(200).json({
    success: true,
    message: isFirstAdmin ? 'First admin created successfully' : 'Admin created successfully',
    data: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      privilege: admin.privilege,
    },
  });
});




