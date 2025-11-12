const Teacher = require('../models/teacherModel');
const ErrorHandler = require('../utils/ErrorHandler');
const catchAsyncError = require('../middleware/CatchAsyncErrors');
const { sendToken } = require('../utils/jwt');

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
