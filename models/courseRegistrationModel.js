const mongoose = require('mongoose');

const courseRegistrationSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Please provide a student'],
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: [true, 'Please provide a course'],
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'selected'],
    default: 'selected',
  },
  semester: {
    type: String,
    required: [true, 'Please provide semester'],
    trim: true,
  },
  submittedForApproval: {
    type: Boolean,
    default: false,
  },
  submittedAt: {
    type: Date,
  },
  approvedAt: {
    type: Date,
  },
  rejectedAt: {
    type: Date,
  },
  rejectionReason: {
    type: String,
    trim: true,
    default: '',
  },
}, {
  timestamps: true,
});

// Ensure one registration per student per course per semester
courseRegistrationSchema.index({ student: 1, course: 1, semester: 1 }, { unique: true });

module.exports = mongoose.model('CourseRegistration', courseRegistrationSchema);

