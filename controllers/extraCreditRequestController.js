const mongoose = require('mongoose');
const ExtraCreditRequest = require('../models/extraCreditRequestModel');
const Student = require('../models/studentModel');
const Teacher = require('../models/teacherModel');
const Section = require('../models/sectionModel');
const CourseRegistration = require('../models/courseRegistrationModel');
const ErrorHandler = require('../utils/ErrorHandler');
const catchAsyncError = require('../middleware/CatchAsyncErrors');

// Student: Create extra credit request
exports.createExtraCreditRequest = catchAsyncError(async (req, res, next) => {
  const { semester, requestedCredits, reason } = req.body;
  const studentId = req.student._id;

  if (!semester) {
    return next(new ErrorHandler('Semester is required', 400));
  }

  if (!requestedCredits || requestedCredits < 1) {
    return next(new ErrorHandler('Requested credits must be at least 1', 400));
  }

  if (!reason || reason.trim().length === 0) {
    return next(new ErrorHandler('Reason is required', 400));
  }

  if (reason.length > 500) {
    return next(new ErrorHandler('Reason cannot exceed 500 characters', 400));
  }

  // Check if there's already a pending request for this semester
  const existingPendingRequest = await ExtraCreditRequest.findOne({
    student: studentId,
    semester: semester,
    status: 'pending',
  });

  if (existingPendingRequest) {
    return next(new ErrorHandler(
      'You already have a pending extra credit request for this semester. Please wait for advisor approval.',
      400
    ));
  }

  // Create the request
  const extraCreditRequest = await ExtraCreditRequest.create({
    student: studentId,
    semester: semester,
    requestedCredits: requestedCredits,
    reason: reason.trim(),
    status: 'pending',
  });

  await extraCreditRequest.populate('student', 'studentId name email');

  res.status(201).json({
    success: true,
    message: 'Extra credit request created successfully',
    data: extraCreditRequest,
  });
});

// Student: Get my extra credit requests
exports.getMyExtraCreditRequests = catchAsyncError(async (req, res, next) => {
  const studentId = req.student._id;
  const { semester } = req.query;

  const query = { student: studentId };
  if (semester) {
    query.semester = semester;
  }

  const requests = await ExtraCreditRequest.find(query)
    .populate('reviewedBy', 'teacherId name')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    message: 'Extra credit requests fetched successfully',
    data: requests,
  });
});

// Advisor: Get pending extra credit requests for my students
exports.getPendingExtraCreditRequests = catchAsyncError(async (req, res, next) => {
  const teacherId = req.teacher.teacherId;
  const CREDIT_LIMIT = 26;

  // Find all sections assigned to this advisor
  const sections = await Section.find({
    assignedAdvisor: teacherId,
    status: 'active',
  });

  if (sections.length === 0) {
    return res.status(200).json({
      success: true,
      message: 'Pending extra credit requests fetched successfully',
      data: [],
    });
  }

  // Get section names assigned to this advisor
  const sectionNames = sections
    .map((s) => (s.sectionName ? s.sectionName.trim().toUpperCase() : null))
    .filter(Boolean);

  // Get all students registered in advisor's sections
  const students = await Student.find({
    section: { $in: sectionNames },
  });

  if (students.length === 0) {
    return res.status(200).json({
      success: true,
      message: 'Pending extra credit requests fetched successfully',
      data: [],
    });
  }

  const studentIds = students.map((s) => s._id);

  // Get pending extra credit requests for these students
  const requests = await ExtraCreditRequest.find({
    student: { $in: studentIds },
    status: 'pending',
  })
    .populate('student', 'studentId name email section')
    .sort({ createdAt: -1 });

  if (requests.length === 0) {
    return res.status(200).json({
      success: true,
      message: 'Pending extra credit requests fetched successfully',
      data: [],
    });
  }

  // Pre-compute credit summaries (approved vs selected) per student+semester
  const studentObjectIds = [];
  const semesters = new Set();

  requests.forEach((reqDoc) => {
    if (reqDoc.student && reqDoc.student._id) {
      studentObjectIds.push(reqDoc.student._id);
    } else if (reqDoc.student) {
      studentObjectIds.push(reqDoc.student);
    }
    if (reqDoc.semester) {
      semesters.add(reqDoc.semester);
    }
  });

  const uniqueStudentIds = [...new Set(studentObjectIds.map((id) => id.toString()))];
  const uniqueSemesters = [...semesters];

  const creditSummariesByKey = new Map();

  if (uniqueStudentIds.length > 0 && uniqueSemesters.length > 0) {
    const registrations = await CourseRegistration.find({
      student: { $in: uniqueStudentIds },
      semester: { $in: uniqueSemesters },
      status: { $in: ['approved', 'selected', 'pending'] },
    }).populate('course');

    registrations.forEach((reg) => {
      const studentIdStr = reg.student.toString();
      const key = `${studentIdStr}_${reg.semester}`;
      const current = creditSummariesByKey.get(key) || {
        approvedCredits: 0,
        selectedCredits: 0,
      };

      const credits = reg.course && reg.course.credits ? reg.course.credits : 0;

      if (reg.status === 'approved') {
        current.approvedCredits += credits;
      }

      if (reg.status === 'selected' || reg.status === 'pending') {
        current.selectedCredits += credits;
      }

      creditSummariesByKey.set(key, current);
    });
  }

  const requestsWithCredits = requests.map((reqDoc) => {
    const plain = reqDoc.toObject({ getters: true, virtuals: false });
    const studentIdStr =
      plain.student && plain.student._id
        ? plain.student._id.toString()
        : plain.student
        ? plain.student.toString()
        : '';
    const key = `${studentIdStr}_${plain.semester}`;
    const summary = creditSummariesByKey.get(key) || {
      approvedCredits: 0,
      selectedCredits: 0,
    };

    return {
      ...plain,
      approvedCredits: summary.approvedCredits,
      selectedCredits: summary.selectedCredits,
      maxCredits: CREDIT_LIMIT,
    };
  });

  res.status(200).json({
    success: true,
    message: 'Pending extra credit requests fetched successfully',
    data: requestsWithCredits,
  });
});

// Advisor: Approve extra credit request
exports.approveExtraCreditRequest = catchAsyncError(async (req, res, next) => {
  const { requestId } = req.params;
  const { advisorFeedback } = req.body;
  const teacherId = req.teacher._id;

  if (!requestId) {
    return next(new ErrorHandler('Request ID is required', 400));
  }

  const request = await ExtraCreditRequest.findById(requestId).populate('student');

  if (!request) {
    return next(new ErrorHandler('Extra credit request not found', 404));
  }

  if (request.status !== 'pending') {
    return next(new ErrorHandler('This request has already been reviewed', 400));
  }

  // Verify that the student belongs to this advisor's sections
  const sections = await Section.find({
    assignedAdvisor: req.teacher.teacherId,
    status: 'active',
  });

  const sectionNames = sections.map(s => s.sectionName ? s.sectionName.trim().toUpperCase() : null).filter(Boolean);

  if (!request.student || !request.student.section) {
    return next(new ErrorHandler('Student section not found', 404));
  }

  const studentSection = request.student.section.toUpperCase();
  if (!sectionNames.includes(studentSection)) {
    return next(new ErrorHandler('You are not authorized to review this request', 403));
  }

  // Update request
  request.status = 'approved';
  request.reviewedAt = new Date();
  request.reviewedBy = teacherId;
  if (advisorFeedback) {
    request.advisorFeedback = advisorFeedback.trim().substring(0, 500);
  }
  await request.save();

  await request.populate('student', 'studentId name email');
  await request.populate('reviewedBy', 'teacherId name');

  res.status(200).json({
    success: true,
    message: 'Extra credit request approved successfully',
    data: request,
  });
});

// Advisor: Reject extra credit request
exports.rejectExtraCreditRequest = catchAsyncError(async (req, res, next) => {
  const { requestId } = req.params;
  const { advisorFeedback } = req.body;
  const teacherId = req.teacher._id;

  if (!requestId) {
    return next(new ErrorHandler('Request ID is required', 400));
  }

  if (!advisorFeedback || advisorFeedback.trim().length === 0) {
    return next(new ErrorHandler('Advisor feedback is required for rejection', 400));
  }

  const request = await ExtraCreditRequest.findById(requestId).populate('student');

  if (!request) {
    return next(new ErrorHandler('Extra credit request not found', 404));
  }

  if (request.status !== 'pending') {
    return next(new ErrorHandler('This request has already been reviewed', 400));
  }

  // Verify that the student belongs to this advisor's sections
  const sections = await Section.find({
    assignedAdvisor: req.teacher.teacherId,
    status: 'active',
  });

  const sectionNames = sections.map(s => s.sectionName ? s.sectionName.trim().toUpperCase() : null).filter(Boolean);

  if (!request.student || !request.student.section) {
    return next(new ErrorHandler('Student section not found', 404));
  }

  const studentSection = request.student.section.toUpperCase();
  if (!sectionNames.includes(studentSection)) {
    return next(new ErrorHandler('You are not authorized to review this request', 403));
  }

  // Update request
  request.status = 'rejected';
  request.reviewedAt = new Date();
  request.reviewedBy = teacherId;
  request.advisorFeedback = advisorFeedback.trim().substring(0, 500);
  await request.save();

  await request.populate('student', 'studentId name email');
  await request.populate('reviewedBy', 'teacherId name');

  res.status(200).json({
    success: true,
    message: 'Extra credit request rejected successfully',
    data: request,
  });
});
