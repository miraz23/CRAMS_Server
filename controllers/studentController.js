const Student = require('../models/studentModel');
const ErrorHandler = require('../utils/ErrorHandler');
const catchAsyncError = require('../middleware/CatchAsyncErrors');

exports.registerStudent = catchAsyncError(async (req, res, next) => {
  const { name, studentId, email, password, mobileNumber, department, fatherName, motherName, dateOfBirth, gender, religion, nationality, presentAddress, permanentAddress, sscBoardInstitute, sscGroup, sscPassingYear, sscGPA, hscBoardInstitute, hscGroup, hscPassingYear, hscGPA } = req.body;
  if (!name || !studentId || !email || !password || !mobileNumber || !department || !fatherName || !motherName || !dateOfBirth || !gender || !religion || !nationality || !presentAddress || !permanentAddress || !sscBoardInstitute || !sscGroup || !sscPassingYear || !sscGPA || !hscBoardInstitute || !hscGroup || !hscPassingYear || !hscGPA) {
    return next(new ErrorHandler('Missing fields', 400));
  }
  const student = await Student.create({ name, studentId, email, password, mobileNumber, department, fatherName, motherName, dateOfBirth, gender, religion, nationality, presentAddress, permanentAddress, sscBoardInstitute, sscGroup, sscPassingYear, sscGPA, hscBoardInstitute, hscGroup, hscPassingYear, hscGPA });
  
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