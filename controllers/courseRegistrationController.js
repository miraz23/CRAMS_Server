const Course = require('../models/courseModel');
const CourseRegistration = require('../models/courseRegistrationModel');
const Student = require('../models/studentModel');
const Teacher = require('../models/teacherModel');
const Section = require('../models/sectionModel');
const ErrorHandler = require('../utils/ErrorHandler');
const catchAsyncError = require('../middleware/CatchAsyncErrors');

// Helper function to check time conflicts
const checkTimeConflict = (schedule1, schedule2) => {
  if (!schedule1 || !schedule2) {
    return false;
  }

  // Parse time strings (format: "10:00 AM" or "2:00 PM")
  const parseTime = (timeStr) => {
    if (!timeStr) return Infinity;
    const [time, period] = timeStr.split(' ');
    const [hours, minutes] = time.split(':');
    let hour24 = parseInt(hours);
    if (period === 'PM' && hour24 !== 12) hour24 += 12;
    if (period === 'AM' && hour24 === 12) hour24 = 0;
    return hour24 * 60 + parseInt(minutes || 0);
  };

  // Handle new daySchedules structure (per-day scheduling)
  if (schedule1.daySchedules && Array.isArray(schedule1.daySchedules) && schedule1.daySchedules.length > 0 &&
      schedule2.daySchedules && Array.isArray(schedule2.daySchedules) && schedule2.daySchedules.length > 0) {
    
    // Check for conflicts on each day
    for (const ds1 of schedule1.daySchedules) {
      for (const ds2 of schedule2.daySchedules) {
        if (ds1.day === ds2.day) {
          const start1 = parseTime(ds1.startTime);
          const end1 = parseTime(ds1.endTime);
          const start2 = parseTime(ds2.startTime);
          const end2 = parseTime(ds2.endTime);
          
          // Check if time ranges overlap
          if (!(end1 <= start2 || end2 <= start1)) {
            return true; // Conflict found
          }
        }
      }
    }
    return false; // No conflicts found
  }

  // Handle legacy structure (single time for all days)
  if (!schedule1.days || !schedule2.days) {
    return false;
  }

  // Check if there are common days
  const commonDays = schedule1.days.filter(day => schedule2.days.includes(day));
  if (commonDays.length === 0) {
    return false;
  }

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
      
      // Track all registered courses (approved, pending, rejected)
      if (['approved', 'pending', 'rejected', 'selected'].includes(status)) {
        registeredCourseIds.push(courseId);
        registeredCourseStatuses[courseId] = status;
      }
      
      // Track approved courses (these are considered as passed and clear prerequisites)
      if (status === 'approved' && reg.course && reg.course.courseCode) {
        approvedCourseCodes.push(reg.course.courseCode);
      }
    });
  }

  // Get student's section and semester if logged in
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

    // Count regular students enrolled in each section for this course
    const regularCountMap = new Map();
    const registrationsForCourse = await CourseRegistration.find({
      course: course._id,
      status: { $in: ['selected', 'pending', 'approved'] }
    }).populate('student section');

    registrationsForCourse.forEach(reg => {
      if (reg.section && reg.student && reg.student.section) {
        const sectionId = reg.section._id.toString();
        // Check if student is regular (same semester as course)
        const studentSectionName = reg.student.section;
        const studentSectionSemester = sectionSemesterMap.get(studentSectionName);
        
        // If student's section semester matches course semester, they're regular
        if (studentSectionSemester === course.semester) {
          // This is a regular student in this section
          const currentCount = regularCountMap.get(sectionId) || 0;
          regularCountMap.set(sectionId, currentCount + 1);
        }
      }
    });

    // Filter sections based on student type
    // Regular students can only see their registered section
    // Irregular students can see all sections
    const isRegular = studentSemester === course.semester;
    let filteredSections = sections;
    if (isRegular && studentSectionName) {
      // Regular students can only see their own section
      filteredSections = sections.filter(section => 
        section.sectionName.toUpperCase() === studentSectionName.toUpperCase()
      );
    }
    // Irregular students see all sections (no filtering needed)

    // Build sections array with seat information
    const sectionsWithSeats = filteredSections.map(section => {
      const sectionId = section._id.toString();
      const courseIdStr = course._id.toString();
      
      // Count regular students enrolled in this section for this course
      const enrolledRegular = regularCountMap.get(sectionId) || 0;
      const enrolledIrregular = courseIrregularMap.get(sectionId) || 0;
      
      // Calculate available seats
      // Use totalCapacity as fallback if regularStudents is not set
      // For regular students: use regularStudents, fallback to totalCapacity if regularStudents is 0
      // For irregular students: use maxIrregularStudents
      const maxRegular = section.regularStudents > 0 ? section.regularStudents : (section.totalCapacity || 0);
      const maxIrregular = section.maxIrregularStudents || 0;
      
      const availableRegular = Math.max(0, maxRegular - enrolledRegular);
      const availableIrregular = Math.max(0, maxIrregular - enrolledIrregular);

      // Get section-specific schedule for this course
      let sectionSchedule = null;
      if (section.courseSchedules && section.courseSchedules instanceof Map) {
        sectionSchedule = section.courseSchedules.get(courseIdStr);
      } else if (section.courseSchedules && typeof section.courseSchedules === 'object') {
        sectionSchedule = section.courseSchedules[courseIdStr];
      }
      
      // Fall back to course default schedule if no section-specific schedule
      const schedule = sectionSchedule || course.schedule || { days: [], startTime: '', endTime: '', daySchedules: [] };

      return {
        id: section._id.toString(),
        sectionName: section.sectionName,
        // Regular seats info
        regularSeats: {
          enrolled: enrolledRegular,
          available: availableRegular,
          max: maxRegular,
        },
        // Irregular seats info
        irregularSeats: {
          enrolled: enrolledIrregular,
          available: availableIrregular,
          max: maxIrregular,
        },
        // Legacy fields for backward compatibility
        availableSeats: isRegular ? availableRegular : availableIrregular,
        maxIrregularSeats: maxIrregular,
        enrolledStudents: section.enrolledStudents || 0,
        // Section-specific schedule
        schedule: schedule,
      };
    });

    // Check if prerequisites are clear
    // Prerequisites are clear if:
    // 1. Course has no prerequisites, OR
    // 2. All prerequisite courses have been approved by advisor (status = 'approved')
    let prerequisiteClear = true;
    let missingPrerequisites = [];
    
    if (course.prerequisite && req.student) {
      const prerequisiteCodes = course.prerequisite.split(',').map(code => code.trim()).filter(Boolean);
      
      if (prerequisiteCodes.length > 0) {
        // Check if all prerequisites are met (approved courses)
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

  // Check if course has sections - if so, sectionId is required
  const sectionsForCourse = await Section.find({
    semester: course.semester,
    status: 'active'
  });
  
  if (sectionsForCourse.length > 0 && !sectionId) {
    return next(new ErrorHandler('Section selection is required for this course', 400));
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
    
    // For regular students, validate they can only register in their registered section
    if (isRegular && student && student.section) {
      if (selectedSection.sectionName.toUpperCase() !== student.section.toUpperCase()) {
        return next(new ErrorHandler('Regular students can only register in their registered section', 400));
      }
    }
    // Irregular students can register in any section (no additional validation needed)
    
    // Count regular and irregular students in this section for this course
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
      // For regular students, check if section has regular capacity
      const maxRegular = selectedSection.regularStudents || 0;
      if (enrolledRegular >= maxRegular) {
        return next(new ErrorHandler('No regular seats available in this section', 400));
      }
    } else {
      // For irregular students, check maxIrregularStudents
      const maxIrregular = selectedSection.maxIrregularStudents || 0;
      if (enrolledIrregular >= maxIrregular) {
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

  // Note: Seat availability is now checked per section above, so we don't need the general check here

  // Check prerequisites
  // Prerequisites are clear only if the prerequisite courses have been approved by advisor
  // Approved courses are considered as passed and clear prerequisites for other courses
  if (course.prerequisite) {
    const prerequisiteCodes = course.prerequisite.split(',').map(code => code.trim()).filter(Boolean);
    
    if (prerequisiteCodes.length > 0) {
      // Get all approved courses (these are considered as passed)
      const approvedRegistrations = await CourseRegistration.find({
        student: studentId,
        status: 'approved',
      }).populate('course');

      const approvedCourseCodes = approvedRegistrations
        .map(reg => reg.course?.courseCode)
        .filter(Boolean);

      // Check if all prerequisites are met
      const unmetPrerequisites = prerequisiteCodes.filter(code => !approvedCourseCodes.includes(code));
      
      if (unmetPrerequisites.length > 0) {
        return next(new ErrorHandler(
          `Prerequisites not clear. Missing prerequisites: ${unmetPrerequisites.join(', ')}. Only courses approved by advisor are considered as passed.`,
          400
        ));
      }
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
    .populate('section')
    .sort({ createdAt: -1 });

  // Get student's section to access section-specific instructors
  const Student = require('../models/studentModel');
  const student = await Student.findById(studentId).populate('section');
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

  const statusData = registrations.map(reg => {
    const enrolledCount = reg.course.enrolledStudents ? reg.course.enrolledStudents.length : 0;
    const totalSeats = reg.course.regularSeats + reg.course.irregularSeats;
    const availableSeats = Math.max(0, totalSeats - enrolledCount);

    // Resolve instructor name(s)
    let instructorName = '';
    const sectionToCheckForInstructor = reg.section || studentSection;
    const sectionName = sectionToCheckForInstructor?.sectionName;

    // Check if course uses section-specific instructor assignments
    const hasSectionSpecificInstructors = reg.course.instructorSections && 
      Array.isArray(reg.course.instructorSections) && 
      reg.course.instructorSections.length > 0;

    // First, try to find section-specific instructor
    if (sectionName && hasSectionSpecificInstructors) {
      const sectionInstructor = reg.course.instructorSections.find(instSec => 
        instSec.sections && instSec.sections.includes(sectionName)
      );
      
      if (sectionInstructor && sectionInstructor.instructorId) {
        instructorName = teacherMap.get(sectionInstructor.instructorId) || sectionInstructor.instructorId;
      }
      // If section-specific assignments exist but this section has no instructor, leave as empty (will show TBA)
    } else if (!hasSectionSpecificInstructors) {
      // Only use general instructors if section-specific assignments are NOT being used
      if (Array.isArray(reg.course.instructors) && reg.course.instructors.length > 0) {
        const instructorNames = reg.course.instructors
          .map(id => teacherMap.get(id) || id)
          .filter(Boolean);
        instructorName = instructorNames.length > 0 ? instructorNames.join(', ') : '';
      } else if (reg.course.instructor) {
        // Check if instructor is an ID or a name
        instructorName = teacherMap.get(reg.course.instructor) || reg.course.instructor;
      }
    }
    // If hasSectionSpecificInstructors is true but no match found, instructorName remains empty (TBA)

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

