const Teacher = require('../models/teacherModel');
const CourseRegistration = require('../models/courseRegistrationModel');
const Course = require('../models/courseModel');
const Student = require('../models/studentModel');
const Section = require('../models/sectionModel');
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
  if (!name || !email || !password ) {
    return next(new ErrorHandler('Missing fields', 400));
  }
  
  // Validate email domain for teachers
  if (!email.endsWith('@iiuc.ac.bd')) {
    return next(new ErrorHandler('Only emails with @iiuc.ac.bd domain are allowed for teacher registration', 400));
  }
  
  const teacher = await Teacher.create({ name, email, password });
  
  res.status(200).json({
    success: true,
    message: 'Teacher registered successfully',
    data: {
      id: teacher._id,
      name: teacher.name,
      email: teacher.email
    },
  });
});

exports.loginTeacher = catchAsyncError(async(req, res, next) => {
  const { email, password } = req.body;

  if(!email || !password){
    return next(new ErrorHandler('Missing fields', 400));
  }

  // Find a teacher by email and explicitly include the password field in the query result
  const teacher = await Teacher.findOne({ email }).select('+password');
  if(!teacher){
    return next(new ErrorHandler('Invalid email or password', 401));
  }

  const isPasswordCorrect = await teacher.comparePassword(password);
  if(!isPasswordCorrect){
    return next(new ErrorHandler('Invalid email or password', 401));
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

        // Note: Seat availability is already checked during course registration, so we don't check it here

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

// Get my students for advisor dashboard
exports.getMyStudents = catchAsyncError(async (req, res) => {
  const teacherId = req.teacher.teacherId;
  const { search, semester } = req.query;

  // Find all sections assigned to this advisor
  const sections = await Section.find({ 
    assignedAdvisor: teacherId,
    status: 'active'
  });

  // Get section names assigned to this advisor (normalized to uppercase)
  const sectionNames = sections.map(s => s.sectionName ? s.sectionName.trim().toUpperCase() : null).filter(Boolean);

  // If advisor has no sections, return empty result
  if (sectionNames.length === 0) {
    return res.status(200).json({
      success: true,
      message: 'My students fetched successfully',
      data: {
        summary: {
          totalStudents: 0,
          pendingReviews: 0,
          averageCGPA: null,
        },
        students: [],
      },
    });
  }

  // Get all students registered in advisor's sections
  const students = await Student.find({ 
    section: { $in: sectionNames }
  });

  // If no students found, return empty result
  if (students.length === 0) {
    return res.status(200).json({
      success: true,
      message: 'My students fetched successfully',
      data: {
        summary: {
          totalStudents: 0,
          pendingReviews: 0,
          averageCGPA: null,
        },
        students: [],
      },
    });
  }

  // Get student IDs
  const studentIds = students.map(s => s._id);

  // Build query for course registrations
  const registrationQuery = {
    student: { $in: studentIds }
  };
  
  if (semester && semester !== 'All Semesters') {
    registrationQuery.semester = semester;
  }

  // Get section info for students to determine their semester FIRST
  // This ensures we use the student's actual semester, not the course semester
  const studentSections = await Section.find({ 
    sectionName: { $in: sectionNames },
    status: 'active'
  });
  
  const sectionSemesterMap = {};
  studentSections.forEach(section => {
    sectionSemesterMap[section.sectionName] = section.semester;
  });

  // Create a map of student ID to their actual semester from their section
  const studentSemesterMap = {};
  students.forEach((student) => {
    const studentSection = student.section ? student.section.toUpperCase() : null;
    const semesterFromSection = studentSection && sectionSemesterMap[studentSection] 
      ? sectionSemesterMap[studentSection] 
      : null;
    studentSemesterMap[student._id.toString()] = semesterFromSection;
  });

  // Get all course registrations for students in advisor's sections
  const registrations = await CourseRegistration.find(registrationQuery)
    .populate('student')
    .populate('course');

  // Get unique students
  const studentMap = new Map();
  
  registrations.forEach((reg) => {
    if (!reg.student) return;
    
    const studentId = reg.student._id.toString();
    
    if (!studentMap.has(studentId)) {
      // Use the student's actual semester from their section, not from course registrations
      const studentSemester = studentSemesterMap[studentId] || null;
      
      studentMap.set(studentId, {
        _id: reg.student._id,
        studentId: reg.student.studentId,
        name: reg.student.name,
        email: reg.student.email,
        mobileNumber: reg.student.mobileNumber,
        department: reg.student.department,
        studentImage: reg.student.studentImage || '',
        registrations: [],
        pendingCount: 0,
        totalCredits: 0,
        currentSemester: studentSemester, // Use student's actual semester from section
      });
    }
    
    const student = studentMap.get(studentId);
    student.registrations.push(reg);
    
    // Count pending registrations
    if (reg.status === 'pending') {
      student.pendingCount++;
    }
    
    // DO NOT update semester based on course registrations
    // The student's semester should remain their actual semester from their section
  });

  students.forEach((student) => {
    const studentId = student._id.toString();
    if (!studentMap.has(studentId)) {
      // Get semester from student's section (already mapped above)
      const studentSemester = studentSemesterMap[studentId] || null;
      
      studentMap.set(studentId, {
        _id: student._id,
        studentId: student.studentId,
        name: student.name,
        email: student.email,
        mobileNumber: student.mobileNumber,
        department: student.department,
        studentImage: student.studentImage || '',
        registrations: [],
        pendingCount: 0,
        totalCredits: 0,
        currentSemester: studentSemester,
      });
    }
  });

  // Process each student to calculate credits and CGPA
  const studentsArray = await Promise.all(
    Array.from(studentMap.values()).map(async (student) => {
      // Calculate total credits from approved courses
      const approvedRegistrations = student.registrations.filter(
        (reg) => reg.status === 'approved' && reg.course
      );
      
      const totalCredits = approvedRegistrations.reduce(
        (sum, reg) => sum + (reg.course?.credits || 0),
        0
      );

      // Calculate CGPA (simplified - assuming 4.0 scale)
      // In a real system, this would use grades from a grades model
      // For now, we'll use a placeholder or calculate based on approved courses
      // Since we don't have grades, we'll set CGPA to null or calculate a simple average
      let cgpa = null;
      
      // If you have a grades model, you would calculate CGPA here
      // For now, we'll use a placeholder value or leave it null
      // You can replace this with actual CGPA calculation when grades are available
      
      // Extract semester number from semester string (e.g., "7th Semester" -> 7)
      let semesterNumber = null;
      if (student.currentSemester) {
        const match = student.currentSemester.match(/(\d+)/);
        if (match) {
          semesterNumber = match[1];
        }
      }

      return {
        _id: student._id,
        studentId: student.studentId,
        name: student.name,
        email: student.email,
        mobileNumber: student.mobileNumber,
        department: student.department,
        studentImage: student.studentImage,
        cgpa: cgpa,
        credits: totalCredits,
        semester: student.currentSemester || 'N/A',
        semesterNumber: semesterNumber,
        status: 'Active', // You can add status logic based on your requirements
        pendingCount: student.pendingCount,
      };
    })
  );

  // Apply search filter if provided
  let filteredStudents = studentsArray;
  if (search && search.trim()) {
    const searchLower = search.toLowerCase().trim();
    filteredStudents = studentsArray.filter((student) => {
      return (
        student.name.toLowerCase().includes(searchLower) ||
        student.studentId.toLowerCase().includes(searchLower) ||
        student.email.toLowerCase().includes(searchLower)
      );
    });
  }

  // Calculate summary statistics
  const totalStudents = filteredStudents.length;
  const totalPendingReviews = filteredStudents.reduce(
    (sum, student) => sum + student.pendingCount,
    0
  );
  
  // Calculate average CGPA (excluding null values)
  const cgpaValues = filteredStudents
    .map((s) => s.cgpa)
    .filter((cgpa) => cgpa !== null && cgpa !== undefined);
  const averageCGPA = cgpaValues.length > 0
    ? Number((cgpaValues.reduce((sum, val) => sum + val, 0) / cgpaValues.length).toFixed(2))
    : null;

  res.status(200).json({
    success: true,
    message: 'My students fetched successfully',
    data: {
      summary: {
        totalStudents,
        pendingReviews: totalPendingReviews,
        averageCGPA: averageCGPA,
      },
      students: filteredStudents,
    },
  });
});

// Get single student details for advisor
exports.getStudentDetails = catchAsyncError(async (req, res, next) => {
  const { studentId } = req.params;
  const teacherId = req.teacher.teacherId;

  if (!studentId) {
    return next(new ErrorHandler('Student ID is required', 400));
  }

  // Find student
  const student = await Student.findById(studentId);
  if (!student) {
    return next(new ErrorHandler('Student not found', 404));
  }

  // Verify student belongs to advisor's sections (optional check)
  // Get advisor's sections
  const sections = await Section.find({ 
    assignedAdvisor: teacherId,
    status: 'active'
  });
  const advisorSemesters = [...new Set(sections.map(s => s.semester))];

  // Get student's course registrations
  const registrations = await CourseRegistration.find({
    student: studentId,
    semester: { $in: advisorSemesters }
  })
    .populate('course')
    .sort({ semester: -1, createdAt: -1 });

  // Calculate student statistics
  const approvedRegistrations = registrations.filter((reg) => reg.status === 'approved');
  const pendingRegistrations = registrations.filter((reg) => reg.status === 'pending');
  const rejectedRegistrations = registrations.filter((reg) => reg.status === 'rejected');

  const totalCredits = approvedRegistrations.reduce(
    (sum, reg) => sum + (reg.course?.credits || 0),
    0
  );

  // Get current semester (most recent)
  const currentSemester = registrations.length > 0 
    ? registrations[0].semester 
    : null;

  // Extract semester number
  let semesterNumber = null;
  if (currentSemester) {
    const match = currentSemester.match(/(\d+)/);
    if (match) {
      semesterNumber = match[1];
    }
  }

  // Format registrations for response
  const courseRegistrations = registrations.map((reg) => ({
    registrationId: reg._id,
    courseId: reg.course?._id || null,
    courseCode: reg.course?.courseCode || '',
    courseName: reg.course?.courseName || '',
    credits: reg.course?.credits || 0,
    semester: reg.semester,
    status: reg.status,
    submittedAt: reg.submittedAt,
    approvedAt: reg.approvedAt,
    rejectedAt: reg.rejectedAt,
    rejectionReason: reg.rejectionReason || '',
  }));

  res.status(200).json({
    success: true,
    message: 'Student details fetched successfully',
    data: {
      student: {
        _id: student._id,
        studentId: student.studentId,
        name: student.name,
        email: student.email,
        mobileNumber: student.mobileNumber,
        department: student.department,
        studentImage: student.studentImage || '',
        dateOfBirth: formatDate(student.dateOfBirth),
        gender: student.gender,
        presentAddress: student.presentAddress,
        permanentAddress: student.permanentAddress,
      },
      academic: {
        cgpa: null, // Would need grades model to calculate
        credits: totalCredits,
        semester: currentSemester,
        semesterNumber: semesterNumber,
        status: 'Active',
      },
      registrations: {
        total: registrations.length,
        approved: approvedRegistrations.length,
        pending: pendingRegistrations.length,
        rejected: rejectedRegistrations.length,
        courses: courseRegistrations,
      },
    },
  });
});

// Get approved courses for advisor dashboard
exports.getApprovedCourses = catchAsyncError(async (req, res) => {
  const teacherId = req.teacher.teacherId;
  const { semester, startDate, endDate, studentId, courseCode, format } = req.query;

  // Build query for approved courses
  const registrationQuery = { status: 'approved' };
  
  if (semester && semester !== 'All Semesters') {
    registrationQuery.semester = semester;
  }

  if (startDate || endDate) {
    registrationQuery.approvedAt = {};
    if (startDate) {
      registrationQuery.approvedAt.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      registrationQuery.approvedAt.$lte = end;
    }
  }

  // Get advisor's sections to filter by assigned students
  const sections = await Section.find({ 
    assignedAdvisor: teacherId,
    status: 'active'
  });
  const advisorSemesters = [...new Set(sections.map(s => s.semester))];

  // If advisor has assigned semesters, filter by them (unless specific semester is provided)
  if (advisorSemesters.length > 0 && !semester) {
    registrationQuery.semester = { $in: advisorSemesters };
  }

  // Get all approved registrations
  let registrations = await CourseRegistration.find(registrationQuery)
    .populate('student')
    .populate('course')
    .sort({ approvedAt: -1 });

  // Filter by studentId if provided
  if (studentId) {
    registrations = registrations.filter(reg => 
      reg.student && reg.student.studentId && reg.student.studentId.toLowerCase().includes(studentId.toLowerCase())
    );
  }

  // Filter by courseCode if provided
  if (courseCode) {
    registrations = registrations.filter(reg => 
      reg.course && reg.course.courseCode && reg.course.courseCode.toLowerCase().includes(courseCode.toLowerCase())
    );
  }

  // Calculate summary statistics
  const totalApproved = registrations.length;

  // Calculate "This Week" - approved courses in the current week
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
  startOfWeek.setHours(0, 0, 0, 0);
  
  const approvedThisWeek = registrations.filter(reg => 
    reg.approvedAt && reg.approvedAt >= startOfWeek
  ).length;

  // Calculate total credits
  const totalCredits = registrations.reduce((sum, reg) => 
    sum + (reg.course?.credits || 0), 0
  );

  // Format date helper (e.g., "Mar 1, 2025")
  const formatApprovalDate = (date) => {
    if (!date) return null;
    const d = new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const day = d.getDate();
    const year = d.getFullYear();
    return `${month} ${day}, ${year}`;
  };

  // Format recent approvals
  const recentApprovals = registrations.map((reg) => ({
    registrationId: reg._id,
    courseCode: reg.course?.courseCode || '',
    courseName: reg.course?.courseName || '',
    credits: reg.course?.credits || 0,
    status: reg.status,
    studentId: reg.student?.studentId || '',
    studentName: reg.student?.name || 'Unknown Student',
    studentMongoId: reg.student?._id || null,
    approvalDate: reg.approvedAt,
    approvalDateFormatted: formatApprovalDate(reg.approvedAt),
    advisorFeedback: reg.advisorFeedback || '',
    semester: reg.semester,
  }));

  // If export format is requested (CSV)
  if (format === 'csv' || format === 'export') {
    const csvHeader = 'Course Code,Course Name,Credits,Student ID,Student Name,Approval Date,Feedback,Semester\n';
    const csvRows = recentApprovals.map(approval => {
      const escapeCSV = (str) => {
        if (!str) return '';
        const string = String(str);
        if (string.includes(',') || string.includes('"') || string.includes('\n')) {
          return `"${string.replace(/"/g, '""')}"`;
        }
        return string;
      };
      
      return [
        escapeCSV(approval.courseCode),
        escapeCSV(approval.courseName),
        approval.credits,
        escapeCSV(approval.studentId),
        escapeCSV(approval.studentName),
        escapeCSV(approval.approvalDateFormatted || ''),
        escapeCSV(approval.advisorFeedback),
        escapeCSV(approval.semester),
      ].join(',');
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="approved-courses-report.csv"');
    return res.status(200).send(csvHeader + csvRows);
  }

  // Return JSON response
  res.status(200).json({
    success: true,
    message: 'Approved courses fetched successfully',
    data: {
      summary: {
        totalApproved,
        approvedThisWeek,
        totalCredits,
      },
      recentApprovals,
    },
  });
});

// Approve a single course registration
exports.approveRegistration = catchAsyncError(async (req, res, next) => {
  const { registrationId } = req.params;
  const { feedback } = req.body;

  if (!registrationId) {
    return next(new ErrorHandler('Registration ID is required', 400));
  }

  const registration = await CourseRegistration.findById(registrationId)
    .populate('student')
    .populate('course');

  if (!registration) {
    return next(new ErrorHandler('Registration not found', 404));
  }

  if (registration.status !== 'pending') {
    return next(new ErrorHandler(`Registration is already ${registration.status}`, 400));
  }

  registration.status = 'approved';
  registration.approvedAt = new Date();
  if (feedback) {
    registration.advisorFeedback = feedback;
  }
  await registration.save();

  res.status(200).json({
    success: true,
    message: 'Course registration approved successfully',
    data: {
      registrationId: registration._id,
      courseCode: registration.course?.courseCode,
      studentId: registration.student?.studentId,
      status: registration.status,
    },
  });
});

// Reject a single course registration
exports.rejectRegistration = catchAsyncError(async (req, res, next) => {
  const { registrationId } = req.params;
  const { rejectionReason } = req.body;

  if (!registrationId) {
    return next(new ErrorHandler('Registration ID is required', 400));
  }

  const registration = await CourseRegistration.findById(registrationId)
    .populate('student')
    .populate('course');

  if (!registration) {
    return next(new ErrorHandler('Registration not found', 404));
  }

  if (registration.status !== 'pending') {
    return next(new ErrorHandler(`Registration is already ${registration.status}`, 400));
  }

  registration.status = 'rejected';
  registration.rejectedAt = new Date();
  if (rejectionReason) {
    registration.rejectionReason = rejectionReason;
  }
  await registration.save();

  res.status(200).json({
    success: true,
    message: 'Course registration rejected successfully',
    data: {
      registrationId: registration._id,
      courseCode: registration.course?.courseCode,
      studentId: registration.student?.studentId,
      status: registration.status,
    },
  });
});

// Bulk approve all registrations for a student
exports.bulkApproveRegistrations = catchAsyncError(async (req, res, next) => {
  const { studentId } = req.params;
  const { registrationIds, feedback } = req.body;

  if (!studentId) {
    return next(new ErrorHandler('Student ID is required', 400));
  }

  // Build query - if registrationIds are provided, use them; otherwise approve all pending for student
  const query = {
    student: studentId,
    status: 'pending',
  };

  if (registrationIds && Array.isArray(registrationIds) && registrationIds.length > 0) {
    // Filter out any null/undefined values and ensure we have valid IDs
    const validIds = registrationIds.filter(id => id != null && id !== '');
    if (validIds.length > 0) {
      query._id = { $in: validIds };
    }
  }

  // Find all matching registrations first
  const registrations = await CourseRegistration.find(query)
    .populate('course');

  if (registrations.length === 0) {
    return next(new ErrorHandler('No pending registrations found', 404));
  }

  // Get the actual IDs from the found registrations to ensure we update the correct ones
  const idsToUpdate = registrations.map(reg => reg._id);

  const now = new Date();
  const updateData = {
    status: 'approved',
    approvedAt: now,
  };
  if (feedback) {
    updateData.advisorFeedback = feedback;
  }

  // Update using the actual IDs found
  const updateResult = await CourseRegistration.updateMany(
    { _id: { $in: idsToUpdate } },
    updateData
  );

  res.status(200).json({
    success: true,
    message: `${updateResult.modifiedCount} course registration(s) approved successfully`,
    data: {
      approvedCount: updateResult.modifiedCount,
      foundCount: registrations.length,
    },
  });
});

// Bulk reject all registrations for a student
exports.bulkRejectRegistrations = catchAsyncError(async (req, res, next) => {
  const { studentId } = req.params;
  const { registrationIds, rejectionReason } = req.body;

  if (!studentId) {
    return next(new ErrorHandler('Student ID is required', 400));
  }

  // Build query - if registrationIds are provided, use them; otherwise reject all pending for student
  const query = {
    student: studentId,
    status: 'pending',
  };

  if (registrationIds && Array.isArray(registrationIds) && registrationIds.length > 0) {
    // Filter out any null/undefined values and ensure we have valid IDs
    const validIds = registrationIds.filter(id => id != null && id !== '');
    if (validIds.length > 0) {
      query._id = { $in: validIds };
    }
  }

  // Find all matching registrations first
  const registrations = await CourseRegistration.find(query)
    .populate('course');

  if (registrations.length === 0) {
    return next(new ErrorHandler('No pending registrations found', 404));
  }

  // Get the actual IDs from the found registrations to ensure we update the correct ones
  const idsToUpdate = registrations.map(reg => reg._id);

  const now = new Date();
  const updateData = {
    status: 'rejected',
    rejectedAt: now,
  };
  if (rejectionReason) {
    updateData.rejectionReason = rejectionReason;
  }

  // Update using the actual IDs found
  const updateResult = await CourseRegistration.updateMany(
    { _id: { $in: idsToUpdate } },
    updateData
  );

  res.status(200).json({
    success: true,
    message: `${updateResult.modifiedCount} course registration(s) rejected successfully`,
    data: {
      rejectedCount: updateResult.modifiedCount,
      foundCount: registrations.length,
    },
  });
});