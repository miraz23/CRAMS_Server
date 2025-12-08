const Teacher = require('../models/teacherModel');
const CourseRegistration = require('../models/courseRegistrationModel');
const Student = require('../models/studentModel');
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
  
  // Validate email domain for teachers
  if (!email.endsWith('@iiuc.ac.bd')) {
    return next(new ErrorHandler('Only emails with @iiuc.ac.bd domain are allowed for teacher registration', 400));
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

// Advisor dashboard overview for teachers
exports.getAdvisorDashboard = catchAsyncError(async (req, res) => {
  const { semester } = req.query;

  const registrationQuery = {};
  if (semester && semester !== 'All Semesters') {
    registrationQuery.semester = semester;
  }

  const registrations = await CourseRegistration.find(registrationQuery)
    .populate('student')
    .populate('course')
    .sort({ submittedAt: -1 });

  const pendingByStudent = registrations
    .filter((reg) => reg.status === 'pending')
    .reduce((acc, reg) => {
      const key = reg.student?._id?.toString() || reg.student?.toString() || reg._id.toString();

      if (!acc[key]) {
        acc[key] = {
          studentMongoId: reg.student?._id || null,
          studentId: reg.student?.studentId || '',
          studentName: reg.student?.name || 'Unknown Student',
          submittedAt: reg.submittedAt || reg.createdAt,
          courses: [],
          totalCredits: 0,
        };
      }

      const credit = reg.course?.credits || 0;
      acc[key].courses.push({
        registrationId: reg._id,
        courseId: reg.course?._id || null,
        courseCode: reg.course?.courseCode || '',
        courseName: reg.course?.courseName || '',
        credits: credit,
        semester: reg.semester,
      });

      acc[key].totalCredits += credit;

      if (reg.submittedAt && (!acc[key].submittedAt || reg.submittedAt < acc[key].submittedAt)) {
        acc[key].submittedAt = reg.submittedAt;
      }

      return acc;
    }, {});

  const pendingReviews = Object.keys(pendingByStudent).length;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const approvedToday = registrations.filter(
    (reg) => reg.status === 'approved' && reg.approvedAt && reg.approvedAt >= startOfToday
  ).length;

  const totalStudents = semester
    ? (await CourseRegistration.distinct('student', registrationQuery)).length
    : await Student.countDocuments();

  const turnaroundHours = registrations
    .filter((reg) => ['approved', 'rejected'].includes(reg.status))
    .filter((reg) => reg.submittedAt && (reg.approvedAt || reg.rejectedAt))
    .map((reg) => {
      const end = reg.approvedAt || reg.rejectedAt;
      return (end - reg.submittedAt) / (1000 * 60 * 60);
    });

  const avgResponseTimeHours = turnaroundHours.length
    ? Number(
      (turnaroundHours.reduce((sum, val) => sum + val, 0) / turnaroundHours.length)
        .toFixed(2)
    )
    : 0;

  const urgentReviews = Object.values(pendingByStudent)
    .sort((a, b) => {
      const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return aTime - bTime;
    })
    .slice(0, 5)
    .map((item) => ({
      studentMongoId: item.studentMongoId,
      studentId: item.studentId,
      studentName: item.studentName,
      submittedAt: item.submittedAt,
      courseCount: item.courses.length,
      totalCredits: item.totalCredits,
      courses: item.courses,
    }));

  const recentActivity = registrations
    .filter((reg) => ['approved', 'rejected'].includes(reg.status) && (reg.approvedAt || reg.rejectedAt))
    .sort((a, b) => {
      const aTime = new Date(a.approvedAt || a.rejectedAt).getTime();
      const bTime = new Date(b.approvedAt || b.rejectedAt).getTime();
      return bTime - aTime;
    })
    .slice(0, 6)
    .map((reg) => ({
      studentMongoId: reg.student?._id || null,
      studentId: reg.student?.studentId || '',
      studentName: reg.student?.name || 'Unknown Student',
      courseCode: reg.course?.courseCode || '',
      courseName: reg.course?.courseName || '',
      status: reg.status,
      actedAt: reg.approvedAt || reg.rejectedAt || reg.updatedAt || reg.createdAt,
      rejectionReason: reg.status === 'rejected' ? reg.rejectionReason || '' : undefined,
    }));

  res.status(200).json({
    success: true,
    message: 'Advisor dashboard data fetched successfully',
    data: {
      summary: {
        pendingReviews,
        approvedToday,
        totalStudents,
        avgResponseTimeHours,
      },
      urgentReviews,
      recentActivity,
    },
  });
});
