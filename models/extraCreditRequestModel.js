const mongoose = require('mongoose');

const extraCreditRequestSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Please provide a student'],
  },
  semester: {
    type: String,
    required: [true, 'Please provide semester'],
    trim: true,
  },
  requestedCredits: {
    type: Number,
    required: [true, 'Please provide requested credits'],
    min: [1, 'Requested credits must be at least 1'],
  },
  reason: {
    type: String,
    required: [true, 'Please provide a reason for extra credits'],
    trim: true,
    maxlength: [500, 'Reason cannot exceed 500 characters'],
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
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
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
  },
}, {
  timestamps: true,
});

extraCreditRequestSchema.index({ student: 1, semester: 1, status: 1 }, { 
  unique: true,
  partialFilterExpression: { status: 'pending' }
});

module.exports = mongoose.model('ExtraCreditRequest', extraCreditRequestSchema);
