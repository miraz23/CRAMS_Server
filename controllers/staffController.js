const Staff = require('../models/staffModel');
const ErrorHandler = require('../utils/ErrorHandler');
const catchAsyncError = require('../middleware/CatchAsyncErrors');
const { sendToken } = require('../utils/jwt');
const { formatDate } = require('../utils/helpers');

exports.getAllStaffDetails = catchAsyncError(async (req, res, next) => {
  const staff = await Staff.find();
  const staffData = staff.map((item) => {
    return {
      id: item._id,
      name: item.name,
      designation: item.designation, 
      department: item.department
    };
  });
  res.status(200).json({
    success: true,
    message: 'Staff details fetched successfully',
    data: staffData,
  });
});

exports.registerStaff = catchAsyncError(async (req, res, next) => {
  const { name, staffId, designation, department, mobileNumber, email,dateOfBirth, gender, password, address, staffImage } = req.body;
  if (!name || !staffId || !designation || !department || !mobileNumber || !email || !dateOfBirth || !gender || !password || !address || !staffImage) {
    return next(new ErrorHandler('Missing fields', 400));
  }
  const staff = await Staff.create({ name, staffId, designation, department, mobileNumber, email, dateOfBirth, gender, password, address, staffImage });
  res.status(200).json({
    success: true,
    message: 'Staff registered successfully',
    data: staff,
  });
});

exports.loginStaff = catchAsyncError(async (req, res, next) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return next(new ErrorHandler('Missing fields', 400));
  }
  const staff = await Staff.findOne({ email }).select('+password');
  if (!staff) {
    return next(new ErrorHandler('Staff not found', 404));
  }
  const isPasswordCorrect =  await staff.comparePassword(password);
  if(!isPasswordCorrect){
    return next(new ErrorHandler('Invalid email or password', 401));
  }
  sendToken(staff, 200, res);
});


exports.logoutStaff = catchAsyncError(async (req, res, next) => {
  res.cookie('token', null, {
    expires: new Date(Date.now()),
    httpOnly: true,
  });
  res.status(200).json({
    success: true,
    message: 'Staff logged out successfully',
  });
})  

exports.getSingleStaffDetails = catchAsyncError(async (req, res, next) => {
  const staff = await Staff.findById(req.params.id);
  if (!staff) {
    return next(new ErrorHandler('Staff not found', 404));
  }
  res.status(200).json({
    success: true,
    message: 'Staff details fetched successfully',
    data: staff,
  });
})

exports.updateStaff = catchAsyncError(async (req, res, next) => {
  const staff = await Staff.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  res.status(200).json({
    success: true,
    message: 'Staff updated successfully'
  });
})

exports.deleteStaff = catchAsyncError(async (req, res, next) => {
  const staff = await Staff.findByIdAndDelete(req.params.id);
  res.status(200).json({
    success: true,
    message: 'Staff deleted successfully'
  });
})