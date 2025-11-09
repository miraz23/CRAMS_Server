const Student = require('../models/studentModel');
const ErrorHandler = require('../utils/ErrorHandler');
const catchAsyncError = require('../middleware/CatchAsyncErrors');
const { formatDate, formatGPA } = require('../utils/helpers');
const { sendToken } = require('../utils/jwt');

exports.getAllStudentDetails = catchAsyncError(async (req, res, next) => {
  const students = await Student.find();
  const studentData = students.map((student) => {
    return {
      id: student._id,
      name: student.name,
      studentId: student.studentId,
      email: student.email,
      department: student.department
    };
  });
  res.status(200).json({
    success: true,
    message: 'Student details fetched successfully',
    data: studentData,
  });
});

exports.registerStudent = catchAsyncError(async (req, res, next) => {
  const { name, studentId, email, password, mobileNumber, department, fatherName, motherName, dateOfBirth, gender, religion, nationality, presentAddress, permanentAddress, sscBoardInstitute, sscGroup, sscPassingYear, sscGPA, hscBoardInstitute, hscGroup, hscPassingYear, hscGPA, studentImage } = req.body;
  if (!name || !studentId || !email || !password || !mobileNumber || !department || !fatherName || !motherName || !dateOfBirth || !gender || !religion || !nationality || !presentAddress || !permanentAddress || !sscBoardInstitute || !sscGroup || !sscPassingYear || !sscGPA || !hscBoardInstitute || !hscGroup || !hscPassingYear || !hscGPA || !studentImage) {
    return next(new ErrorHandler('Missing fields', 400));
  }
  
  const student = await Student.create({ name, studentId, email, password, mobileNumber, department, fatherName, motherName, dateOfBirth, gender, religion, nationality, presentAddress, permanentAddress, sscBoardInstitute, sscGroup, sscPassingYear, sscGPA, hscBoardInstitute, hscGroup, hscPassingYear, hscGPA, studentImage });
  
  res.status(200).json({
    success: true,
    message: 'Student registered successfully',
    data: {
      id: student._id,
      name: student.name,
      studentId: student.studentId,
      email: student.email,
      department: student.department
    },
  });
}); 

exports.loginStudent = catchAsyncError(async(req, res, next) => {
  const { studentId, password } = req.body;

  if(!studentId || !password){
    return next(new ErrorHandler('Missing fields', 400));
  }

  // Find a student by studentId and explicitly include the password field in the query result
  const student = await Student.findOne({ studentId }).select('+password');
  if(!student){
    return next(new ErrorHandler('Invalid student ID or password', 401));
  }

  const isPasswordCorrect = await student.comparePassword(password);
  if(!isPasswordCorrect){
    return next(new ErrorHandler('Invalid student ID or password', 401));
  }

  sendToken(student, 200, res);
})

exports.logoutStudent = catchAsyncError(async(req, res, next) => {
  res.cookie('token', null, {
    expires: new Date(Date.now()),
    httpOnly: true,
  });
  res.status(200).json({
    success: true,
    message: 'Student logged out successfully',
  });
})

exports.getSingleStudentDetails = catchAsyncError(async (req, res, next) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    return next(new ErrorHandler('Student not found', 404));
  }
  
  res.status(200).json({
    success: true,
    message: 'Student details fetched successfully',
    data: {
      id: student._id,
      name: student.name,
      studentId: student.studentId,
      email: student.email,
      mobileNumber: student.mobileNumber,
      department: student.department,
      fatherName: student.fatherName,
      motherName: student.motherName,
      dateOfBirth: formatDate(student.dateOfBirth),
      gender: student.gender,
      religion: student.religion,
      nationality: student.nationality,
      presentAddress: student.presentAddress,
      permanentAddress: student.permanentAddress,
      sscBoardInstitute: student.sscBoardInstitute,
      sscGroup: student.sscGroup,
      sscPassingYear: student.sscPassingYear,
      sscGPA: formatGPA(student.sscGPA),
      hscBoardInstitute: student.hscBoardInstitute,
      hscGroup: student.hscGroup,
      hscPassingYear: student.hscPassingYear,
      hscGPA: formatGPA(student.hscGPA),
      studentImage: student.studentImage,
    },
  });
});

exports.updateStudent = catchAsyncError(async (req, res, next) => {
  const { mobileNumber, presentAddress, permanentAddress, studentImage } = req.body;
 
  if (!req.params.id) {
    return next(new ErrorHandler('Student not found', 400));
  }
 
  // Check if at least one field is provided
  const hasUpdateFields = mobileNumber || presentAddress || permanentAddress || studentImage;
 
  if (!hasUpdateFields) {
    return next(new ErrorHandler('Invalid: no data provided', 400));
  }
 
  const student = await Student.findById(req.params.id);
  if (!student) {
    return next(new ErrorHandler('Student not found', 404));
  }
 
  // Update fields
  if (mobileNumber) student.mobileNumber = mobileNumber;
  if (presentAddress) student.presentAddress = presentAddress;
  if (permanentAddress) student.permanentAddress = permanentAddress;
  if (studentImage !== undefined) student.studentImage = studentImage;
 
  await student.save();
 
  res.status(200).json({
    success: true,
    message: 'Student details updated successfully',
    data: {
      mobileNumber: student.mobileNumber,
      presentAddress: student.presentAddress,
      permanentAddress: student.permanentAddress,
      studentImage: student.studentImage,
    },
  });
});

exports.deleteStudent = catchAsyncError(async (req, res, next) => {
  if (!req.params.id) {
    return next(new ErrorHandler('Student not found', 400));
  }
  const student = await Student.findById(req.params.id);
  if (!student) {
    return next(new ErrorHandler('Student not found', 404));
  }
  await student.deleteOne();
  res.status(200).json({
    success: true,
    message: 'Student deleted',
  });
});