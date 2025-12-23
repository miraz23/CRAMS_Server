const Admin = require('../models/adminModel');
const Course = require('../models/courseModel');
const Section = require('../models/sectionModel');
const Student = require('../models/studentModel');
const Teacher = require('../models/teacherModel');
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

  // Find an admin by email and explicitly include the password field in the query result
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
  
  // Check if at least one field is provided
  if (!name && !email && !privilege && adminId === undefined) {
    return next(new ErrorHandler('Invalid: no data provided', 400));
  }
  
  const admin = await Admin.findById(req.params.id);
  if (!admin) {
    return next(new ErrorHandler('User not found', 200));
  }
  
  // Prevent self-modification of privilege
  if (privilege && admin.email === req.user.email) {
    return next(new ErrorHandler('Self-privilege modification is not allowed.', 400));
  }
  
  // Validate privilege if provided
  if (privilege && !['Super Admin', 'Admin'].includes(privilege)) {
    return next(new ErrorHandler('Invalid: privilege must be either "Super Admin" or "Admin"', 400));
  }
  
  // Validate email format if provided
  if (email) {
    if (!validator.isEmail(email)) {
      return next(new ErrorHandler('Invalid: please provide a valid email', 400));
    }
    // Check if email is already taken by another admin
    const existingAdmin = await Admin.findOne({ email, _id: { $ne: req.params.id } });
    if (existingAdmin) {
      return next(new ErrorHandler('Invalid: email already exists', 400));
    }
  }

  // Check if adminId is already taken by another admin (if provided and not empty)
  if (adminId !== undefined && adminId !== null && adminId !== '') {
    const existingAdminWithId = await Admin.findOne({ adminId, _id: { $ne: req.params.id } });
    if (existingAdminWithId) {
      return next(new ErrorHandler('Invalid: Admin ID already exists', 400));
    }
  }
  
  // Update fields if provided
  if (name) admin.name = name;
  if (email) admin.email = email;
  if (privilege) admin.privilege = privilege;
  if (adminId !== undefined) admin.adminId = adminId || undefined; // Allow clearing adminId by setting to empty string
  
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

// Add a new course
exports.addCourse = catchAsyncError(async (req, res, next) => {
  const { courseCode, courseName, credits, department, prerequisite, semester, instructors, instructorSections } = req.body;

  // Validate required fields
  if (!courseCode || !courseName || !credits || !department || !semester) {
    return next(new ErrorHandler('Missing required fields', 400));
  }

  // Check if course code already exists
  const existingCourse = await Course.findOne({ courseCode: courseCode.toUpperCase() });
  if (existingCourse) {
    return next(new ErrorHandler('Course code already exists', 400));
  }

  // Normalize instructors
  const normalizedInstructors = Array.isArray(instructors)
    ? instructors.filter(Boolean).map((id) => id.toString().trim())
    : [];

  // Normalize instructorSections mapping
  let normalizedInstructorSections = [];
  if (Array.isArray(instructorSections)) {
    normalizedInstructorSections = instructorSections
      .filter((item) => item && item.instructorId)
      .map((item) => ({
        instructorId: item.instructorId.toString().trim(),
        sections: Array.isArray(item.sections)
          ? item.sections.filter(Boolean).map((s) => s.toString().trim())
          : [],
      }));
  }

  // Create new course
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

// Get all courses with optional search and filter
exports.getCourses = catchAsyncError(async (req, res, next) => {
  const { search, department, status } = req.query;

  // Build query
  const query = {};

  // Search by course code or name
  if (search) {
    query.$or = [
      { courseCode: { $regex: search, $options: 'i' } },
      { courseName: { $regex: search, $options: 'i' } },
    ];
  }

  // Filter by department
  if (department && department !== 'All Departments') {
    query.department = department;
  }

  // Filter by status
  if (status) {
    query.status = status;
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
  }));

  res.status(200).json({
    success: true,
    message: 'Courses fetched successfully',
    data: courseData,
  });
});

// Get single course by ID
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

// Update course
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
    course.instructorSections = instructorSections
      .filter((item) => item && item.instructorId)
      .map((item) => ({
        instructorId: item.instructorId.toString().trim(),
        sections: Array.isArray(item.sections)
          ? item.sections.filter(Boolean).map((s) => s.toString().trim())
          : [],
      }));
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

  await course.save();

  res.status(200).json({
    success: true,
    message: 'Course updated successfully'
  });
});
 
// Delete course
exports.deleteCourse = catchAsyncError(async (req, res, next) => {
  if (!req.params.id) {
    return next(new ErrorHandler('Course ID is required', 400));
  }

  const course = await Course.findById(req.params.id);
  if (!course) {
    return next(new ErrorHandler('Course not found', 404));
  }

  // Check if course has enrolled students
  if (course.enrolledStudents && course.enrolledStudents.length > 0) {
    return next(new ErrorHandler('Cannot delete course with enrolled students', 400));
  }

  await course.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Course deleted successfully',
  });
});

// Section Management
exports.createSection = catchAsyncError(async (req, res, next) => {
  const {
    sectionName, semester, shift, assignedAdvisor, totalCapacity, enrolledStudents, crName, crContact, acrName, acrContact, status,
  } = req.body;

  const requiredFields = [
    sectionName, semester, shift, assignedAdvisor, totalCapacity, crName, crContact, acrName, acrContact,
  ];

  if (requiredFields.some((value) => value === undefined || value === null || value === '')) {
    return next(new ErrorHandler('Missing required section fields', 400));
  }

  const formattedSectionName = sectionName.trim().toUpperCase();
  const capacityValue = Number(totalCapacity);

  if (Number.isNaN(capacityValue) || capacityValue < 1 || capacityValue > 50) {
    return next(new ErrorHandler('Invalid total capacity (1-50)', 400));
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

  res.status(200).json({
    success: true,
    message: 'Section fetched successfully',
    data: {
      id: section._id,
      sectionName: section.sectionName,
      semester: section.semester,
      shift: section.shift,
      assignedAdvisor: section.assignedAdvisor,
      totalCapacity: section.totalCapacity,
      enrolledStudents: section.enrolledStudents,
      availableSeats: section.availableSeats,
      crName: section.crName,
      crContact: section.crContact,
      acrName: section.acrName,
      acrContact: section.acrContact,
      status: section.status,
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
    totalCapacity,
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
    totalCapacity,
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

  if (totalCapacity !== undefined) {
    const capacityValue = Number(totalCapacity);
    if (Number.isNaN(capacityValue) || capacityValue < 1 || capacityValue > 50) {
      return next(new ErrorHandler('Invalid total capacity (1-50)', 400));
    }
    if (section.enrolledStudents > capacityValue) {
      return next(new ErrorHandler('Enrolled students exceed new capacity', 400));
    }
    section.totalCapacity = capacityValue;
  }

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

// User Management
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

// Get all advisors (teachers with privilege='Advisor')
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

  // Validate privilege if provided
  if (req.body.privilege !== undefined) {
    const allowedPrivileges = ['Teacher', 'Advisor'];
    if (!allowedPrivileges.includes(req.body.privilege)) {
      return next(new ErrorHandler('Invalid: privilege must be either "Teacher" or "Advisor"', 400));
    }
    teacher.privilege = req.body.privilege;
  }

  // Apply other updates (excluding privilege as it's already handled above)
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

// CSV Upload for Student Creation (Super Admin and Admin)
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
  // Track sections touched by this CSV so we can auto-manage section records
  const sectionStats = {};

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        results.push(row);
      })
      .on('end', async () => {
        try {
          // Process each row
          for (const row of results) {
            try {
              // Extract data from CSV row
              // CSV format: SL, Session, Department, Semester, Section, Student Id, Student Name, Email, Password
              // Handle column names with spaces - csv-parser preserves them as-is
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

              // Validate required fields
              if (!studentName || !studentId || !email || !password) {
                errors.push({
                  row: row,
                  error: 'Missing required fields (Student Name, Student Id, Email, or Password)'
                });
                continue;
              }

              // Validate email format
              if (!validator.isEmail(email)) {
                errors.push({
                  row: row,
                  error: `Invalid email format: ${email}`
                });
                continue;
              }

              // Check if student already exists (by studentId or email)
              const existingStudentById = await Student.findOne({ studentId });
              const existingStudentByEmail = await Student.findOne({ email });
              
              if (existingStudentById || existingStudentByEmail) {
                // Update existing student's section if provided
                const existingStudent = existingStudentById || existingStudentByEmail;
                if (section) {
                  existingStudent.section = section;
                  await existingStudent.save();
                  skipped.push({
                    studentId: studentId,
                    email: email,
                    reason: 'Student already exists - section updated'
                  });
                  // Count this student towards the section
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

              // Create student
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

              // Track section enrollment for dynamic section management
              if (section) {
                if (!sectionStats[section]) {
                  sectionStats[section] = {
                    semester: semester || undefined,
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

          // After processing students, ensure sections exist and enrollment is updated
          const sectionNames = Object.keys(sectionStats);
          for (const sectionName of sectionNames) {
            try {
              const stats = sectionStats[sectionName];
              // Re-count from database to ensure accuracy
              const enrolledCount = await Student.countDocuments({
                section: sectionName,
              });

              let sectionDoc = await Section.findOne({ sectionName });
              if (!sectionDoc) {
                // Create a new section with minimal/default data.
                // Other options (advisor, CR/ACR, etc.) can be edited later in the UI.
                sectionDoc = await Section.create({
                  sectionName,
                  semester: stats.semester || 'Unknown',
                  shift: 'Unknown',
                  assignedAdvisor: 'TBD',
                  totalCapacity: enrolledCount || 1,
                  enrolledStudents: enrolledCount,
                  crName: 'TBD',
                  crContact: 'TBD',
                  acrName: 'TBD',
                  acrContact: 'TBD',
                  status: 'active',
                });
              } else {
                // Update existing section's enrolledStudents and ensure capacity
                sectionDoc.enrolledStudents = enrolledCount;
                if (
                  typeof sectionDoc.totalCapacity !== 'number' ||
                  sectionDoc.totalCapacity < enrolledCount
                ) {
                  sectionDoc.totalCapacity = enrolledCount || 1;
                }
                await sectionDoc.save();
              }
            } catch (sectionError) {
              // Don't fail the whole CSV because of a single section issue
              errors.push({
                sectionName,
                error:
                  sectionError.message ||
                  'Error while syncing section after CSV upload',
              });
            }
          }

          // Clean up uploaded file
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
          // Clean up uploaded file on error
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          reject(error);
        }
      })
      .on('error', (error) => {
        // Clean up uploaded file on error
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        reject(error);
      });
  });
});

// CSV Upload for Admin Creation (Super Admin only)
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
          // Process each row
          for (const row of results) {
            try {
              // Extract data from CSV row
              // CSV format: SL, Department, Admin Id, Admin Name, Email, Password
              // Handle column names with spaces - csv-parser preserves them as-is
              // Also handle variations (with/without spaces, different cases)
              const adminId = row['Admin Id'] || row['AdminId'] || row['admin id'] || row['adminid'] || '';
              const adminName = row['Admin Name'] || row['AdminName'] || row['admin name'] || row['adminname'] || '';
              const email = (row['Email'] || row['email'] || '').trim();
              const password = (row['Password'] || row['password'] || '').trim();
              const department = row['Department'] || row['department'] || '';

              // Validate required fields
              if (!adminName || !email || !password) {
                errors.push({
                  row: row,
                  error: 'Missing required fields (Admin Name, Email, or Password)'
                });
                continue;
              }

              // Validate email format
              if (!validator.isEmail(email)) {
                errors.push({
                  row: row,
                  error: `Invalid email format: ${email}`
                });
                continue;
              }

              // Check if admin already exists
              const existingAdmin = await Admin.findOne({ email });
              if (existingAdmin) {
                skipped.push({
                  email: email,
                  reason: 'Admin with this email already exists'
                });
                continue;
              }

              // Create admin with 'Admin' privilege
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

          // Clean up uploaded file
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
          // Clean up uploaded file on error
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          reject(error);
        }
      })
      .on('error', (error) => {
        // Clean up uploaded file on error
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        reject(error);
      });
  });
});

// CSV Upload for Teacher Creation (Super Admin only)
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
          // Process each row
          for (const row of results) {
            try {
              // Extract data from CSV row
              // CSV format: SL, Department, Teacher Id, Teacher Name, Designation, Email, Contact, Password
              // Handle column names with spaces - csv-parser preserves them as-is
              // Also handle variations (with/without spaces, different cases)
              const teacherId = (row['Teacher Id'] || row['TeacherId'] || row['teacher id'] || row['teacherid'] || '').trim();
              const teacherName = (row['Teacher Name'] || row['TeacherName'] || row['teacher name'] || row['teachername'] || '').trim();
              const email = (row['Email'] || row['email'] || '').trim();
              const password = (row['Password'] || row['password'] || '').trim();
              const department = (row['Department'] || row['department'] || '').trim();
              const designation = (row['Designation'] || row['designation'] || '').trim();
              const contact = (row['Contact'] || row['contact'] || '').trim();

              // Validate required fields
              if (!teacherName || !email || !password) {
                errors.push({
                  row: row,
                  error: 'Missing required fields (Teacher Name, Email, or Password)'
                });
                continue;
              }

              // Validate email format
              if (!validator.isEmail(email)) {
                errors.push({
                  row: row,
                  error: `Invalid email format: ${email}`
                });
                continue;
              }

              // Check if teacher already exists (by teacherId or email)
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

              // Create teacher
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

          // Clean up uploaded file
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
          // Clean up uploaded file on error
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          reject(error);
        }
      })
      .on('error', (error) => {
        // Clean up uploaded file on error
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        reject(error);
      });
  });
});