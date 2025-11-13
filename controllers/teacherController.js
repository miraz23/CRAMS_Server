const Teacher = require('../models/teacherModel');
const ErrorHandler = require('../utils/ErrorHandler');
const catchAsyncError = require('../middleware/CatchAsyncErrors');
const { sendToken } = require('../utils/jwt');
const { formatDate } = require('../utils/helpers');

exports.getAllTeacherDetails = catchAsyncError(async (req, res, next) => {
  const teacher = await Teacher.find();
  
  const teacherData = teacher.map((item) => {
    return {
      id: item._id,
      name: item.name,
      teacherId: item.teacherId,
      department: item.department,
      designation: item.designation,
    };
  });

  res.status(200).json({ 
    success: true,
    message: 'Teacher details fetched successfully',
    data: teacherData,
  });
});

exports.registerTeacher = catchAsyncError(async (req, res, next) => {
  const { name, teacherId, email, password, mobileNumber, department, designation, dateOfBirth, gender, address, teacherImage } = req.body;
  if (!name || !teacherId || !email || !password || !mobileNumber || !department || !designation || !dateOfBirth || !gender || !address || !teacherImage) {
    return next(new ErrorHandler('Missing fields', 400));
  }
  
  const teacher = await Teacher.create({ name, teacherId, email, password, mobileNumber, department, designation, dateOfBirth, gender, address, teacherImage });
  
  res.status(200).json({
    success: true,
    message: 'Teacher registered successfully',
    data: {
      id: teacher._id,
      name: teacher.name,
      teacherId: teacher.teacherId,
      email: teacher.email,
      department: teacher.department
    },
  });
});

exports.loginTeacher = catchAsyncError(async(req, res, next) => {
  const { teacherId, password } = req.body;

  if(!teacherId || !password){
    return next(new ErrorHandler('Missing fields', 400));
  }

  // Find a teacher by teacherId and explicitly include the password field in the query result
  const teacher = await Teacher.findOne({ teacherId }).select('+password');
  if(!teacher){
    return next(new ErrorHandler('Invalid teacher ID or password', 401));
  }

  const isPasswordCorrect = await teacher.comparePassword(password);
  if(!isPasswordCorrect){
    return next(new ErrorHandler('Invalid teacher ID or password', 401));
  }

  sendToken(teacher, 200, res);
})

exports.logoutTeacher = catchAsyncError(async(req, res, next) => {
  res.cookie('token', null, {
    expires: new Date(Date.now()),
    httpOnly: true,
  });
  res.status(200).json({
    success: true,
    message: 'Teacher logged out successfully',
  });
})


exports.getSingleTeacherDetails = catchAsyncError(async (req, res, next) => {
  const teacher = await Teacher.findById(req.params.id);
  if (!teacher) {
    return next(new ErrorHandler('Teacher not found', 404));
  }
  
  res.status(200).json({
    success: true,
      message: 'Teacher details fetched successfully',
    data: {
      id: teacher._id,
      name: teacher.name,
      teacherId: teacher.teacherId,
      email: teacher.email,
      mobileNumber: teacher.mobileNumber,
      department: teacher.department,
      designation: teacher.designation,
      dateOfBirth: formatDate(teacher.dateOfBirth),
      gender: teacher.gender,
      address: teacher.address,
      teacherImage: teacher.teacherImage,
    },
  });
});


exports.updateTeacher = catchAsyncError(async (req, res, next) => {
  const { mobileNumber, address, teacherImage } = req.body;
 
  if (!req.params.id) {
    return next(new ErrorHandler('Teacher not found', 400));
  }
 
  // Check if at least one field is provided
  const hasUpdateFields = mobileNumber || address || teacherImage;
 
  if (!hasUpdateFields) {
    return next(new ErrorHandler('Invalid: no data provided', 400));
  }
 
  const teacher = await Teacher.findById(req.params.id);
  if (!teacher) {
    return next(new ErrorHandler('Teacher not found', 404));
  }
 
  // Update fields
  if (mobileNumber) teacher.mobileNumber = mobileNumber;
  if (address) teacher.address = address;
  if (teacherImage !== undefined) teacher.teacherImage = teacherImage;
 
  await teacher.save();
 
  res.status(200).json({
    success: true,
    message: 'Teacher details updated successfully',
  });
});

exports.deleteTeacher = catchAsyncError(async (req, res, next) => {
  if (!req.params.id) {
    return next(new ErrorHandler('Teacher not found', 400));
  }
  const teacher = await Teacher.findById(req.params.id);
  if (!teacher) {
    return next(new ErrorHandler('Teacher not found', 404));
  }
  await teacher.deleteOne();
  res.status(200).json({
    success: true,
    message: 'Teacher deleted',
  });
});
