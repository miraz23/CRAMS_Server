const mongoose = require('mongoose');

const advisorAppointmentSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Please provide a student'],
  },
  advisor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: [true, 'Please provide an advisor'],
  },
  appointmentDate: {
    type: Date,
    required: [true, 'Please provide appointment date'],
  },
  appointmentTime: {
    type: String,
    required: [true, 'Please provide appointment time'],
    trim: true,
  },
  reason: {
    type: String,
    required: [true, 'Please provide a reason for the appointment'],
    trim: true,
    maxlength: [500, 'Reason cannot exceed 500 characters'],
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed', 'cancelled'],
    default: 'pending',
  },
  advisorFeedback: {
    type: String,
    trim: true,
    default: '',
    maxlength: [500, 'Advisor feedback cannot exceed 500 characters'],
  },
  reviewedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

advisorAppointmentSchema.index({ advisor: 1, appointmentDate: 1, appointmentTime: 1 }, { 
  unique: true 
});

module.exports = mongoose.model('AdvisorAppointment', advisorAppointmentSchema);
