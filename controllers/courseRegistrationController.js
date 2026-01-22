const mongoose = require('mongoose');
const Course = require('../models/courseModel');
const CourseRegistration = require('../models/courseRegistrationModel');
const Student = require('../models/studentModel');
const Teacher = require('../models/teacherModel');
const Section = require('../models/sectionModel');
const ExtraCreditRequest = require('../models/extraCreditRequestModel');
const SystemSettings = require('../models/systemSettingsModel');
const ErrorHandler = require('../utils/ErrorHandler');
const catchAsyncError = require('../middleware/CatchAsyncErrors');
 
const checkTimeConflict = (schedule1, schedule2) => {
  if (!schedule1 || !schedule2) {
    return false;
  }
 
  const parseTime = (timeStr) => {
    if (!timeStr) return Infinity;
    const [time, period] = timeStr.split(' ');
    const [hours, minutes] = time.split(':');
    let hour24 = parseInt(hours);
    if (period === 'PM' && hour24 !== 12) hour24 += 12;
    if (period === 'AM' && hour24 === 12) hour24 = 0;
    return hour24 * 60 + parseInt(minutes || 0);
  };
 
  if (schedule1.daySchedules && Array.isArray(schedule1.daySchedules) && schedule1.daySchedules.length > 0 &&
      schedule2.daySchedules && Array.isArray(schedule2.daySchedules) && schedule2.daySchedules.length > 0) {
 
    for (const ds1 of schedule1.daySchedules) {
      for (const ds2 of schedule2.daySchedules) {
        if (ds1.day === ds2.day) {
          const start1 = parseTime(ds1.startTime);
          const end1 = parseTime(ds1.endTime);
          const start2 = parseTime(ds2.startTime);
          const end2 = parseTime(ds2.endTime);
 
          if (!(end1 <= start2 || end2 <= start1)) {
            return true; // Conflict found
          }
        }
      }
    }
    return false; // No conflicts found
  }
 
  if (!schedule1.days || !schedule2.days) {
    return false;
  }
 
  const commonDays = schedule1.days.filter(day => schedule2.days.includes(day));
  if (commonDays.length === 0) {
    return false;
  }
 
  const start1 = parseTime(schedule1.startTime);
  const end1 = parseTime(schedule1.endTime);
  const start2 = parseTime(schedule2.startTime);
  const end2 = parseTime(schedule2.endTime);
 
  return !(end1 <= start2 || end2 <= start1);
};

const checkRegistrationPeriod = async () => {
  const settings = await SystemSettings.getSettings();
  
  if (!settings.registrationPeriod.enabled) {
    return { allowed: true };
  }
  
  if (!settings.registrationPeriod.startDate || !settings.registrationPeriod.endDate) {
    return { allowed: true };
  }
  
  const now = new Date();
  const startDate = new Date(settings.registrationPeriod.startDate);
  const endDate = new Date(settings.registrationPeriod.endDate);
  
  if (now < startDate) {
    return {
      allowed: false,
      message: `Registration period has not started yet. Registration will begin on ${startDate.toLocaleDateString()}.`
    };
  }
  
  if (now > endDate) {
    return {
      allowed: false,
      message: `Registration period has ended. Registration was available until ${endDate.toLocaleDateString()}.`
    };
  }
  
  return { allowed: true };
};
 
exports.getAvailableCourses = catchAsyncError(async (req, res, next) => {
  const { search, department, semester } = req.query;
  const query = { status: 'active' };
 
  if (semester) {
    query.semester = semester;
  }
 
  if (department && department !== 'All Departments') {
    query.department = department;
  }
 
  let courses = await Course.find(query);
 
  if (search) {
    const searchLower = search.toLowerCase();
    courses = courses.filter(course => 
      course.courseCode.toLowerCase().includes(searchLower) ||
      course.courseName.toLowerCase().includes(searchLower) ||
      (course.instructor && course.instructor.toLowerCase().includes(searchLower))
    );
  }
 
  let selectedCourseIds = [];
  let registeredCourseIds = []; // approved, pending, rejected courses
  let registeredCourseStatuses = {}; // Map of courseId -> status
  let selectedSections = {}; // Map of courseId -> sectionId
  let approvedCourseCodes = []; // Course codes that are approved (passed) by advisor
 
  if (req.student) {
    const allRegistrations = await CourseRegistration.find({
      student: req.student._id,
    }).populate('course').populate('section');
 
    allRegistrations.forEach(reg => {
      const courseId = reg.course._id.toString();
      const status = reg.status;
 
      if (status === 'selected' || status === 'pending') {
        selectedCourseIds.push(courseId);
        if (reg.section) {
          selectedSections[courseId] = reg.section._id.toString();
        }
      }
 
      if (['approved', 'pending', 'rejected', 'selected'].includes(status)) {
        registeredCourseIds.push(courseId);
        registeredCourseStatuses[courseId] = status;
        if ((status === 'approved' || status === 'pending') && reg.section) {
          selectedSections[courseId] = reg.section._id.toString();
        }
      }
 
      if (status === 'approved' && reg.course && reg.course.courseCode) {
        approvedCourseCodes.push(reg.course.courseCode);
      }
    });
  }
 
  let studentSemester = null;
  let studentSectionName = null;
  if (req.student) {
    const student = await Student.findById(req.student._id).select('section');
    if (student && student.section) {
      studentSectionName = student.section;
      const studentSection = await Section.findOne({ 
        sectionName: student.section,
        status: 'active'
      });
      if (studentSection) {
        studentSemester = studentSection.semester;
      }
    }
  }
 
  const teachers = await Teacher.find({}, 'teacherId name');
  const teacherMap = new Map(teachers.map(t => [t.teacherId, t.name]));
 
  const allCourseRegistrations = await CourseRegistration.find({
    status: { $in: ['selected', 'pending', 'approved'] }
  }).populate('student').populate('course').populate('section');
 
  const irregularCountMap = new Map();
 
  const allSections = await Section.find({ status: 'active' });
  const sectionSemesterMap = new Map();
  allSections.forEach(section => {
    sectionSemesterMap.set(section.sectionName, section.semester);
  });
 
  for (const reg of allCourseRegistrations) {
    if (!reg.course || !reg.student || !reg.section) continue;
 
    const courseSemester = reg.course.semester;
    const studentSectionSemester = sectionSemesterMap.get(reg.student.section);
 
    if (studentSectionSemester && studentSectionSemester !== courseSemester) {
      const courseId = reg.course._id.toString();
      const sectionId = reg.section._id.toString();
 
      if (!irregularCountMap.has(courseId)) {
        irregularCountMap.set(courseId, new Map());
      }
      const sectionMap = irregularCountMap.get(courseId);
      const currentCount = sectionMap.get(sectionId) || 0;
      sectionMap.set(sectionId, currentCount + 1);
    }
  }
 
  const courseDataPromises = courses.map(async (course) => {
    const enrolledCount = course.enrolledStudents ? course.enrolledStudents.length : 0;
    const totalSeats = course.regularSeats + course.irregularSeats;
    const availableSeats = Math.max(0, totalSeats - enrolledCount);
    const courseIdStr = course._id.toString();
    const isSelected = selectedCourseIds.includes(courseIdStr);
    const isRegistered = registeredCourseIds.includes(courseIdStr);
    const registrationStatus = registeredCourseStatuses[courseIdStr] || null;
 
    const instructorNames = (course.instructors || [])
      .map(id => teacherMap.get(id) || id)
      .filter(Boolean);
 
    const sections = await Section.find({
      semester: course.semester,
      status: 'active'
    }).sort({ sectionName: 1 });
 
    const courseIrregularMap = irregularCountMap.get(courseIdStr) || new Map();
 
    const regularCountMap = new Map();
    const registrationsForCourse = await CourseRegistration.find({
      course: course._id,
      status: { $in: ['selected', 'pending', 'approved'] }
    }).populate('student section');
 
    registrationsForCourse.forEach(reg => {
      if (reg.section && reg.student && reg.student.section) {
        const sectionId = reg.section._id.toString();
        const studentSectionName = reg.student.section;
        const studentSectionSemester = sectionSemesterMap.get(studentSectionName);
 
        if (studentSectionSemester === course.semester) {
          const currentCount = regularCountMap.get(sectionId) || 0;
          regularCountMap.set(sectionId, currentCount + 1);
        }
      }
    });
 
    const isRegular = studentSemester === course.semester;
    let filteredSections = sections;
    if (isRegular && studentSectionName) {
      filteredSections = sections.filter(section => 
        section.sectionName.toUpperCase() === studentSectionName.toUpperCase()
      );
    }
 
    const sectionsWithSeats = filteredSections.map(section => {
      const sectionId = section._id.toString();
      const courseIdStr = course._id.toString();
 
      const enrolledRegular = regularCountMap.get(sectionId) || 0;
      const enrolledIrregular = courseIrregularMap.get(sectionId) || 0;
 
      const maxRegular = section.regularStudents > 0 ? section.regularStudents : (section.totalCapacity || 0);
      const maxIrregular = section.maxIrregularStudents || 0;
 
      const availableRegular = Math.max(0, maxRegular - enrolledRegular);
      const availableIrregular = Math.max(0, maxIrregular - enrolledIrregular);
 
      let sectionSchedule = null;
      if (section.courseSchedules && section.courseSchedules instanceof Map) {
        sectionSchedule = section.courseSchedules.get(courseIdStr);
      } else if (section.courseSchedules && typeof section.courseSchedules === 'object') {
        sectionSchedule = section.courseSchedules[courseIdStr];
      }
 
      const schedule = sectionSchedule || course.schedule || { days: [], startTime: '', endTime: '', daySchedules: [] };
 
      return {
        id: section._id.toString(),
        sectionName: section.sectionName,
        regularSeats: {
          enrolled: enrolledRegular,
          available: availableRegular,
          max: maxRegular,
        },
        irregularSeats: {
          enrolled: enrolledIrregular,
          available: availableIrregular,
          max: maxIrregular,
        },
        availableSeats: isRegular ? availableRegular : availableIrregular,
        maxIrregularSeats: maxIrregular,
        enrolledStudents: section.enrolledStudents || 0,
        schedule: schedule,
      };
    });
 
    let prerequisiteClear = true;
    let missingPrerequisites = [];
 
    if (course.prerequisite && req.student) {
      const prerequisiteCodes = course.prerequisite.split(',').map(code => code.trim()).filter(Boolean);
 
      if (prerequisiteCodes.length > 0) {
        const unmetPrerequisites = prerequisiteCodes.filter(code => !approvedCourseCodes.includes(code));
 
        if (unmetPrerequisites.length > 0) {
          prerequisiteClear = false;
          missingPrerequisites = unmetPrerequisites;
        }
      }
    }
 
    return {
      id: course._id,
      courseCode: course.courseCode,
      courseName: course.courseName,
      credits: course.credits,
      department: course.department,
      instructor: course.instructor || '',
      instructors: course.instructors || [],
      instructorNames: instructorNames.length > 0 ? instructorNames : (course.instructor ? [course.instructor] : []),
      instructorSections: course.instructorSections || [], // Include instructor-section mapping
      schedule: course.schedule || { days: [], startTime: '', endTime: '' },
      prerequisite: course.prerequisite || '',
      prerequisiteClear: prerequisiteClear, // New field: indicates if prerequisites are clear
      missingPrerequisites: missingPrerequisites, // New field: list of missing prerequisite course codes
      seats: {
        total: totalSeats,
        available: availableSeats,
        enrolled: enrolledCount,
      },
      sections: sectionsWithSeats, // New field: sections with seat information
      selectedSectionId: selectedSections[courseIdStr] || null, // Section ID if already selected
      semester: course.semester,
      isSelected,
      isRegistered,
      registrationStatus,
      isRegular: studentSemester === course.semester, // Helper field to know if student is regular
    };
  });
 
  const courseData = await Promise.all(courseDataPromises);
 
  res.status(200).json({
    success: true,
    message: 'Courses fetched successfully',
    data: courseData,
  });
});
 
exports.addCourseToSelection = catchAsyncError(async (req, res, next) => {
  const { courseId, sectionId } = req.body;

  if (!req.student || !req.student._id) {
    return next(new ErrorHandler('Student authentication required', 401));
  }

  const studentId = req.student._id;

  const registrationCheck = await checkRegistrationPeriod();
  if (!registrationCheck.allowed) {
    return next(new ErrorHandler(registrationCheck.message, 403));
  }
 
  const approvedExtraCreditEver = await ExtraCreditRequest.findOne({
    student: studentId,
    status: 'approved',
  }).select('_id');
  if (approvedExtraCreditEver) {
    return next(
      new ErrorHandler(
        'Course selection is locked because extra credit has already been approved for you.',
        400
      )
    );
  }
 
  if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
    return next(new ErrorHandler('Invalid student ID', 400));
  }
 
  if (!courseId) {
    return next(new ErrorHandler('Course ID is required', 400));
  }
 
  const course = await Course.findById(courseId);
  if (!course) {
    return next(new ErrorHandler('Course not found', 404));
  }
 
  if (course.status !== 'active') {
    return next(new ErrorHandler('Course is not available', 400));
  }
 
  const student = await Student.findById(studentId).select('section');
  if (!student) {
    return next(new ErrorHandler('Student not found', 404));
  }
  let studentSemester = null;
  if (student && student.section) {
    const studentSection = await Section.findOne({ 
      sectionName: student.section,
      status: 'active'
    });
    if (studentSection) {
      studentSemester = studentSection.semester;
    }
  }
 
  const sectionsForCourse = await Section.find({
    semester: course.semester,
    status: 'active'
  });
 
  if (sectionsForCourse.length > 0 && !sectionId) {
    return next(new ErrorHandler('Section selection is required for this course', 400));
  }
 
  let selectedSection = null;
  if (sectionId) {
    selectedSection = await Section.findById(sectionId);
    if (!selectedSection) {
      return next(new ErrorHandler('Section not found', 404));
    }
    if (selectedSection.semester !== course.semester) {
      return next(new ErrorHandler('Section does not belong to the course semester', 400));
    }
    if (selectedSection.status !== 'active') {
      return next(new ErrorHandler('Section is not active', 400));
    }
 
    const isRegular = studentSemester === course.semester;
 
    if (isRegular && student && student.section) {
      if (selectedSection.sectionName.toUpperCase() !== student.section.toUpperCase()) {
        return next(new ErrorHandler('Regular students can only register in their registered section', 400));
      }
    }
 
    const registrations = await CourseRegistration.find({
      course: courseId,
      section: sectionId,
      status: { $in: ['selected', 'pending', 'approved'] }
    }).populate('student');
 
    let enrolledRegular = 0;
    let enrolledIrregular = 0;
 
    for (const reg of registrations) {
      if (reg.student && reg.student.section) {
        const regStudentSection = await Section.findOne({ 
          sectionName: reg.student.section,
          status: 'active'
        });
        if (regStudentSection) {
          if (regStudentSection.semester === course.semester) {
            enrolledRegular++;
          } else {
            enrolledIrregular++;
          }
        }
      }
    }
 
    if (isRegular) {
      const maxRegular = selectedSection.regularStudents || 0;
      if (enrolledRegular >= maxRegular) {
        return next(new ErrorHandler('No regular seats available in this section', 400));
      }
    } else {
      const maxIrregular = selectedSection.maxIrregularStudents || 0;
      if (enrolledIrregular >= maxIrregular) {
        return next(new ErrorHandler('No irregular seats available in this section', 400));
      }
    }
  }
 
  const existingRegistration = await CourseRegistration.findOne({
    student: studentId,
    course: courseId,
    semester: course.semester,
  });
 
  if (existingRegistration) {
    const status = existingRegistration.status;
    if (status === 'selected') {
      return next(new ErrorHandler('Course already selected', 400));
    }
    if (status === 'pending') {
      return next(new ErrorHandler('Course is already pending approval', 400));
    }
    if (status === 'approved') {
      return next(new ErrorHandler('Course is already approved', 400));
    }
    if (status === 'rejected') {
      return next(new ErrorHandler('Course was previously rejected', 400));
    }
  }
 
 
  const CREDIT_LIMIT = 26;
 
  /**
   * IMPORTANT:
   * CourseRegistration.semester represents the COURSE's semester, not the student's current registration term.
   * For an irregular student taking courses outside their own semester, enforcing credit limit by course.semester
   * fails (regular + irregular credits get split across different "semester" buckets).
   *
   * So we enforce the credit limit across the student's *current selected/pending/approved basket*,
   * regardless of the course semester.
   */
  const currentRegistrations = await CourseRegistration.find({
    student: studentId,
    status: { $in: ['selected', 'pending', 'approved'] },
  }).populate('course');
 
  const currentCredits = currentRegistrations.reduce((sum, reg) => {
    if (reg.course && reg.course._id.toString() === courseId.toString() && reg.status === 'selected') {
      return sum;
    }
    return sum + (reg.course?.credits || 0);
  }, 0);
 
  const newTotalCredits = currentCredits + (course.credits || 0);
 
  let creditWarning = null;
  let extraCreditsNeeded = 0;
  if (newTotalCredits > CREDIT_LIMIT) {
    extraCreditsNeeded = newTotalCredits - CREDIT_LIMIT;
 
    const extraCreditSemester = studentSemester || course.semester;
 
    const approvedExtraCreditRequest = await ExtraCreditRequest.findOne({
      student: studentId,
      semester: extraCreditSemester,
      status: 'approved',
    });
 
    if (!approvedExtraCreditRequest) {
      creditWarning = `Warning: Credit limit exceeded. You have ${currentCredits} credits selected. Adding this course (${course.credits} credits) would result in ${newTotalCredits} credits, which exceeds the limit of ${CREDIT_LIMIT}. You need to request ${extraCreditsNeeded} extra credit(s) from your advisor before submitting for approval.`;
    } else if (extraCreditsNeeded > approvedExtraCreditRequest.requestedCredits) {
      creditWarning = `Warning: Your approved extra credit request allows ${approvedExtraCreditRequest.requestedCredits} extra credits, but you need ${extraCreditsNeeded} extra credits. Please request additional extra credits from your advisor before submitting for approval.`;
    }
  }
 
  if (course.prerequisite) {
    const prerequisiteCodes = course.prerequisite.split(',').map(code => code.trim()).filter(Boolean);
 
    if (prerequisiteCodes.length > 0) {
      const approvedRegistrations = await CourseRegistration.find({
        student: studentId,
        status: 'approved',
      }).populate('course');
 
      const approvedCourseCodes = approvedRegistrations
        .map(reg => reg.course?.courseCode)
        .filter(Boolean);
 
      const unmetPrerequisites = prerequisiteCodes.filter(code => !approvedCourseCodes.includes(code));
 
      if (unmetPrerequisites.length > 0) {
        return next(new ErrorHandler(
          `Prerequisites not clear. Missing prerequisites: ${unmetPrerequisites.join(', ')}. Only courses approved by advisor are considered as passed.`,
          400
        ));
      }
    }
  }
 
  if (!mongoose.Types.ObjectId.isValid(studentId) || studentId.toString() !== req.student._id.toString()) {
    return next(new ErrorHandler('Invalid student ID for registration', 400));
  }
 
  if (existingRegistration) {
    if (existingRegistration.student.toString() !== studentId.toString()) {
      return next(new ErrorHandler('Registration does not belong to this student', 403));
    }
    existingRegistration.status = 'selected';
    existingRegistration.submittedForApproval = false;
    if (selectedSection) {
      existingRegistration.section = selectedSection._id;
    }
    await existingRegistration.save();
  } else {
    await CourseRegistration.create({
      student: req.student._id, // Use req.student._id directly to ensure correctness
      course: courseId,
      semester: course.semester,
      status: 'selected',
      section: selectedSection ? selectedSection._id : undefined,
    });
  }
 
  res.status(200).json({
    success: true,
    message: creditWarning || 'Course added to selection successfully',
    warning: creditWarning || null,
    extraCreditsNeeded: creditWarning ? extraCreditsNeeded : 0,
    creditLimit: CREDIT_LIMIT,
    totalCreditsAfterAdd: newTotalCredits,
  });
});
 
exports.removeCourseFromSelection = catchAsyncError(async (req, res, next) => {
  const { courseId } = req.params;
  const studentId = req.student._id;
 
  if (!courseId) {
    return next(new ErrorHandler('Course ID is required', 400));
  }
 
  const registration = await CourseRegistration.findOne({
    student: studentId,
    course: courseId,
    status: 'selected',
  });
 
  if (!registration) {
    return next(new ErrorHandler('Course not found in selection', 404));
  }
 
  if (registration.submittedForApproval) {
    return next(new ErrorHandler('Cannot remove course that has been submitted for approval', 400));
  }
 
  await registration.deleteOne();
 
  res.status(200).json({
    success: true,
    message: 'Course removed from selection successfully',
  });
});
 
exports.getSelectedCourses = catchAsyncError(async (req, res, next) => {
  const studentId = req.student._id;

  const registrations = await CourseRegistration.find({
    student: studentId,
    status: { $in: ['selected', 'pending'] },
  }).populate('course');

  const courses = registrations.map(reg => reg.course);

  const coursesWithConflicts = courses.map((course, index) => {
    let hasConflict = false;
    const conflictingCourses = [];

    for (let i = 0; i < courses.length; i++) {
      if (i !== index && course.schedule && courses[i].schedule) {
        if (checkTimeConflict(course.schedule, courses[i].schedule)) {
          hasConflict = true;
          conflictingCourses.push({
            id: courses[i]._id,
            courseCode: courses[i].courseCode,
            courseName: courses[i].courseName,
          });
        }
      }
    }

    const enrolledCount = course.enrolledStudents ? course.enrolledStudents.length : 0;
    const totalSeats = course.regularSeats + course.irregularSeats;
    const availableSeats = Math.max(0, totalSeats - enrolledCount);

    return {
      id: course._id,
      courseCode: course.courseCode,
      courseName: course.courseName,
      credits: course.credits,
      department: course.department,
      instructor: course.instructor || '',
      schedule: course.schedule || { days: [], startTime: '', endTime: '' },
      prerequisite: course.prerequisite || '',
      seats: {
        total: totalSeats,
        available: availableSeats,
        enrolled: enrolledCount,
      },
      semester: course.semester,
      hasConflict,
      conflictingCourses,
      registrationStatus: registrations[index].status,
    };
  });

  const allRegistrationsForCredit = await CourseRegistration.find({
    student: studentId,
    status: { $in: ['selected', 'pending', 'approved'] },
  }).populate('course');
  
  const totalCredits = allRegistrationsForCredit.reduce((sum, reg) => {
    return sum + (reg.course?.credits || 0);
  }, 0);

  res.status(200).json({
    success: true,
    message: 'Selected courses fetched successfully',
    data: {
      courses: coursesWithConflicts,
      summary: {
        selectedCount: courses.length,
        totalCredits, // This now includes approved courses as well
        hasConflicts: coursesWithConflicts.some(c => c.hasConflict),
      },
    },
  });
});
 
exports.submitForApproval = catchAsyncError(async (req, res, next) => {
  const studentId = req.student._id;

  const registrationCheck = await checkRegistrationPeriod();
  if (!registrationCheck.allowed) {
    return next(new ErrorHandler(registrationCheck.message, 403));
  }

  const registrations = await CourseRegistration.find({
    student: studentId,
    status: 'selected',
  }).populate('course');
 
  if (registrations.length === 0) {
    return next(new ErrorHandler('No courses selected', 400));
  }
 
  const courses = registrations.map(reg => reg.course);
  for (let i = 0; i < courses.length; i++) {
    for (let j = i + 1; j < courses.length; j++) {
      if (courses[i].schedule && courses[j].schedule) {
        if (checkTimeConflict(courses[i].schedule, courses[j].schedule)) {
          return next(new ErrorHandler(
            `Time conflict detected between ${courses[i].courseCode} and ${courses[j].courseCode}. Please resolve conflicts before submitting.`,
            400
          ));
        }
      }
    }
  }
 
  const CREDIT_LIMIT = 26;
  
  const allRegistrationsForCreditCheck = await CourseRegistration.find({
    student: studentId,
    status: { $in: ['selected', 'pending', 'approved'] },
  }).populate('course');
  
  const totalCredits = allRegistrationsForCreditCheck.reduce((sum, reg) => {
    return sum + (reg.course?.credits || 0);
  }, 0);

  if (totalCredits > CREDIT_LIMIT) {
    const student = await Student.findById(studentId).select('section');
    let studentSemester = null;
    if (student && student.section) {
      const studentSection = await Section.findOne({
        sectionName: student.section,
        status: 'active',
      });
      if (studentSection) {
        studentSemester = studentSection.semester;
      }
    }

    const extraCreditSemester = studentSemester || (courses.length > 0 ? courses[0].semester : null);

    const ExtraCreditRequest = require('../models/extraCreditRequestModel');
    const approvedExtraCreditRequest = await ExtraCreditRequest.findOne({
      student: studentId,
      semester: extraCreditSemester,
      status: 'approved',
    });

    if (!approvedExtraCreditRequest) {
      const extraCreditsNeeded = totalCredits - CREDIT_LIMIT;
      return next(new ErrorHandler(
        `Cannot submit for approval: Credit limit exceeded. You have ${totalCredits} total credits (including submitted, approved, and selected courses), which exceeds the limit of ${CREDIT_LIMIT} credits per semester. You need to request ${extraCreditsNeeded} extra credit(s) from your advisor before submitting.`,
        400
      ));
    }

    const extraCreditsNeeded = totalCredits - CREDIT_LIMIT;
    if (extraCreditsNeeded > approvedExtraCreditRequest.requestedCredits) {
      return next(new ErrorHandler(
        `Cannot submit for approval: Your approved extra credit request allows ${approvedExtraCreditRequest.requestedCredits} extra credits, but you need ${extraCreditsNeeded} extra credits. Please request additional extra credits from your advisor before submitting.`,
        400
      ));
    }
  }
 
  const now = new Date();
  await CourseRegistration.updateMany(
    {
      student: studentId,
      status: 'selected',
    },
    {
      status: 'pending',
      submittedForApproval: true,
      submittedAt: now,
    }
  );
 
  res.status(200).json({
    success: true,
    message: 'Courses submitted for approval successfully',
  });
});
 
exports.getRegistrationStatus = catchAsyncError(async (req, res, next) => {
  const studentId = req.student._id;
  const { semester } = req.query;
 
  const query = { student: studentId };
  if (semester) {
    query.semester = semester;
  }
 
  const registrations = await CourseRegistration.find(query)
    .populate('course')
    .populate('section')
    .sort({ createdAt: -1 });
 
  const Student = require('../models/studentModel');
  const student = await Student.findById(studentId).populate('section');
  const studentSection = student?.section;
 
  const Teacher = require('../models/teacherModel');
  const teachers = await Teacher.find({}, 'teacherId name');
  const teacherMap = new Map();
  teachers.forEach(teacher => {
    if (teacher.teacherId) {
      teacherMap.set(teacher.teacherId, teacher.name);
    }
  });
 
  const statusData = registrations.map(reg => {
    const enrolledCount = reg.course.enrolledStudents ? reg.course.enrolledStudents.length : 0;
    const totalSeats = reg.course.regularSeats + reg.course.irregularSeats;
    const availableSeats = Math.max(0, totalSeats - enrolledCount);
 
    let instructorName = '';
    const sectionToCheckForInstructor = reg.section || studentSection;
    const sectionName = sectionToCheckForInstructor?.sectionName;
 
    const hasSectionSpecificInstructors = reg.course.instructorSections && 
      Array.isArray(reg.course.instructorSections) && 
      reg.course.instructorSections.length > 0;
 
    if (sectionName && hasSectionSpecificInstructors) {
      const sectionInstructor = reg.course.instructorSections.find(instSec => 
        instSec.sections && instSec.sections.includes(sectionName)
      );
 
      if (sectionInstructor && sectionInstructor.instructorId) {
        instructorName = teacherMap.get(sectionInstructor.instructorId) || sectionInstructor.instructorId;
      }
    } else if (!hasSectionSpecificInstructors) {
      if (Array.isArray(reg.course.instructors) && reg.course.instructors.length > 0) {
        const instructorNames = reg.course.instructors
          .map(id => teacherMap.get(id) || id)
          .filter(Boolean);
        instructorName = instructorNames.length > 0 ? instructorNames.join(', ') : '';
      } else if (reg.course.instructor) {
        instructorName = teacherMap.get(reg.course.instructor) || reg.course.instructor;
      }
    }
 
    return {
      id: reg._id,
      course: {
        id: reg.course._id,
        courseCode: reg.course.courseCode,
        courseName: reg.course.courseName,
        credits: reg.course.credits,
        department: reg.course.department,
        instructor: instructorName || '',
        schedule: reg.course.schedule || { days: [], startTime: '', endTime: '' },
        seats: {
          total: totalSeats,
          available: availableSeats,
          enrolled: enrolledCount,
        },
      },
      status: reg.status,
      semester: reg.semester,
      submittedForApproval: reg.submittedForApproval,
      submittedAt: reg.submittedAt,
      approvedAt: reg.approvedAt,
      rejectedAt: reg.rejectedAt,
      rejectionReason: reg.rejectionReason,
      createdAt: reg.createdAt,
    };
  });
 
  const summary = {
    total: registrations.length,
    selected: registrations.filter(r => r.status === 'selected').length,
    pending: registrations.filter(r => r.status === 'pending').length,
    approved: registrations.filter(r => r.status === 'approved').length,
    rejected: registrations.filter(r => r.status === 'rejected').length,
    totalCredits: registrations
      .filter(r => r.status === 'approved')
      .reduce((sum, r) => sum + (r.course.credits || 0), 0),
  };
 
  res.status(200).json({
    success: true,
    message: 'Registration status fetched successfully',
    data: {
      registrations: statusData,
      summary,
    },
  });
});
