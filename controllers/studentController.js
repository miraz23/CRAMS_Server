const Student = require('../models/studentModel');
const ErrorHandler = require('../utils/ErrorHandler');
const catchAsyncError = require('../middleware/CatchAsyncErrors');
const CourseRegistration = require('../models/courseRegistrationModel');
const { formatDate, formatGPA } = require('../utils/helpers');
const { sendToken } = require('../utils/jwt');

exports.getAllStudentDetails = catchAsyncError(async (req, res, next) => {
  const students = await Student.find();
  const studentData = students.map((student) => {
    return {
      id: student._id,
      name: student.name,
      studentId: student.studentId,
      email: student.email
    };
  });
  res.status(200).json({
    success: true,
    message: 'Student details fetched successfully',
    data: studentData,
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

// Get the authenticated student's class schedule
exports.getStudentSchedule = catchAsyncError(async (req, res, next) => {
  const { semester, status } = req.query;
  const statusFilter = status
    ? status.split(',').map((item) => item.trim()).filter(Boolean)
    : ['approved'];

  const query = { student: req.student._id };
  if (semester) {
    query.semester = semester;
  }
  if (statusFilter.length > 0) {
    query.status = { $in: statusFilter };
  }

  const registrations = await CourseRegistration.find(query)
    .populate('course')
    .populate('section');
  
  // Get student's section to access section-specific schedules
  const Student = require('../models/studentModel');
  const student = await Student.findById(req.student._id).populate('section');
  const studentSection = student?.section;

  // Fetch all teachers to map instructor IDs to names
  const Teacher = require('../models/teacherModel');
  const teachers = await Teacher.find({}, 'teacherId name');
  const teacherMap = new Map();
  teachers.forEach(teacher => {
    if (teacher.teacherId) {
      teacherMap.set(teacher.teacherId, teacher.name);
    }
  });

  // Helper to sort time strings like "10:00 AM"
  const parseTime = (timeStr) => {
    if (!timeStr) return Infinity;
    const [time, period] = timeStr.split(' ');
    const [hours, minutes] = time.split(':');
    let hour24 = parseInt(hours, 10);
    if (period === 'PM' && hour24 !== 12) hour24 += 12;
    if (period === 'AM' && hour24 === 12) hour24 = 0;
    return hour24 * 60 + parseInt(minutes || 0, 10);
  };

  const daysTemplate = { Sun: [], Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [] };
  const courses = [];

  registrations.forEach((reg) => {
    if (!reg.course) return;

    const course = reg.course;
    const courseId = course._id.toString();
    
    // Check for section-specific schedule first
    let courseSchedule = null;
    const sectionToCheck = reg.section || studentSection;
    
    if (sectionToCheck && sectionToCheck.courseSchedules && sectionToCheck.courseSchedules instanceof Map) {
      const sectionSchedule = sectionToCheck.courseSchedules.get(courseId);
      if (sectionSchedule) {
        courseSchedule = sectionSchedule;
      }
    } else if (sectionToCheck && sectionToCheck.courseSchedules && typeof sectionToCheck.courseSchedules === 'object') {
      // Handle case where courseSchedules is already an object (from JSON)
      const sectionSchedule = sectionToCheck.courseSchedules[courseId];
      if (sectionSchedule) {
        courseSchedule = sectionSchedule;
      }
    }
    
    // Fall back to course default schedule if no section-specific schedule found
    if (!courseSchedule) {
      courseSchedule = course.schedule || { days: [], startTime: '', endTime: '', daySchedules: [] };
    }

    // Resolve instructor name(s)
    let instructorName = '';
    const sectionToCheckForInstructor = reg.section || studentSection;
    const sectionName = sectionToCheckForInstructor?.sectionName;

    // Check if course uses section-specific instructor assignments
    const hasSectionSpecificInstructors = course.instructorSections && 
      Array.isArray(course.instructorSections) && 
      course.instructorSections.length > 0;

    // First, try to find section-specific instructor
    if (sectionName && hasSectionSpecificInstructors) {
      const sectionInstructor = course.instructorSections.find(instSec => 
        instSec.sections && instSec.sections.includes(sectionName)
      );
      
      if (sectionInstructor && sectionInstructor.instructorId) {
        instructorName = teacherMap.get(sectionInstructor.instructorId) || sectionInstructor.instructorId;
      }
      // If section-specific assignments exist but this section has no instructor, leave as empty (will show TBA)
    } else if (!hasSectionSpecificInstructors) {
      // Only use general instructors if section-specific assignments are NOT being used
      if (Array.isArray(course.instructors) && course.instructors.length > 0) {
        const instructorNames = course.instructors
          .map(id => teacherMap.get(id) || id)
          .filter(Boolean);
        instructorName = instructorNames.length > 0 ? instructorNames.join(', ') : '';
      } else if (course.instructor) {
        // Check if instructor is an ID or a name
        instructorName = teacherMap.get(course.instructor) || course.instructor;
      }
    }
    // If hasSectionSpecificInstructors is true but no match found, instructorName remains empty (TBA)

    const courseInfo = {
      id: course._id,
      registrationId: reg._id,
      courseCode: course.courseCode,
      courseName: course.courseName,
      credits: course.credits,
      instructor: instructorName || '',
      prerequisite: course.prerequisite || '',
      schedule: courseSchedule,
      semester: reg.semester,
      status: reg.status,
    };

    courses.push(courseInfo);

    // Handle new daySchedules structure (per-day scheduling)
    if (courseSchedule.daySchedules && Array.isArray(courseSchedule.daySchedules) && courseSchedule.daySchedules.length > 0) {
      courseSchedule.daySchedules.forEach((daySchedule) => {
        const day = daySchedule.day;
        if (!daysTemplate[day]) return;
        daysTemplate[day].push({
          courseId: course._id,
          courseCode: course.courseCode,
          courseName: course.courseName,
          instructor: instructorName || '',
          startTime: daySchedule.startTime || '',
          endTime: daySchedule.endTime || '',
          room: daySchedule.room || '',
          status: reg.status,
        });
      });
    } else {
      // Handle legacy structure (single time for all days)
      (courseSchedule.days || []).forEach((day) => {
        if (!daysTemplate[day]) return;
        daysTemplate[day].push({
          courseId: course._id,
          courseCode: course.courseCode,
          courseName: course.courseName,
          instructor: instructorName || '',
          startTime: courseSchedule.startTime || '',
          endTime: courseSchedule.endTime || '',
          room: courseSchedule.room || '',
          status: reg.status,
        });
      });
    }
  });

  // Sort classes within each day by start time and drop empty days
  const weeklySchedule = Object.keys(daysTemplate).reduce((acc, day) => {
    if (daysTemplate[day].length === 0) return acc;
    acc[day] = daysTemplate[day].sort(
      (a, b) => parseTime(a.startTime) - parseTime(b.startTime)
    );
    return acc;
  }, {});

  const totalCredits = courses.reduce((sum, course) => sum + (course.credits || 0), 0);
  const summary = {
    totalCourses: courses.length,
    totalCredits,
    daysWithClasses: Object.keys(weeklySchedule),
  };

  res.status(200).json({
    success: true,
    message: 'Schedule fetched successfully',
    data: {
      semester: semester || (registrations[0]?.semester || null),
      courses,
      weeklySchedule,
      summary,
    },
  });
});