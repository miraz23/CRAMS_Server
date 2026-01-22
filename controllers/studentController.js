const Student = require('../models/studentModel');
const ErrorHandler = require('../utils/ErrorHandler');
const catchAsyncError = require('../middleware/CatchAsyncErrors');
const CourseRegistration = require('../models/courseRegistrationModel');
const Course = require('../models/courseModel');
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
 
  const hasUpdateFields = mobileNumber || presentAddress || permanentAddress || studentImage;
 
  if (!hasUpdateFields) {
    return next(new ErrorHandler('Invalid: no data provided', 400));
  }
 
  const student = await Student.findById(req.params.id);
  if (!student) {
    return next(new ErrorHandler('Student not found', 404));
  }
 
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
  
  const Student = require('../models/studentModel');
  const student = await Student.findById(req.student._id).populate('section');
  const studentSection = student?.section;

  const Teacher = require('../models/teacherModel');
  const teachers = await Teacher.find({}, 'teacherId name');
  const teacherMap = new Map();
  teachers.forEach(teacher => {
    if (teacher.teacherId) {
      teacherMap.set(teacher.teacherId, teacher.name);
    }
  });

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
    
    let courseSchedule = null;
    const sectionToCheck = reg.section || studentSection;
    
    if (sectionToCheck && sectionToCheck.courseSchedules && sectionToCheck.courseSchedules instanceof Map) {
      const sectionSchedule = sectionToCheck.courseSchedules.get(courseId);
      if (sectionSchedule) {
        courseSchedule = sectionSchedule;
      }
    } else if (sectionToCheck && sectionToCheck.courseSchedules && typeof sectionToCheck.courseSchedules === 'object') {
      const sectionSchedule = sectionToCheck.courseSchedules[courseId];
      if (sectionSchedule) {
        courseSchedule = sectionSchedule;
      }
    }
    
    if (!courseSchedule) {
      courseSchedule = course.schedule || { days: [], startTime: '', endTime: '', daySchedules: [] };
    }

    let instructorName = '';
    const sectionToCheckForInstructor = reg.section || studentSection;
    const sectionName = sectionToCheckForInstructor?.sectionName;

    const hasSectionSpecificInstructors = course.instructorSections && 
      Array.isArray(course.instructorSections) && 
      course.instructorSections.length > 0;

    if (sectionName && hasSectionSpecificInstructors) {
      const sectionInstructor = course.instructorSections.find(instSec => 
        instSec.sections && instSec.sections.includes(sectionName)
      );
      
      if (sectionInstructor && sectionInstructor.instructorId) {
        instructorName = teacherMap.get(sectionInstructor.instructorId) || sectionInstructor.instructorId;
      }
    } else if (!hasSectionSpecificInstructors) {
      if (Array.isArray(course.instructors) && course.instructors.length > 0) {
        const instructorNames = course.instructors
          .map(id => teacherMap.get(id) || id)
          .filter(Boolean);
        instructorName = instructorNames.length > 0 ? instructorNames.join(', ') : '';
      } else if (course.instructor) {
        instructorName = teacherMap.get(course.instructor) || course.instructor;
      }
    }

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

exports.getStudentRoutine = catchAsyncError(async (req, res, next) => {
  const { semester } = req.query;

  const student = await Student.findById(req.student._id).select('section');
  
  if (!student || !student.section) {
    return next(new ErrorHandler('Student section not found', 404));
  }

  const Section = require('../models/sectionModel');
  const studentSection = await Section.findOne({ 
    sectionName: student.section,
    status: 'active'
  });

  if (!studentSection) {
    return next(new ErrorHandler('Student section not found', 404));
  }

  const sectionSemester = semester || studentSection.semester;

  if (!sectionSemester) {
    return next(new ErrorHandler('Semester information not available', 400));
  }

  const allCourses = await Course.find({ 
    status: 'active',
    semester: sectionSemester 
  });

  const Teacher = require('../models/teacherModel');
  const teachers = await Teacher.find({}, 'teacherId name');
  const teacherMap = new Map();
  teachers.forEach(teacher => {
    if (teacher.teacherId) {
      teacherMap.set(teacher.teacherId, teacher.name);
    }
  });

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
  const sectionName = studentSection.sectionName;

  allCourses.forEach((course) => {
    const courseId = course._id.toString();
    
    let courseSchedule = null;
    
    if (studentSection.courseSchedules && studentSection.courseSchedules instanceof Map) {
      const sectionSchedule = studentSection.courseSchedules.get(courseId);
      if (sectionSchedule) {
        courseSchedule = sectionSchedule;
      }
    } else if (studentSection.courseSchedules && typeof studentSection.courseSchedules === 'object') {
      const sectionSchedule = studentSection.courseSchedules[courseId];
      if (sectionSchedule) {
        courseSchedule = sectionSchedule;
      }
    }
    
    if (!courseSchedule) {
      courseSchedule = course.schedule || { days: [], startTime: '', endTime: '', daySchedules: [] };
    }

    let instructorName = '';

    const hasSectionSpecificInstructors = course.instructorSections && 
      Array.isArray(course.instructorSections) && 
      course.instructorSections.length > 0;

    if (sectionName && hasSectionSpecificInstructors) {
      const sectionInstructor = course.instructorSections.find(instSec => 
        instSec.sections && instSec.sections.includes(sectionName)
      );
      
      if (sectionInstructor && sectionInstructor.instructorId) {
        instructorName = teacherMap.get(sectionInstructor.instructorId) || sectionInstructor.instructorId;
      }
    } else if (!hasSectionSpecificInstructors) {
      if (Array.isArray(course.instructors) && course.instructors.length > 0) {
        const instructorNames = course.instructors
          .map(id => teacherMap.get(id) || id)
          .filter(Boolean);
        instructorName = instructorNames.length > 0 ? instructorNames.join(', ') : '';
      } else if (course.instructor) {
        instructorName = teacherMap.get(course.instructor) || course.instructor;
      }
    }

    const courseInfo = {
      id: course._id,
      courseCode: course.courseCode,
      courseName: course.courseName,
      credits: course.credits,
      instructor: instructorName || '',
      prerequisite: course.prerequisite || '',
      schedule: courseSchedule,
      semester: sectionSemester,
    };

    courses.push(courseInfo);

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
        });
      });
    } else {
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
        });
      });
    }
  });

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
    message: 'Routine fetched successfully',
    data: {
      semester: sectionSemester,
      courses,
      weeklySchedule,
      summary,
    },
  });
});

exports.getSystemSettings = catchAsyncError(async (req, res, next) => {
  const SystemSettings = require('../models/systemSettingsModel');
  const settings = await SystemSettings.getSettings();

  res.status(200).json({
    success: true,
    message: 'System settings fetched successfully',
    data: {
      registrationPeriod: settings.registrationPeriod,
      currentSemester: settings.currentSemester,
      universityName: settings.universityName,
    },
  });
});
