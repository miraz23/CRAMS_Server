const Course = require('../models/courseModel');
const CourseRegistration = require('../models/courseRegistrationModel');
const Student = require('../models/studentModel');
const Teacher = require('../models/teacherModel');
const Section = require('../models/sectionModel');
const ErrorHandler = require('../utils/ErrorHandler');
const catchAsyncError = require('../middleware/CatchAsyncErrors');

// Helper function to check time conflicts
const checkTimeConflict = (schedule1, schedule2) => {
  if (!schedule1 || !schedule2 || !schedule1.days || !schedule2.days) {
    return false;
  }

  // Check if there are common days
  const commonDays = schedule1.days.filter(day => schedule2.days.includes(day));
  if (commonDays.length === 0) {
    return false;
  }

  // Parse time strings (format: "10:00 AM" or "2:00 PM")
  const parseTime = (timeStr) => {
    const [time, period] = timeStr.split(' ');
    const [hours, minutes] = time.split(':');
    let hour24 = parseInt(hours);
    if (period === 'PM' && hour24 !== 12) hour24 += 12;
    if (period === 'AM' && hour24 === 12) hour24 = 0;
    return hour24 * 60 + parseInt(minutes || 0);
  };

  const start1 = parseTime(schedule1.startTime);
  const end1 = parseTime(schedule1.endTime);
  const start2 = parseTime(schedule2.startTime);
  const end2 = parseTime(schedule2.endTime);

  // Check if time ranges overlap
  return !(end1 <= start2 || end2 <= start1);
};

// Get all available courses with search and filter
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

  // Apply search filter
  if (search) {
    const searchLower = search.toLowerCase();
    courses = courses.filter(course => 
      course.courseCode.toLowerCase().includes(searchLower) ||
      course.courseName.toLowerCase().includes(searchLower) ||
      (course.instructor && course.instructor.toLowerCase().includes(searchLower))
    );
  }

  // Get student's course registrations to mark them appropriately
  let selectedCourseIds = [];
  let registeredCourseIds = []; // approved, pending, rejected courses
  let registeredCourseStatuses = {}; // Map of courseId -> status
  let selectedSections = {}; // Map of courseId -> sectionId
  
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
      
      // Track all registered courses (approved, pending, rejected)
      if (['approved', 'pending', 'rejected', 'selected'].includes(status)) {
        registeredCourseIds.push(courseId);
        registeredCourseStatuses[courseId] = status;
      }
    });
  }

  // Get student's section and semester if logged in
  let studentSemester = null;
  if (req.student) {
    const student = await Student.findById(req.student._id).select('section');
    if (student && student.section) {
      const studentSection = await Section.findOne({ 
        sectionName: student.section,
        status: 'active'
      });
      if (studentSection) {
        studentSemester = studentSection.semester;
      }
    }
  }

  // Fetch all teachers to map IDs to names
  const teachers = await Teacher.find({}, 'teacherId name');
  const teacherMap = new Map(teachers.map(t => [t.teacherId, t.name]));

  // Get all course registrations to count irregular students per section
  const allCourseRegistrations = await CourseRegistration.find({
    status: { $in: ['selected', 'pending', 'approved'] }
  }).populate('student').populate('course').populate('section');

  // Build a map to count irregular students per course-section combination
  // courseId -> sectionId -> count
  const irregularCountMap = new Map();

  // Get all sections to build a semester map
  const allSections = await Section.find({ status: 'active' });
  const sectionSemesterMap = new Map();
  allSections.forEach(section => {
    sectionSemesterMap.set(section.sectionName, section.semester);
  });

  // Count irregular students per course-section
  for (const reg of allCourseRegistrations) {
    if (!reg.course || !reg.student || !reg.section) continue;
    
    const courseSemester = reg.course.semester;
    const studentSectionSemester = sectionSemesterMap.get(reg.student.section);
    
    if (studentSectionSemester && studentSectionSemester !== courseSemester) {
      // This is an irregular student for this course
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

  // Process courses with section information
  const courseDataPromises = courses.map(async (course) => {
    const enrolledCount = course.enrolledStudents ? course.enrolledStudents.length : 0;
    const totalSeats = course.regularSeats + course.irregularSeats;
    const availableSeats = Math.max(0, totalSeats - enrolledCount);
    const courseIdStr = course._id.toString();
    const isSelected = selectedCourseIds.includes(courseIdStr);
    const isRegistered = registeredCourseIds.includes(courseIdStr);
    const registrationStatus = registeredCourseStatuses[courseIdStr] || null;

    // Map instructor IDs to names
    const instructorNames = (course.instructors || [])
      .map(id => teacherMap.get(id) || id)
      .filter(Boolean);

    // Get all sections for this course's semester
    const sections = await Section.find({
      semester: course.semester,
      status: 'active'
    }).sort({ sectionName: 1 });

    // Get irregular count for this course
    const courseIrregularMap = irregularCountMap.get(courseIdStr) || new Map();

    // Build sections array with seat information
    const sectionsWithSeats = sections.map(section => {
      const isRegular = studentSemester === course.semester;
      const sectionId = section._id.toString();
      
      let availableSeatsForSection;
      if (isRegular) {
        // Regular students see: number of students in that section
        availableSeatsForSection = section.enrolledStudents || 0;
      } else {
        // Irregular students see: maximum irregular seats allowed minus already registered
        const maxIrregular = section.maxIrregularStudents || 0;
        const registeredIrregular = courseIrregularMap.get(sectionId) || 0;
        availableSeatsForSection = Math.max(0, maxIrregular - registeredIrregular);
      }

      return {
        id: section._id.toString(),
        sectionName: section.sectionName,
        availableSeats: availableSeatsForSection,
        maxIrregularSeats: section.maxIrregularStudents || 0,
        enrolledStudents: section.enrolledStudents || 0,
      };
    });

    return {
      id: course._id,
      courseCode: course.courseCode,
      courseName: course.courseName,
      credits: course.credits,
      department: course.department,
      instructor: course.instructor || '',
      instructors: course.instructors || [],
      instructorNames: instructorNames.length > 0 ? instructorNames : (course.instructor ? [course.instructor] : []),
      schedule: course.schedule || { days: [], startTime: '', endTime: '' },
      prerequisite: course.prerequisite || '',
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

// Add course to selection
exports.addCourseToSelection = catchAsyncError(async (req, res, next) => {
  const { courseId, sectionId } = req.body;
  const studentId = req.student._id;

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

  // Get student's section and semester
  const student = await Student.findById(studentId).select('section');
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

  // Validate section if provided
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

    // Check if student is regular or irregular for this course
    const isRegular = studentSemester === course.semester;
    
    if (isRegular) {
      // For regular students, check if section has capacity
      // Regular students see enrolledStudents as available seats
      // But we need to check if there's actual capacity
      // For now, we'll allow if section is active
    } else {
      // For irregular students, check maxIrregularStudents
      // Count how many irregular students are already registered in this section for this course
      const irregularRegistrations = await CourseRegistration.countDocuments({
        course: courseId,
        section: sectionId,
        status: { $in: ['selected', 'pending', 'approved'] }
      }).populate('student');

      // Get actual count of irregular students in this section for this course
      let irregularCount = 0;
      const registrations = await CourseRegistration.find({
        course: courseId,
        section: sectionId,
        status: { $in: ['selected', 'pending', 'approved'] }
      }).populate('student');

      for (const reg of registrations) {
        if (reg.student && reg.student.section) {
          const regStudentSection = await Section.findOne({ 
            sectionName: reg.student.section,
            status: 'active'
          });
          if (regStudentSection && regStudentSection.semester !== course.semester) {
            irregularCount++;
          }
        }
      }

      if (irregularCount >= selectedSection.maxIrregularStudents) {
        return next(new ErrorHandler('No irregular seats available in this section', 400));
      }
    }
  }

  // Check if already registered (selected, pending, approved, or rejected)
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

  // Check seat availability (general check)
  const enrolledCount = course.enrolledStudents ? course.enrolledStudents.length : 0;
  const totalSeats = course.regularSeats + course.irregularSeats;
  if (enrolledCount >= totalSeats) {
    return next(new ErrorHandler('No seats available for this course', 400));
  }

  // Check prerequisites
  if (course.prerequisite) {
    const prerequisiteCodes = course.prerequisite.split(',').map(code => code.trim());
    const studentRegistrations = await CourseRegistration.find({
      student: studentId,
      status: { $in: ['approved', 'selected', 'pending'] },
    }).populate('course');

    const completedCourses = studentRegistrations
      .filter(reg => reg.status === 'approved')
      .map(reg => reg.course.courseCode);

    const hasPrerequisite = prerequisiteCodes.some(code => completedCourses.includes(code));
    if (!hasPrerequisite) {
      return next(new ErrorHandler(`Prerequisite not met: ${course.prerequisite}`, 400));
    }
  }

  // Create or update registration
  if (existingRegistration) {
    existingRegistration.status = 'selected';
    existingRegistration.submittedForApproval = false;
    if (selectedSection) {
      existingRegistration.section = selectedSection._id;
    }
    await existingRegistration.save();
  } else {
    await CourseRegistration.create({
      student: studentId,
      course: courseId,
      semester: course.semester,
      status: 'selected',
      section: selectedSection ? selectedSection._id : undefined,
    });
  }

  res.status(200).json({
    success: true,
    message: 'Course added to selection successfully',
  });
});

// Remove course from selection
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

// Get selected courses with conflict detection
exports.getSelectedCourses = catchAsyncError(async (req, res, next) => {
  const studentId = req.student._id;

  const registrations = await CourseRegistration.find({
    student: studentId,
    status: { $in: ['selected', 'pending'] },
  }).populate('course');

  const courses = registrations.map(reg => reg.course);
  
  // Check for conflicts
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

  // Calculate total credits
  const totalCredits = courses.reduce((sum, course) => sum + (course.credits || 0), 0);

  res.status(200).json({
    success: true,
    message: 'Selected courses fetched successfully',
    data: {
      courses: coursesWithConflicts,
      summary: {
        selectedCount: courses.length,
        totalCredits,
        hasConflicts: coursesWithConflicts.some(c => c.hasConflict),
      },
    },
  });
});

// Submit courses for approval
exports.submitForApproval = catchAsyncError(async (req, res, next) => {
  const studentId = req.student._id;

  const registrations = await CourseRegistration.find({
    student: studentId,
    status: 'selected',
  }).populate('course');

  if (registrations.length === 0) {
    return next(new ErrorHandler('No courses selected', 400));
  }

  // Check for conflicts
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

  // Update all registrations
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

// Get registration status
exports.getRegistrationStatus = catchAsyncError(async (req, res, next) => {
  const studentId = req.student._id;
  const { semester } = req.query;

  const query = { student: studentId };
  if (semester) {
    query.semester = semester;
  }

  const registrations = await CourseRegistration.find(query)
    .populate('course')
    .sort({ createdAt: -1 });

  const statusData = registrations.map(reg => {
    const enrolledCount = reg.course.enrolledStudents ? reg.course.enrolledStudents.length : 0;
    const totalSeats = reg.course.regularSeats + reg.course.irregularSeats;
    const availableSeats = Math.max(0, totalSeats - enrolledCount);

    return {
      id: reg._id,
      course: {
        id: reg.course._id,
        courseCode: reg.course.courseCode,
        courseName: reg.course.courseName,
        credits: reg.course.credits,
        department: reg.course.department,
        instructor: reg.course.instructor || '',
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

  // Calculate summary
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

