const Admin = require('../models/adminModel');
const Course = require('../models/courseModel');
const Section = require('../models/sectionModel');
const Student = require('../models/studentModel');
const Teacher = require('../models/teacherModel');
const CourseRegistration = require('../models/courseRegistrationModel');
const SystemSettings = require('../models/systemSettingsModel');
const ErrorHandler = require('../utils/ErrorHandler');
const catchAsyncError = require('../middleware/CatchAsyncErrors');
const { sendToken } = require('../utils/jwt');
const validator = require('validator');
const { formatDate, formatGPA } = require('../utils/helpers');

exports.getAllAdminDetails = catchAsyncError(async (req, res, next) => {
  const admins = await Admin.find();
  
  const adminData = admins.map((item) => {
    return {
      id: item._id,
      name: item.name,
      adminId: item.adminId || null,
      email: item.email,
      privilege: item.privilege,
      source: 'Admin',
    };
  });

  res.status(200).json({
    success: true,
    message: 'Admin details fetched successfully',
    data: adminData,
  });
});


exports.loginAdmin = catchAsyncError(async(req, res, next) => {
  const { email, password } = req.body;

  if(!email || !password){
    return next(new ErrorHandler('Missing fields', 400));
  }

  const admin = await Admin.findOne({ email }).select('+password');
  if(!admin){
    return next(new ErrorHandler('Invalid email or password', 401));
  }

  const isPasswordCorrect = await admin.comparePassword(password);
  if(!isPasswordCorrect){
    return next(new ErrorHandler('Invalid email or password', 401));
  }

  sendToken(admin, 200, res);
})

exports.logoutAdmin = catchAsyncError(async(req, res, next) => {
  res.cookie('token', null, {
    expires: new Date(Date.now()),
    httpOnly: true,
  });
  res.status(200).json({
    success: true,
    message: 'Admin logged out successfully',
  });
})

exports.getSingleAdminDetails = catchAsyncError(async (req, res, next) => {
  if (!req.params.id) {
    return next(new ErrorHandler('User not found', 400));
  }
  const admin = await Admin.findById(req.params.id);
  if (!admin) {
    return next(new ErrorHandler('User not found', 200));
  }
  const adminData = {
    id: admin._id,
    name: admin.name,
    adminId: admin.adminId || null,
    email: admin.email,
    privilege: admin.privilege,
  };
  res.status(200).json({
    success: true,
    message: 'Admin details fetched successfully',
    data: adminData,
  });
});

exports.updateAdminPrivilege = catchAsyncError(async (req, res, next) => {
  const { name, email, privilege, adminId } = req.body;
  if (!req.params.id) {
    return next(new ErrorHandler('User not found', 400));
  }
  
  if (!name && !email && !privilege && adminId === undefined) {
    return next(new ErrorHandler('Invalid: no data provided', 400));
  }
  
  const admin = await Admin.findById(req.params.id);
  if (!admin) {
    return next(new ErrorHandler('User not found', 200));
  }
  
  if (privilege && admin.email === req.user.email) {
    return next(new ErrorHandler('Self-privilege modification is not allowed.', 400));
  }
  
  if (privilege && !['Super Admin', 'Admin'].includes(privilege)) {
    return next(new ErrorHandler('Invalid: privilege must be either "Super Admin" or "Admin"', 400));
  }
  
  if (email) {
    if (!validator.isEmail(email)) {
      return next(new ErrorHandler('Invalid: please provide a valid email', 400));
    }
    const existingAdmin = await Admin.findOne({ email, _id: { $ne: req.params.id } });
    if (existingAdmin) {
      return next(new ErrorHandler('Invalid: email already exists', 400));
    }
  }

  if (adminId !== undefined && adminId !== null && adminId !== '') {
    const existingAdminWithId = await Admin.findOne({ adminId, _id: { $ne: req.params.id } });
    if (existingAdminWithId) {
      return next(new ErrorHandler('Invalid: Admin ID already exists', 400));
    }
  }
  
  if (name) admin.name = name;
  if (email) admin.email = email;
  if (privilege) admin.privilege = privilege;
  if (adminId !== undefined) admin.adminId = adminId || undefined;
  
  await admin.save();
  
  res.status(200).json({
    success: true,
    message: 'Admin updated successfully',
    data: {
      id: admin._id,
      name: admin.name,
      adminId: admin.adminId || null,
      email: admin.email,
      privilege: admin.privilege,
    },
  });
});

exports.deleteAdmin = catchAsyncError(async (req, res, next) => {
  if (!req.params.id) {
    return next(new ErrorHandler('User not found', 400));
  }
  const admin = await Admin.findById(req.params.id);
  if (!admin) {
    return next(new ErrorHandler('User not found', 200));
  }
  if (admin.email === req.user.email) {
    return next(new ErrorHandler('Self-deletion is not allowed.', 400));
  }
  await admin.deleteOne();
  res.status(200).json({
    success: true,
    message: 'Admin deleted',
  });
});

exports.addCourse = catchAsyncError(async (req, res, next) => {
  const { courseCode, courseName, credits, department, prerequisite, semester, instructors, instructorSections } = req.body;

  if (!courseCode || !courseName || !credits || !department || !semester) {
    return next(new ErrorHandler('Missing required fields', 400));
  }

  const existingCourse = await Course.findOne({ courseCode: courseCode.toUpperCase() });
  if (existingCourse) {
    return next(new ErrorHandler('Course code already exists', 400));
  }

  const normalizedInstructors = Array.isArray(instructors)
    ? instructors.filter(Boolean).map((id) => id.toString().trim())
    : [];

  let normalizedInstructorSections = [];
  if (Array.isArray(instructorSections)) {
    for (const item of instructorSections) {
      if (item && item.instructorId) {
        const sectionNames = Array.isArray(item.sections)
          ? item.sections.filter(Boolean).map((s) => s.toString().trim())
          : [];
        
        if (sectionNames.length > 0) {
          const sectionsToVerify = await Section.find({
            sectionName: { $in: sectionNames },
          });
          
          const validSections = sectionsToVerify
            .filter((sec) => sec.semester === semester)
            .map((sec) => sec.sectionName);
          
          const invalidSections = sectionNames.filter((name) => !validSections.includes(name));
          if (invalidSections.length > 0) {
            return next(
              new ErrorHandler(
                `Sections ${invalidSections.join(', ')} do not match course semester ${semester}`,
                400
              )
            );
          }
          
          normalizedInstructorSections.push({
            instructorId: item.instructorId.toString().trim(),
            sections: validSections,
          });
        } else {
          normalizedInstructorSections.push({
            instructorId: item.instructorId.toString().trim(),
            sections: [],
          });
        }
      }
    }
  }

  const course = await Course.create({
    courseCode: courseCode.toUpperCase(),
    courseName,
    credits: Number(credits),
    department,
    prerequisite: prerequisite || '',
    instructors: normalizedInstructors,
    instructorSections: normalizedInstructorSections,
    semester,
    status: 'active',
  });

  res.status(201).json({
    success: true,
    message: 'Course added successfully',
    data: {
      id: course._id,
      courseCode: course.courseCode,
      courseName: course.courseName,
      credits: course.credits,
      department: course.department,
      prerequisite: course.prerequisite,
      instructors: course.instructors || [],
      instructorSections: course.instructorSections || [],
      semester: course.semester,
      status: course.status,
    },
  });
});

exports.getCourses = catchAsyncError(async (req, res, next) => {
  const { search, department, status, semester } = req.query;

  const query = {};

  if (search) {
    query.$or = [
      { courseCode: { $regex: search, $options: 'i' } },
      { courseName: { $regex: search, $options: 'i' } },
    ];
  }

  if (department && department !== 'All Departments') {
    query.department = department;
  }

  if (status) {
    query.status = status;
  }

  if (semester) {
    query.semester = semester;
  }

  const courses = await Course.find(query).sort({ createdAt: -1 });

  const courseData = courses.map((course) => ({
    id: course._id,
    courseCode: course.courseCode,
    courseName: course.courseName,
    credits: course.credits,
    department: course.department,
    prerequisite: course.prerequisite,
    instructors: course.instructors || [],
    instructorSections: course.instructorSections || [],
    semester: course.semester,
    status: course.status,
    schedule: course.schedule || { days: [], startTime: '', endTime: '' },
  }));

  res.status(200).json({
    success: true,
    message: 'Courses fetched successfully',
    data: courseData,
  });
});

exports.getSingleCourse = catchAsyncError(async (req, res, next) => {
  if (!req.params.id) {
    return next(new ErrorHandler('Course ID is required', 400));
  }

  const course = await Course.findById(req.params.id);
  if (!course) {
    return next(new ErrorHandler('Course not found', 404));
  }

  res.status(200).json({
    success: true,
    message: 'Course fetched successfully',
    data: {
      id: course._id,
      courseCode: course.courseCode,
      courseName: course.courseName,
      credits: course.credits,
      department: course.department,
      prerequisite: course.prerequisite,
      regularSeats: course.regularSeats,
      irregularSeats: course.irregularSeats,
      availableSeats: course.availableSeats,
      semester: course.semester,
      status: course.status,
    },
  });
});

exports.updateCourse = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  if (!id) {
    return next(new ErrorHandler('Course ID is required', 400));
  }

  const {
    courseCode,
    courseName,
    credits,
    department,
    prerequisite,
    semester,
    status,
    instructors,
    instructorSections,
    schedule,
  } = req.body;

  const fieldsProvided = [
    courseCode,
    courseName,
    credits,
    department,
    prerequisite,
    semester,
    status,
    instructors,
    instructorSections,
    schedule,
  ].some((field) => field !== undefined);

  if (!fieldsProvided) {
    return next(new ErrorHandler('No fields provided to update', 400));
  }

  const course = await Course.findById(id);
  if (!course) {
    return next(new ErrorHandler('Course not found', 404));
  }

  if (courseCode) {
    const formattedCode = courseCode.toUpperCase().trim();
    const existingCourse = await Course.findOne({
      courseCode: formattedCode,
      _id: { $ne: id },
    });
    if (existingCourse) {
      return next(new ErrorHandler('Course code already exists', 400));
    }
    course.courseCode = formattedCode;
  }

  if (courseName) {
    course.courseName = courseName;
  }

  if (credits !== undefined) {
    const creditsValue = Number(credits);
    if (Number.isNaN(creditsValue)) {
      return next(new ErrorHandler('Invalid credits value', 400));
    }
    course.credits = creditsValue;
  }

  if (department) {
    course.department = department;
  }

  if (prerequisite !== undefined) {
    course.prerequisite = prerequisite;
  }

  if (instructors !== undefined) {
    if (!Array.isArray(instructors)) {
      return next(new ErrorHandler('Invalid instructors value', 400));
    }
    course.instructors = instructors.filter(Boolean).map((id) => id.toString().trim());
  }

  if (instructorSections !== undefined) {
    if (!Array.isArray(instructorSections)) {
      return next(new ErrorHandler('Invalid instructorSections value', 400));
    }
    
    const courseSemester = semester || course.semester;
    const filteredInstructorSections = [];
    
    for (const item of instructorSections) {
      if (item && item.instructorId) {
        const sectionNames = Array.isArray(item.sections)
          ? item.sections.filter(Boolean).map((s) => s.toString().trim())
          : [];
        
        if (sectionNames.length > 0) {
          const sectionsToVerify = await Section.find({
            sectionName: { $in: sectionNames },
          });
          
          const validSections = sectionsToVerify
            .filter((sec) => sec.semester === courseSemester)
            .map((sec) => sec.sectionName);
          
          const invalidSections = sectionNames.filter((name) => !validSections.includes(name));
          if (invalidSections.length > 0) {
            return next(
              new ErrorHandler(
                `Sections ${invalidSections.join(', ')} do not match course semester ${courseSemester}`,
                400
              )
            );
          }
          
          filteredInstructorSections.push({
            instructorId: item.instructorId.toString().trim(),
            sections: validSections,
          });
        } else {
          filteredInstructorSections.push({
            instructorId: item.instructorId.toString().trim(),
            sections: [],
          });
        }
      }
    }
    
    course.instructorSections = filteredInstructorSections;
  }

  if (semester) {
    course.semester = semester;
  }

  if (status) {
    const allowedStatus = ['active', 'inactive'];
    if (!allowedStatus.includes(status)) {
      return next(new ErrorHandler('Invalid status value', 400));
    }
    course.status = status;
  }

  if (schedule !== undefined) {
    if (typeof schedule !== 'object' || schedule === null) {
      return next(new ErrorHandler('Invalid schedule value', 400));
    }
    
    const allowedDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    if (schedule.daySchedules !== undefined) {
      if (!Array.isArray(schedule.daySchedules)) {
        return next(new ErrorHandler('Schedule daySchedules must be an array', 400));
      }
      
      const validatedDaySchedules = schedule.daySchedules
        .filter(item => item && item.day && allowedDays.includes(item.day))
        .map(item => ({
          day: item.day,
          startTime: (item.startTime || '').toString().trim(),
          endTime: (item.endTime || '').toString().trim(),
        }));
      
      course.schedule.daySchedules = validatedDaySchedules;
      
      course.schedule.days = validatedDaySchedules.map(item => item.day);
      if (validatedDaySchedules.length > 0) {
        course.schedule.startTime = validatedDaySchedules[0].startTime || '';
        course.schedule.endTime = validatedDaySchedules[0].endTime || '';
      } else {
        course.schedule.startTime = '';
        course.schedule.endTime = '';
      }
    } else {
      if (schedule.days !== undefined) {
        if (!Array.isArray(schedule.days)) {
          return next(new ErrorHandler('Schedule days must be an array', 400));
        }
        const invalidDays = schedule.days.filter(day => !allowedDays.includes(day));
        if (invalidDays.length > 0) {
          return next(new ErrorHandler(`Invalid days: ${invalidDays.join(', ')}`, 400));
        }
        course.schedule.days = schedule.days;
        
        const startTime = (schedule.startTime || '').toString().trim();
        const endTime = (schedule.endTime || '').toString().trim();
        course.schedule.daySchedules = schedule.days.map(day => ({
          day,
          startTime,
          endTime,
        }));
      }
      
      if (schedule.startTime !== undefined) {
        course.schedule.startTime = schedule.startTime.toString().trim();
        if (course.schedule.daySchedules && course.schedule.daySchedules.length > 0) {
          course.schedule.daySchedules.forEach(item => {
            item.startTime = course.schedule.startTime;
          });
        }
      }
      
      if (schedule.endTime !== undefined) {
        course.schedule.endTime = schedule.endTime.toString().trim();
        if (course.schedule.daySchedules && course.schedule.daySchedules.length > 0) {
          course.schedule.daySchedules.forEach(item => {
            item.endTime = course.schedule.endTime;
          });
        }
      }
    }
  }

  await course.save();

  res.status(200).json({
    success: true,
    message: 'Course updated successfully'
  });
  });
 
exports.deleteCourse = catchAsyncError(async (req, res, next) => {
  if (!req.params.id) {
    return next(new ErrorHandler('Course ID is required', 400));
  }

  const course = await Course.findById(req.params.id);
  if (!course) {
    return next(new ErrorHandler('Course not found', 404));
  }

  if (course.enrolledStudents && course.enrolledStudents.length > 0) {
    return next(new ErrorHandler('Cannot delete course with enrolled students', 400));
  }

  await course.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Course deleted successfully',
  });
});

exports.createSection = catchAsyncError(async (req, res, next) => {
  const {
    sectionName, semester, shift, assignedAdvisor, regularStudents, maxIrregularStudents, enrolledStudents, crName, crContact, acrName, acrContact, status,
  } = req.body;

  const requiredFields = [
    sectionName, semester, shift, assignedAdvisor, maxIrregularStudents, crName, crContact, acrName, acrContact,
  ];

  if (requiredFields.some((value) => value === undefined || value === null || value === '')) {
    return next(new ErrorHandler('Missing required section fields', 400));
  }

  const formattedSectionName = sectionName.trim().toUpperCase();
  
  let regularStudentsValue = regularStudents !== undefined ? Number(regularStudents) : (enrolledStudents !== undefined ? Number(enrolledStudents) : 0);
  if (Number.isNaN(regularStudentsValue) || regularStudentsValue < 0) {
    return next(new ErrorHandler('Invalid regular students value', 400));
  }

  const maxIrregularStudentsValue = Number(maxIrregularStudents);
  if (Number.isNaN(maxIrregularStudentsValue) || maxIrregularStudentsValue < 0) {
    return next(new ErrorHandler('Invalid maximum irregular students value', 400));
  }

  const capacityValue = regularStudentsValue + maxIrregularStudentsValue;
  if (capacityValue < 1 || capacityValue > 50) {
    return next(new ErrorHandler('Total capacity must be between 1 and 50', 400));
  }

  let enrollmentValue = enrolledStudents !== undefined ? Number(enrolledStudents) : 0;
  if (Number.isNaN(enrollmentValue) || enrollmentValue < 0) {
    return next(new ErrorHandler('Invalid enrolled students value', 400));
  }
  if (enrollmentValue > capacityValue) {
    return next(new ErrorHandler('Enrolled students cannot exceed total capacity', 400));
  }

  const existingSection = await Section.findOne({ sectionName: formattedSectionName });
  if (existingSection) {
    return next(new ErrorHandler('Section name already exists', 400));
  }

  const section = await Section.create({
    sectionName: formattedSectionName,
    semester,
    shift,
    assignedAdvisor,
    regularStudents: regularStudentsValue,
    maxIrregularStudents: maxIrregularStudentsValue,
    totalCapacity: capacityValue,
    enrolledStudents: enrollmentValue,
    crName,
    crContact,
    acrName,
    acrContact,
    status: status || 'active',
  });

  res.status(201).json({
    success: true,
    message: 'Section created successfully',
    data: {
      id: section._id,
      sectionName: section.sectionName,
      semester: section.semester,
      shift: section.shift,
      assignedAdvisor: section.assignedAdvisor,
      regularStudents: section.regularStudents,
      maxIrregularStudents: section.maxIrregularStudents,
      totalCapacity: section.totalCapacity,
      enrolledStudents: section.enrolledStudents,
      availableSeats: section.availableSeats,
      crName: section.crName,
      crContact: section.crContact,
      acrName: section.acrName,
      acrContact: section.acrContact,
      status: section.status,
    },
  });
});

const inferShiftFromSectionName = (sectionName) => {
  const nameUpper = sectionName.toUpperCase();
  if (nameUpper.includes('E') || nameUpper.endsWith('E')) {
    return 'Evening';
  }
  if (nameUpper.includes('M') && !nameUpper.includes('E')) {
    return 'Morning';
  }
  if (nameUpper.includes('G')) {
    return 'Morning';
  }
  return 'Morning';
};

exports.populateSectionsFromStudents = catchAsyncError(async (req, res, next) => {
  try {
    const students = await Student.find({ section: { $exists: true, $ne: null, $ne: '' } });
    
    if (students.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No students with section data found',
        data: {
          created: 0,
          skipped: 0,
          sections: [],
        },
      });
    }

    const sectionDataMap = new Map();
    students.forEach((student) => {
      if (student.section) {
        const sectionName = student.section.trim().toUpperCase();
        if (sectionName) {
          if (!sectionDataMap.has(sectionName)) {
            sectionDataMap.set(sectionName, { studentIds: [], count: 0 });
          }
          const data = sectionDataMap.get(sectionName);
          data.studentIds.push(student._id);
          data.count += 1;
        }
      }
    });

    const existingSections = await Section.find({});
    const existingSectionNames = new Set(
      existingSections.map((s) => s.sectionName.toUpperCase())
    );

    const advisors = await Teacher.find({ privilege: 'Advisor' }).limit(1);
    const defaultAdvisor = advisors.length > 0 ? advisors[0].teacherId : 'TBD';

    const createdSections = [];
    const skippedSections = [];
    let createdCount = 0;
    let skippedCount = 0;

    for (const [sectionName, sectionData] of sectionDataMap.entries()) {
      const studentCount = sectionData.count;
      const studentIds = sectionData.studentIds;

      if (existingSectionNames.has(sectionName)) {
        skippedSections.push({
          sectionName,
          reason: 'Already exists',
          studentCount,
        });
        skippedCount++;
        continue;
      }

      try {
        const registrations = await CourseRegistration.find({
          student: { $in: studentIds }
        }).populate('course', 'semester');

        const semesterCountMap = new Map();
        registrations.forEach((reg) => {
          if (reg.semester) {
            semesterCountMap.set(reg.semester, (semesterCountMap.get(reg.semester) || 0) + 1);
          } else if (reg.course && reg.course.semester) {
            semesterCountMap.set(reg.course.semester, (semesterCountMap.get(reg.course.semester) || 0) + 1);
          }
        });

        let inferredSemester = 'Unknown';
        if (semesterCountMap.size > 0) {
          let maxCount = 0;
          for (const [semester, count] of semesterCountMap.entries()) {
            if (count > maxCount) {
              maxCount = count;
              inferredSemester = semester;
            }
          }
        }

        const inferredShift = inferShiftFromSectionName(sectionName);

        const enrolledStudents = studentCount;
        const regularStudents = Math.min(studentCount, 50);
        const maxIrregularStudents = studentCount > 50 ? 0 : 5; // Allow 5 irregular if under capacity
        const totalCapacity = regularStudents + maxIrregularStudents;

        const section = await Section.create({
          sectionName,
          semester: inferredSemester,
          shift: inferredShift,
          assignedAdvisor: defaultAdvisor,
          regularStudents,
          maxIrregularStudents,
          totalCapacity,
          enrolledStudents,
          crName: 'TBD',
          crContact: 'TBD',
          acrName: 'TBD',
          acrContact: 'TBD',
          status: 'active',
        });

        createdSections.push({
          sectionName: section.sectionName,
          semester: section.semester,
          shift: section.shift,
          enrolledStudents: section.enrolledStudents,
          assignedAdvisor: section.assignedAdvisor,
        });
        createdCount++;
      } catch (error) {
        skippedSections.push({
          sectionName,
          reason: error.message || 'Creation failed',
          studentCount,
        });
        skippedCount++;
      }
    }

    res.status(200).json({
      success: true,
      message: `Sections populated successfully. Created: ${createdCount}, Skipped: ${skippedCount}`,
      data: {
        created: createdCount,
        skipped: skippedCount,
        sections: createdSections,
        skipped: skippedSections,
      },
    });
  } catch (error) {
    return next(new ErrorHandler(error.message || 'Failed to populate sections from student data', 500));
  }
});

exports.getSections = catchAsyncError(async (req, res) => {
  const { semester } = req.query;
  const query = {};

  if (semester && semester !== 'All Semesters') {
    query.semester = semester;
  }

  const sections = await Section.find(query).sort({ createdAt: -1 });

  const aggregated = await Section.aggregate([
    { $match: Object.keys(query).length ? query : {} },
    {
      $group: {
        _id: null,
        totalCapacity: { $sum: '$totalCapacity' },
        enrolledStudents: { $sum: '$enrolledStudents' },
        availableSeats: { $sum: '$availableSeats' },
      },
    },
  ]);

  const stats = aggregated[0] || {
    totalCapacity: 0,
    enrolledStudents: 0,
    availableSeats: 0,
  };

  const sectionData = sections.map((section) => ({
    id: section._id,
    sectionName: section.sectionName,
    semester: section.semester,
    shift: section.shift,
    assignedAdvisor: section.assignedAdvisor,
    regularStudents: section.regularStudents || section.enrolledStudents || 0,
    maxIrregularStudents: section.maxIrregularStudents || 0,
    totalCapacity: section.totalCapacity,
    enrolledStudents: section.enrolledStudents,
    availableSeats: section.availableSeats,
    crName: section.crName,
    crContact: section.crContact,
    acrName: section.acrName,
    acrContact: section.acrContact,
    status: section.status,
    createdAt: section.createdAt,
  }));

  res.status(200).json({
    success: true,
    message: 'Sections fetched successfully',
    data: sectionData,
    statistics: {
      totalSections: sectionData.length,
      totalCapacity: stats.totalCapacity,
      enrolledStudents: stats.enrolledStudents,
      availableSeats: stats.availableSeats,
    },
  });
});

exports.getSingleSection = catchAsyncError(async (req, res, next) => {
  if (!req.params.id) {
    return next(new ErrorHandler('Section ID is required', 400));
  }

  const section = await Section.findById(req.params.id);
  if (!section) {
    return next(new ErrorHandler('Section not found', 404));
  }

  const courseSchedulesObj = {};
  if (section.courseSchedules && section.courseSchedules instanceof Map) {
    section.courseSchedules.forEach((schedule, courseId) => {
      courseSchedulesObj[courseId] = schedule;
    });
  }

  res.status(200).json({
    success: true,
    message: 'Section fetched successfully',
    data: {
      id: section._id,
      sectionName: section.sectionName,
      semester: section.semester,
      shift: section.shift,
      assignedAdvisor: section.assignedAdvisor,
      regularStudents: section.regularStudents || section.enrolledStudents || 0,
      maxIrregularStudents: section.maxIrregularStudents || 0,
      totalCapacity: section.totalCapacity,
      enrolledStudents: section.enrolledStudents,
      availableSeats: section.availableSeats,
      crName: section.crName,
      crContact: section.crContact,
      acrName: section.acrName,
      acrContact: section.acrContact,
      status: section.status,
      courseSchedules: courseSchedulesObj,
      createdAt: section.createdAt,
    },
  });
});

exports.updateSection = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  if (!id) {
    return next(new ErrorHandler('Section ID is required', 400));
  }

  const {
    sectionName,
    semester,
    shift,
    assignedAdvisor,
    regularStudents,
    maxIrregularStudents,
    enrolledStudents,
    crName,
    crContact,
    acrName,
    acrContact,
    status,
  } = req.body;

  const fields = [
    sectionName,
    semester,
    shift,
    assignedAdvisor,
    regularStudents,
    maxIrregularStudents,
    enrolledStudents,
    crName,
    crContact,
    acrName,
    acrContact,
    status,
  ];

  if (fields.every((value) => value === undefined)) {
    return next(new ErrorHandler('No fields provided to update', 400));
  }

  const section = await Section.findById(id);
  if (!section) {
    return next(new ErrorHandler('Section not found', 404));
  }

  if (sectionName) {
    const formattedSectionName = sectionName.trim().toUpperCase();
    const existingSection = await Section.findOne({
      sectionName: formattedSectionName,
      _id: { $ne: id },
    });
    if (existingSection) {
      return next(new ErrorHandler('Section name already exists', 400));
    }
    section.sectionName = formattedSectionName;
  }

  if (semester) section.semester = semester;
  if (shift) section.shift = shift;
  if (assignedAdvisor) section.assignedAdvisor = assignedAdvisor;
  if (crName) section.crName = crName;
  if (crContact) section.crContact = crContact;
  if (acrName) section.acrName = acrName;
  if (acrContact) section.acrContact = acrContact;
  if (status) section.status = status;

  let regularStudentsValue = section.regularStudents;
  let maxIrregularStudentsValue = section.maxIrregularStudents;

  if (regularStudents !== undefined) {
    regularStudentsValue = Number(regularStudents);
    if (Number.isNaN(regularStudentsValue) || regularStudentsValue < 0) {
      return next(new ErrorHandler('Invalid regular students value', 400));
    }
    section.regularStudents = regularStudentsValue;
  }

  if (maxIrregularStudents !== undefined) {
    maxIrregularStudentsValue = Number(maxIrregularStudents);
    if (Number.isNaN(maxIrregularStudentsValue) || maxIrregularStudentsValue < 0) {
      return next(new ErrorHandler('Invalid maximum irregular students value', 400));
    }
    section.maxIrregularStudents = maxIrregularStudentsValue;
  }

  const capacityValue = regularStudentsValue + maxIrregularStudentsValue;
  if (capacityValue < 1 || capacityValue > 50) {
    return next(new ErrorHandler('Total capacity must be between 1 and 50', 400));
  }
  section.totalCapacity = capacityValue;

  if (enrolledStudents !== undefined) {
    const enrollmentValue = Number(enrolledStudents);
    if (Number.isNaN(enrollmentValue) || enrollmentValue < 0) {
      return next(new ErrorHandler('Invalid enrolled students value', 400));
    }
    if (enrollmentValue > section.totalCapacity) {
      return next(new ErrorHandler('Enrolled students cannot exceed total capacity', 400));
    }
    section.enrolledStudents = enrollmentValue;
  }

  await section.save();

  res.status(200).json({
    success: true,
    message: 'Section updated successfully',
  });
});

exports.updateSectionCourseSchedule = catchAsyncError(async (req, res, next) => {
  const { sectionId, courseId } = req.params;
  const { schedule } = req.body;

  if (!sectionId || !courseId) {
    return next(new ErrorHandler('Section ID and Course ID are required', 400));
  }

  const section = await Section.findById(sectionId);
  if (!section) {
    return next(new ErrorHandler('Section not found', 404));
  }

  const Course = require('../models/courseModel');
  const course = await Course.findById(courseId);
  if (!course) {
    return next(new ErrorHandler('Course not found', 404));
  }

  if (!schedule || typeof schedule !== 'object') {
    return next(new ErrorHandler('Invalid schedule data', 400));
  }

  const allowedDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  if (schedule.daySchedules !== undefined) {
    if (!Array.isArray(schedule.daySchedules)) {
      return next(new ErrorHandler('Schedule daySchedules must be an array', 400));
    }
    
    const validatedDaySchedules = schedule.daySchedules
      .filter(item => item && item.day && allowedDays.includes(item.day))
      .map(item => ({
        day: item.day,
        startTime: (item.startTime || '').toString().trim(),
        endTime: (item.endTime || '').toString().trim(),
        room: (item.room || '').toString().trim(),
      }));
    
    if (!section.courseSchedules) {
      section.courseSchedules = new Map();
    }
    
    section.courseSchedules.set(courseId, {
      daySchedules: validatedDaySchedules,
      days: validatedDaySchedules.map(item => item.day),
      startTime: validatedDaySchedules.length > 0 ? validatedDaySchedules[0].startTime : '',
      endTime: validatedDaySchedules.length > 0 ? validatedDaySchedules[0].endTime : '',
      room: validatedDaySchedules.length > 0 ? validatedDaySchedules[0].room : '',
    });
  } else {
    if (schedule.days && Array.isArray(schedule.days)) {
      const invalidDays = schedule.days.filter(day => !allowedDays.includes(day));
      if (invalidDays.length > 0) {
        return next(new ErrorHandler(`Invalid days: ${invalidDays.join(', ')}`, 400));
      }
      
      if (!section.courseSchedules) {
        section.courseSchedules = new Map();
      }
      
      const startTime = (schedule.startTime || '').toString().trim();
      const endTime = (schedule.endTime || '').toString().trim();
      const room = (schedule.room || '').toString().trim();
      
      section.courseSchedules.set(courseId, {
        days: schedule.days,
        startTime,
        endTime,
        room,
        daySchedules: schedule.days.map(day => ({
          day,
          startTime,
          endTime,
          room,
        })),
      });
    } else {
      return next(new ErrorHandler('Invalid schedule format', 400));
    }
  }

  await section.save();

  res.status(200).json({
    success: true,
    message: 'Section course schedule updated successfully',
  });
});

exports.deleteSection = catchAsyncError(async (req, res, next) => {
  if (!req.params.id) {
    return next(new ErrorHandler('Section ID is required', 400));
  }

  const section = await Section.findById(req.params.id);
  if (!section) {
    return next(new ErrorHandler('Section not found', 404));
  }

  await section.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Section deleted successfully',
  });
});

const serializeStudent = (student) => ({
  id: student._id,
  name: student.name,
  studentId: student.studentId,
  email: student.email,
  mobileNumber: student.mobileNumber,
  department: student.department,
  section: student.section,
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
});

const serializeTeacher = (teacher) => ({
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
  privilege: teacher.privilege,
});

const applyUpdates = (document, updates) => {
  Object.entries(updates).forEach(([key, value]) => {
    if (['_id', '__v'].includes(key)) {
      return;
    }
    document[key] = value;
  });
};

exports.getUserManagementOverview = catchAsyncError(async (req, res) => {
  const [students, teachers] = await Promise.all([
    Student.find(),
    Teacher.find(),
  ]);

  res.status(200).json({
    success: true,
    message: 'User management overview fetched successfully',
    data: {
      totals: {
        totalStudents: students.length,
        totalTeachers: teachers.length,
      },
      students: students.map(serializeStudent),
      teachers: teachers.map(serializeTeacher),
    },
  });
});

exports.getAllStudentsForAdmin = catchAsyncError(async (req, res) => {
  const students = await Student.find();
  res.status(200).json({
    success: true,
    message: 'All student details fetched successfully',
    data: students.map(serializeStudent),
  });
});

exports.getAllTeachersForAdmin = catchAsyncError(async (req, res) => {
  const teachers = await Teacher.find();
  res.status(200).json({
    success: true,
    message: 'All teacher details fetched successfully',
    data: teachers.map(serializeTeacher),
  });
});

exports.getAllAdvisors = catchAsyncError(async (req, res) => {
  const advisors = await Teacher.find({ privilege: 'Advisor' });
  res.status(200).json({
    success: true,
    message: 'All advisors fetched successfully',
    data: advisors.map(serializeTeacher),
  });
});

exports.updateStudentByAdmin = catchAsyncError(async (req, res, next) => {
  if (!req.params.id) {
    return next(new ErrorHandler('Student not found', 400));
  }

  if (req.user?.privilege !== 'Super Admin') {
    return next(new ErrorHandler('Only Super Admin can modify user records', 403));
  }

  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new ErrorHandler('Invalid: no data provided', 400));
  }

  const student = await Student.findById(req.params.id).select('+password');
  if (!student) {
    return next(new ErrorHandler('Student not found', 404));
  }

  applyUpdates(student, req.body);
  await student.save();

  res.status(200).json({
    success: true,
    message: 'Student record updated successfully',
    data: serializeStudent(student),
  });
});

exports.updateTeacherByAdmin = catchAsyncError(async (req, res, next) => {
  if (!req.params.id) {
    return next(new ErrorHandler('Teacher not found', 400));
  }

  if (req.user?.privilege !== 'Super Admin') {
    return next(new ErrorHandler('Only Super Admin can modify user records', 403));
  }

  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new ErrorHandler('Invalid: no data provided', 400));
  }

  const teacher = await Teacher.findById(req.params.id).select('+password');
  if (!teacher) {
    return next(new ErrorHandler('Teacher not found', 404));
  }

  if (req.body.privilege !== undefined) {
    const allowedPrivileges = ['Teacher', 'Advisor'];
    if (!allowedPrivileges.includes(req.body.privilege)) {
      return next(new ErrorHandler('Invalid: privilege must be either "Teacher" or "Advisor"', 400));
    }
    teacher.privilege = req.body.privilege;
  }

  const updates = { ...req.body };
  delete updates.privilege;
  applyUpdates(teacher, updates);
  
  await teacher.save();

  res.status(200).json({
    success: true,
    message: 'Teacher record updated successfully',
    data: serializeTeacher(teacher),
  });
});

exports.deleteStudentByAdmin = catchAsyncError(async (req, res, next) => {
  if (!req.params.id) {
    return next(new ErrorHandler('Student not found', 400));
  }

  if (req.user?.privilege !== 'Super Admin') {
    return next(new ErrorHandler('Only Super Admin can delete user records', 403));
  }

  const student = await Student.findById(req.params.id);
  if (!student) {
    return next(new ErrorHandler('Student not found', 404));
  }

  await student.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Student deleted successfully',
  });
});

exports.deleteTeacherByAdmin = catchAsyncError(async (req, res, next) => {
  if (!req.params.id) {
    return next(new ErrorHandler('Teacher not found', 400));
  }

  if (req.user?.privilege !== 'Super Admin') {
    return next(new ErrorHandler('Only Super Admin can delete user records', 403));
  }

  const teacher = await Teacher.findById(req.params.id);
  if (!teacher) {
    return next(new ErrorHandler('Teacher not found', 404));
  }

  await teacher.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Teacher deleted successfully',
  });
});

exports.uploadStudentCSV = catchAsyncError(async (req, res, next) => {
  if (!req.file) {
    return next(new ErrorHandler('No CSV file uploaded', 400));
  }

  const fs = require('fs');
  const csv = require('csv-parser');
  const path = require('path');
  const filePath = req.file.path;
  const results = [];
  const errors = [];
  const created = [];
  const skipped = [];
  const sectionStats = {};

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        results.push(row);
      })
      .on('end', async () => {
        try {
          for (const row of results) {
            try {
              const studentId = (row['Student Id'] || row['StudentId'] || row['student id'] || row['studentid'] || '').trim();
              const studentName = (row['Student Name'] || row['StudentName'] || row['student name'] || row['studentname'] || '').trim();
              const email = (row['Email'] || row['email'] || '').trim();
              const password = (row['Password'] || row['password'] || '').trim();
              const department = (row['Department'] || row['department'] || '').trim();
              const session = row['Session'] || row['session'] || '';
              const semester = row['Semester'] || row['semester'] || '';
              const sectionRaw = row['Section'] || row['section'] || '';
              const section =
                sectionRaw && typeof sectionRaw === 'string'
                  ? sectionRaw.trim().toUpperCase()
                  : '';

              if (!studentName || !studentId || !email || !password) {
                errors.push({
                  row: row,
                  error: 'Missing required fields (Student Name, Student Id, Email, or Password)'
                });
                continue;
              }

              if (!validator.isEmail(email)) {
                errors.push({
                  row: row,
                  error: `Invalid email format: ${email}`
                });
                continue;
              }

              const existingStudentById = await Student.findOne({ studentId });
              const existingStudentByEmail = await Student.findOne({ email });
              
              if (existingStudentById || existingStudentByEmail) {
                const existingStudent = existingStudentById || existingStudentByEmail;
                if (section) {
                  existingStudent.section = section;
                  await existingStudent.save();
                  skipped.push({
                    studentId: studentId,
                    email: email,
                    reason: 'Student already exists - section updated'
                  });
                  if (section) {
                    if (!sectionStats[section]) {
                      sectionStats[section] = {
                        semester: semester || undefined,
                        count: 0,
                      };
                    }
                    sectionStats[section].count += 1;
                  }
                } else {
                  skipped.push({
                    studentId: studentId,
                    email: email,
                    reason: existingStudentById ? 'Student with this ID already exists' : 'Student with this email already exists'
                  });
                }
                continue;
              }

              const student = await Student.create({
                name: studentName,
                studentId: studentId,
                email: email,
                password: password,
                department: department || undefined,
                section: section || undefined
              });

              created.push({
                id: student._id,
                name: student.name,
                studentId: student.studentId,
                email: student.email,
                department: student.department,
                section: student.section
              });

              if (section) {
                if (!sectionStats[section]) {
                  sectionStats[section] = {
                    semester: semester || undefined,
                    session: session || undefined, // Store session for shift inference
                    count: 0,
                  };
                }
                sectionStats[section].count += 1;
              }
            } catch (error) {
              errors.push({
                row: row,
                error: error.message || 'Unknown error'
              });
            }
          }

          const inferShiftFromSectionName = (sectionName) => {
            const nameUpper = sectionName.toUpperCase();
            if (nameUpper.includes('E') || nameUpper.endsWith('E')) {
              return 'Evening';
            }
            if (nameUpper.includes('M') && !nameUpper.includes('E')) {
              return 'Morning';
            }
            if (nameUpper.includes('G')) {
              return 'Morning';
            }
            return 'Morning';
          };

          const sectionNames = Object.keys(sectionStats);
          for (const sectionName of sectionNames) {
            try {
              const stats = sectionStats[sectionName];
              const enrolledCount = await Student.countDocuments({
                section: sectionName,
              });

              let sectionDoc = await Section.findOne({ sectionName });
              if (!sectionDoc) {
                const inferredShift = inferShiftFromSectionName(sectionName);
                
                const regularStudents = Math.min(enrolledCount, 50);
                const maxIrregularStudents = enrolledCount > 50 ? 0 : 5; // Allow 5 irregular if under capacity
                const totalCapacity = regularStudents + maxIrregularStudents;

                sectionDoc = await Section.create({
                  sectionName,
                  semester: stats.semester || 'Unknown',
                  shift: inferredShift,
                  assignedAdvisor: 'TBD',
                  regularStudents: regularStudents,
                  maxIrregularStudents: maxIrregularStudents,
                  totalCapacity: totalCapacity,
                  enrolledStudents: enrolledCount,
                  crName: 'TBD',
                  crContact: 'TBD',
                  acrName: 'TBD',
                  acrContact: 'TBD',
                  status: 'active',
                });
              } else {
                const currentEnrolled = sectionDoc.enrolledStudents || 0;
                const newEnrolled = enrolledCount;
                
                sectionDoc.enrolledStudents = newEnrolled;
                
                if (newEnrolled > sectionDoc.totalCapacity) {
                  const regularStudents = Math.min(newEnrolled, 50);
                  const maxIrregularStudents = newEnrolled > 50 ? 0 : Math.max(5, sectionDoc.maxIrregularStudents || 0);
                  sectionDoc.regularStudents = regularStudents;
                  sectionDoc.maxIrregularStudents = maxIrregularStudents;
                } else if (newEnrolled > (sectionDoc.regularStudents || 0)) {
                  sectionDoc.regularStudents = Math.min(newEnrolled, 50);
                }
                
                await sectionDoc.save();
              }
            } catch (sectionError) {
              errors.push({
                sectionName,
                error:
                  sectionError.message ||
                  'Error while syncing section after CSV upload',
              });
            }
          }

          fs.unlinkSync(filePath);

          res.status(200).json({
            success: true,
            message: `CSV processed successfully. Created: ${created.length}, Skipped: ${skipped.length}, Errors: ${errors.length}`,
            data: {
              created: created,
              skipped: skipped,
              errors: errors
            }
          });
          resolve();
        } catch (error) {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          reject(error);
        }
      })
      .on('error', (error) => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        reject(error);
      });
  });
});

exports.uploadAdminCSV = catchAsyncError(async (req, res, next) => {
  if (!req.file) {
    return next(new ErrorHandler('No CSV file uploaded', 400));
  }

  const fs = require('fs');
  const csv = require('csv-parser');
  const path = require('path');
  const filePath = req.file.path;
  const results = [];
  const errors = [];
  const created = [];
  const skipped = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        results.push(row);
      })
      .on('end', async () => {
        try {
          for (const row of results) {
            try {
              const adminId = row['Admin Id'] || row['AdminId'] || row['admin id'] || row['adminid'] || '';
              const adminName = row['Admin Name'] || row['AdminName'] || row['admin name'] || row['adminname'] || '';
              const email = (row['Email'] || row['email'] || '').trim();
              const password = (row['Password'] || row['password'] || '').trim();
              const department = row['Department'] || row['department'] || '';

              if (!adminName || !email || !password) {
                errors.push({
                  row: row,
                  error: 'Missing required fields (Admin Name, Email, or Password)'
                });
                continue;
              }

              if (!validator.isEmail(email)) {
                errors.push({
                  row: row,
                  error: `Invalid email format: ${email}`
                });
                continue;
              }

              const existingAdmin = await Admin.findOne({ email });
              if (existingAdmin) {
                skipped.push({
                  email: email,
                  reason: 'Admin with this email already exists'
                });
                continue;
              }

              const admin = await Admin.create({
                name: adminName,
                adminId: adminId || undefined,
                email: email,
                password: password,
                privilege: 'Admin'
              });

              created.push({
                id: admin._id,
                name: admin.name,
                adminId: admin.adminId,
                email: admin.email,
                privilege: admin.privilege
              });
            } catch (error) {
              errors.push({
                row: row,
                error: error.message || 'Unknown error'
              });
            }
          }

          fs.unlinkSync(filePath);

          res.status(200).json({
            success: true,
            message: `CSV processed successfully. Created: ${created.length}, Skipped: ${skipped.length}, Errors: ${errors.length}`,
            data: {
              created: created,
              skipped: skipped,
              errors: errors
            }
          });
          resolve();
        } catch (error) {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          reject(error);
        }
      })
      .on('error', (error) => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        reject(error);
      });
  });
});

exports.uploadTeacherCSV = catchAsyncError(async (req, res, next) => {
  if (!req.file) {
    return next(new ErrorHandler('No CSV file uploaded', 400));
  }

  const fs = require('fs');
  const csv = require('csv-parser');
  const path = require('path');
  const filePath = req.file.path;
  const results = [];
  const errors = [];
  const created = [];
  const skipped = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        results.push(row);
      })
      .on('end', async () => {
        try {
          for (const row of results) {
            try {
              const teacherId = (row['Teacher Id'] || row['TeacherId'] || row['teacher id'] || row['teacherid'] || '').trim();
              const teacherName = (row['Teacher Name'] || row['TeacherName'] || row['teacher name'] || row['teachername'] || '').trim();
              const email = (row['Email'] || row['email'] || '').trim();
              const password = (row['Password'] || row['password'] || '').trim();
              const department = (row['Department'] || row['department'] || '').trim();
              const designation = (row['Designation'] || row['designation'] || '').trim();
              const contact = (row['Contact'] || row['contact'] || '').trim();

              if (!teacherName || !email || !password) {
                errors.push({
                  row: row,
                  error: 'Missing required fields (Teacher Name, Email, or Password)'
                });
                continue;
              }

              if (!validator.isEmail(email)) {
                errors.push({
                  row: row,
                  error: `Invalid email format: ${email}`
                });
                continue;
              }

              const existingTeacherById = teacherId ? await Teacher.findOne({ teacherId }) : null;
              const existingTeacherByEmail = await Teacher.findOne({ email });
              
              if (existingTeacherById || existingTeacherByEmail) {
                skipped.push({
                  teacherId: teacherId,
                  email: email,
                  reason: existingTeacherById ? 'Teacher with this ID already exists' : 'Teacher with this email already exists'
                });
                continue;
              }

              const teacher = await Teacher.create({
                name: teacherName,
                teacherId: teacherId || undefined,
                email: email,
                password: password,
                department: department || undefined,
                designation: designation || undefined,
                mobileNumber: contact || undefined
              });

              created.push({
                id: teacher._id,
                name: teacher.name,
                teacherId: teacher.teacherId,
                email: teacher.email,
                department: teacher.department,
                designation: teacher.designation
              });
            } catch (error) {
              errors.push({
                row: row,
                error: error.message || 'Unknown error'
              });
            }
          }

          fs.unlinkSync(filePath);

          res.status(200).json({
            success: true,
            message: `CSV processed successfully. Created: ${created.length}, Skipped: ${skipped.length}, Errors: ${errors.length}`,
            data: {
              created: created,
              skipped: skipped,
              errors: errors
            }
          });
          resolve();
        } catch (error) {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          reject(error);
        }
      })
      .on('error', (error) => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        reject(error);
      });
  });
});

exports.getSystemSettings = catchAsyncError(async (req, res, next) => {
  const settings = await SystemSettings.getSettings();
  
  res.status(200).json({
    success: true,
    message: 'System settings fetched successfully',
    data: {
      registrationPeriod: settings.registrationPeriod,
      universityName: settings.universityName,
      currentSemester: settings.currentSemester,
      systemEmail: settings.systemEmail,
      maintenanceMode: settings.maintenanceMode
    }
  });
});

exports.updateSystemSettings = catchAsyncError(async (req, res, next) => {
  const { 
    registrationPeriod, 
    universityName, 
    currentSemester, 
    systemEmail, 
    maintenanceMode 
  } = req.body;
  
  const settings = await SystemSettings.getSettings();
  
  if (registrationPeriod !== undefined) {
    if (registrationPeriod.startDate !== undefined) {
      settings.registrationPeriod.startDate = registrationPeriod.startDate;
    }
    if (registrationPeriod.endDate !== undefined) {
      settings.registrationPeriod.endDate = registrationPeriod.endDate;
    }
    if (registrationPeriod.enabled !== undefined) {
      settings.registrationPeriod.enabled = registrationPeriod.enabled;
    }
    
    if (settings.registrationPeriod.startDate && settings.registrationPeriod.endDate) {
      if (new Date(settings.registrationPeriod.startDate) >= new Date(settings.registrationPeriod.endDate)) {
        return next(new ErrorHandler('Registration start date must be before end date', 400));
      }
    }
  }
  
  if (universityName !== undefined) {
    settings.universityName = universityName;
  }
  if (currentSemester !== undefined) {
    settings.currentSemester = currentSemester;
  }
  if (systemEmail !== undefined) {
    settings.systemEmail = systemEmail;
  }
  if (maintenanceMode !== undefined) {
    settings.maintenanceMode = maintenanceMode;
  }
  
  await settings.save();
  
  res.status(200).json({
    success: true,
    message: 'System settings updated successfully',
    data: {
      registrationPeriod: settings.registrationPeriod,
      universityName: settings.universityName,
      currentSemester: settings.currentSemester,
      systemEmail: settings.systemEmail,
      maintenanceMode: settings.maintenanceMode
    }
  });
});
