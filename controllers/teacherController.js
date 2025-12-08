const Teacher = require('../models/teacherModel');
const CourseRegistration = require('../models/courseRegistrationModel');
const Course = require('../models/courseModel');
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

// Get pending reviews for advisor
exports.getPendingReviews = catchAsyncError(async (req, res) => {
  const { semester } = req.query;

  const registrationQuery = { status: 'pending' };
  if (semester && semester !== 'All Semesters') {
    registrationQuery.semester = semester;
  }

  // Get all pending registrations with populated student and course data
  const registrations = await CourseRegistration.find(registrationQuery)
    .populate('student')
    .populate('course')
    .sort({ submittedAt: -1 });

  // Group registrations by student, storing registration references
  const pendingByStudent = registrations.reduce((acc, reg) => {
    const studentId = reg.student?._id?.toString() || reg.student?.toString();
    if (!studentId || !reg.student || !reg.course) return acc;

    if (!acc[studentId]) {
      acc[studentId] = {
        studentId: reg.student._id,
        studentName: reg.student.name || 'Unknown Student',
        studentIdNumber: reg.student.studentId || '',
        email: reg.student.email || '',
        cgpa: null, // CGPA calculation would require a grades model
        submittedAt: reg.submittedAt || reg.createdAt,
        registrations: [], // Store full registration objects
        totalRequestedCredits: 0,
        currentCredits: 0,
        hasIssues: false,
      };
    }

    const credit = reg.course.credits || 0;
    acc[studentId].registrations.push(reg);
    acc[studentId].totalRequestedCredits += credit;

    // Update submittedAt to earliest submission time
    if (reg.submittedAt && (!acc[studentId].submittedAt || reg.submittedAt < acc[studentId].submittedAt)) {
      acc[studentId].submittedAt = reg.submittedAt;
    }

    return acc;
  }, {});

  // Calculate current credits and check for issues for each student
  const studentIds = Object.keys(pendingByStudent);
  const reviewsWithDetails = await Promise.all(
    studentIds.map(async (studentId) => {
      const studentData = pendingByStudent[studentId];
      const studentMongoId = studentData.studentId;

      // Get all approved courses for current credits calculation
      const approvedRegistrations = await CourseRegistration.find({
        student: studentMongoId,
        status: 'approved',
      }).populate('course');

      studentData.currentCredits = approvedRegistrations.reduce(
        (sum, reg) => sum + (reg.course?.credits || 0),
        0
      );

      // Process each registration and check for issues
      const courses = studentData.registrations.map((reg) => {
        const courseData = reg.course;
        const issues = [];

        // Check prerequisites
        if (courseData.prerequisite) {
          const prerequisiteCodes = courseData.prerequisite.split(',').map(code => code.trim());
          const completedCourseCodes = approvedRegistrations.map(reg => reg.course?.courseCode).filter(Boolean);
          const hasPrerequisite = prerequisiteCodes.some(code => completedCourseCodes.includes(code));
          
          if (!hasPrerequisite) {
            issues.push({
              type: 'prerequisite',
              message: 'Prerequisites Not Met',
            });
            studentData.hasIssues = true;
          }
        }

        // Check seat availability - need to fetch fresh course data for accurate seat count
        const enrolledCount = courseData.enrolledStudents ? courseData.enrolledStudents.length : 0;
        const totalSeats = (courseData.regularSeats || 0) + (courseData.irregularSeats || 0);
        const availableSeats = Math.max(0, totalSeats - enrolledCount);

        if (availableSeats <= 3 && availableSeats > 0) {
          issues.push({
            type: 'seats',
            message: `Only ${availableSeats} seat${availableSeats !== 1 ? 's' : ''} left`,
          });
          // Note: Low seats might not be considered a critical issue, but we'll include it
        } else if (availableSeats === 0) {
          issues.push({
            type: 'seats',
            message: 'No seats available',
          });
          studentData.hasIssues = true;
        }

        return {
          registrationId: reg._id,
          courseId: courseData._id,
          courseCode: courseData.courseCode || '',
          courseName: courseData.courseName || '',
          credits: courseData.credits || 0,
          schedule: courseData.schedule || { days: [], startTime: '', endTime: '' },
          semester: reg.semester,
          issues,
        };
      });

      return {
        ...studentData,
        courses,
      };
    })
  );

  // Format schedule for display (e.g., "Sun 10:00 AM - 12:00 PM" or "Mon, Wed 2:00 PM - 3:30 PM")
  const formatSchedule = (schedule) => {
    if (!schedule || !schedule.days || schedule.days.length === 0) {
      return '';
    }
    const days = schedule.days.join(', ');
    const time = schedule.startTime && schedule.endTime 
      ? `${schedule.startTime} - ${schedule.endTime}`
      : '';
    return time ? `${days} ${time}` : days;
  };

  // Format date for display (e.g., "Mar 3, 2025 10:30 AM")
  const formatDateTime = (date) => {
    if (!date) return null;
    const d = new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const day = d.getDate();
    const year = d.getFullYear();
    
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const timeStr = `${hours}:${minutes} ${ampm}`;
    
    return `${month} ${day}, ${year} ${timeStr}`;
  };

  // Format the response data
  const formattedReviews = reviewsWithDetails.map((review) => ({
    studentId: review.studentId,
    studentName: review.studentName,
    studentIdNumber: review.studentIdNumber,
    email: review.email,
    cgpa: review.cgpa,
    submittedAt: review.submittedAt,
    submittedAtFormatted: formatDateTime(review.submittedAt),
    currentCredits: review.currentCredits,
    requestedCredits: review.totalRequestedCredits,
    totalCourses: review.courses.length,
    hasIssues: review.hasIssues,
    courses: review.courses.map((course) => ({
      registrationId: course.registrationId,
      courseId: course.courseId,
      courseCode: course.courseCode,
      courseName: course.courseName,
      credits: course.credits,
      schedule: formatSchedule(course.schedule),
      scheduleDetails: course.schedule,
      issues: course.issues,
      hasIssues: course.issues.length > 0,
    })),
  }));

  // Calculate summary statistics
  const totalPending = formattedReviews.length;
  const withIssues = formattedReviews.filter(review => review.hasIssues).length;

  res.status(200).json({
    success: true,
    message: 'Pending reviews fetched successfully',
    data: {
      summary: {
        totalPending,
        withIssues,
      },
      reviews: formattedReviews,
    },
  });
});