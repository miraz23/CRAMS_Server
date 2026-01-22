const mongoose = require('mongoose');
const AdvisorAppointment = require('../models/advisorAppointmentModel');
const Student = require('../models/studentModel');
const Teacher = require('../models/teacherModel');
const Section = require('../models/sectionModel');
const ErrorHandler = require('../utils/ErrorHandler');
const catchAsyncError = require('../middleware/CatchAsyncErrors');

exports.getMyAdvisor = catchAsyncError(async (req, res, next) => {
  const studentId = req.student._id;

  if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
    return next(new ErrorHandler('Invalid student ID', 400));
  }

  const student = await Student.findById(studentId).select('section');
  if (!student) {
    return next(new ErrorHandler('Student not found', 404));
  }

  if (!student.section) {
    return next(new ErrorHandler('Student section not found', 404));
  }

  const normalizedSectionName = student.section ? student.section.trim().toUpperCase() : null;

  let section = await Section.findOne({
    sectionName: normalizedSectionName,
    status: 'active',
  });

  if (!section) {
    section = await Section.findOne({
      sectionName: { $regex: new RegExp(`^${normalizedSectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      status: 'active',
    });
  }

  if (!section) {
    return next(new ErrorHandler(`Section "${normalizedSectionName}" not found or inactive`, 404));
  }

  if (!section.assignedAdvisor || section.assignedAdvisor.trim() === '' || section.assignedAdvisor === 'TBD') {
    return next(new ErrorHandler('Advisor not assigned to your section', 404));
  }

  const advisorTeacherId = section.assignedAdvisor.trim();

  let advisor = await Teacher.findOne({
    teacherId: advisorTeacherId,
  }).select('teacherId name email mobileNumber');

  if (!advisor) {
    advisor = await Teacher.findOne({
      teacherId: { $regex: new RegExp(`^${advisorTeacherId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    }).select('teacherId name email mobileNumber');
  }

  if (!advisor) {
    return next(new ErrorHandler(`Advisor not found for teacherId: ${advisorTeacherId}`, 404));
  }

  res.status(200).json({
    success: true,
    message: 'Advisor information fetched successfully',
    data: {
      advisor: {
        teacherId: advisor.teacherId,
        name: advisor.name,
        email: advisor.email,
        mobileNumber: advisor.mobileNumber || '',
      },
      section: {
        sectionName: section.sectionName,
        semester: section.semester,
      },
    },
  });
});

exports.bookAppointment = catchAsyncError(async (req, res, next) => {
  const { appointmentDate, appointmentTime, reason } = req.body;
  const studentId = req.student._id;

  if (!appointmentDate) {
    return next(new ErrorHandler('Appointment date is required', 400));
  }

  if (!appointmentTime) {
    return next(new ErrorHandler('Appointment time is required', 400));
  }

  if (!reason || reason.trim().length === 0) {
    return next(new ErrorHandler('Reason is required', 400));
  }

  if (reason.length > 500) {
    return next(new ErrorHandler('Reason cannot exceed 500 characters', 400));
  }

  const student = await Student.findById(studentId).select('section');
  if (!student || !student.section) {
    return next(new ErrorHandler('Student section not found', 404));
  }

  const normalizedSectionName = student.section ? student.section.trim().toUpperCase() : null;
  const section = await Section.findOne({
    $or: [
      { sectionName: normalizedSectionName },
      { sectionName: { $regex: new RegExp(`^${normalizedSectionName}$`, 'i') } }
    ],
    status: 'active',
  });

  if (!section || !section.assignedAdvisor || section.assignedAdvisor.trim() === '' || section.assignedAdvisor === 'TBD') {
    return next(new ErrorHandler('Advisor not assigned to your section', 404));
  }

  const advisor = await Teacher.findOne({
    teacherId: section.assignedAdvisor.trim(),
  });

  if (!advisor) {
    return next(new ErrorHandler('Advisor not found', 404));
  }

  const existingAppointment = await AdvisorAppointment.findOne({
    advisor: advisor._id,
    appointmentDate: new Date(appointmentDate),
    appointmentTime: appointmentTime.trim(),
    status: { $in: ['pending', 'approved'] },
  });

  if (existingAppointment) {
    return next(new ErrorHandler('This appointment slot is already booked', 400));
  }

  const appointment = await AdvisorAppointment.create({
    student: studentId,
    advisor: advisor._id,
    appointmentDate: new Date(appointmentDate),
    appointmentTime: appointmentTime.trim(),
    reason: reason.trim(),
    status: 'pending',
  });

  await appointment.populate('student', 'studentId name email');
  await appointment.populate('advisor', 'teacherId name email');

  res.status(201).json({
    success: true,
    message: 'Appointment booked successfully',
    data: appointment,
  });
});

exports.getMyAppointments = catchAsyncError(async (req, res, next) => {
  const studentId = req.student._id;

  const appointments = await AdvisorAppointment.find({
    student: studentId,
  })
    .populate({
      path: 'advisor',
      select: 'teacherId name email',
      options: { lean: true }
    })
    .sort({ appointmentDate: -1, appointmentTime: -1 })
    .lean();

  const validAppointments = appointments.filter(apt => apt.advisor !== null);

  res.status(200).json({
    success: true,
    message: 'Appointments fetched successfully',
    data: validAppointments,
  });
});

exports.getAdvisorAppointments = catchAsyncError(async (req, res, next) => {
  const teacherId = req.teacher._id;

  const appointments = await AdvisorAppointment.find({
    advisor: teacherId,
  })
    .populate('student', 'studentId name email section')
    .sort({ appointmentDate: -1, appointmentTime: -1 });

  res.status(200).json({
    success: true,
    message: 'Appointments fetched successfully',
    data: appointments,
  });
});

exports.approveAppointment = catchAsyncError(async (req, res, next) => {
  const { appointmentId } = req.params;
  const teacherId = req.teacher._id;

  const appointment = await AdvisorAppointment.findById(appointmentId);

  if (!appointment) {
    return next(new ErrorHandler('Appointment not found', 404));
  }

  if (appointment.advisor.toString() !== teacherId.toString()) {
    return next(new ErrorHandler('You are not authorized to approve this appointment', 403));
  }

  if (appointment.status !== 'pending') {
    return next(new ErrorHandler('Appointment has already been reviewed', 400));
  }

  appointment.status = 'approved';
  appointment.reviewedAt = new Date();
  await appointment.save();

  await appointment.populate('student', 'studentId name email');
  await appointment.populate('advisor', 'teacherId name email');

  res.status(200).json({
    success: true,
    message: 'Appointment approved successfully',
    data: appointment,
  });
});

exports.rejectAppointment = catchAsyncError(async (req, res, next) => {
  const { appointmentId } = req.params;
  const { advisorFeedback } = req.body;
  const teacherId = req.teacher._id;

  const appointment = await AdvisorAppointment.findById(appointmentId);

  if (!appointment) {
    return next(new ErrorHandler('Appointment not found', 404));
  }

  if (appointment.advisor.toString() !== teacherId.toString()) {
    return next(new ErrorHandler('You are not authorized to reject this appointment', 403));
  }

  if (appointment.status !== 'pending') {
    return next(new ErrorHandler('Appointment has already been reviewed', 400));
  }

  appointment.status = 'rejected';
  appointment.reviewedAt = new Date();
  if (advisorFeedback) {
    appointment.advisorFeedback = advisorFeedback.trim().substring(0, 500);
  }
  await appointment.save();

  await appointment.populate('student', 'studentId name email');
  await appointment.populate('advisor', 'teacherId name email');

  res.status(200).json({
    success: true,
    message: 'Appointment rejected successfully',
    data: appointment,
  });
});
