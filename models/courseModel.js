const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  courseCode: {
    type: String,
    required: [true, 'Please provide a course code'],
    unique: true,
    trim: true,
    uppercase: true,
  },
  courseName: {
    type: String,
    required: [true, 'Please provide a course name'],
    trim: true,
  },
  credits: {
    type: Number,
    required: [true, 'Please provide credits'],
    min: [0.75, 'Credits must be at least 0.75'],
    max: [4, 'Credits cannot exceed 4'],
  },
  department: {
    type: String,
    required: [true, 'Please provide department'],
    trim: true,
  },
  prerequisite: {
    type: String,
    trim: true,
    default: '',
  },
  instructor: {
    type: String,
    trim: true,
    default: '',
  },
  // Multiple instructors can be assigned to a course
  instructors: [{
    type: String,
    trim: true,
  }],
  // Track which sections each instructor is responsible for
  instructorSections: [{
    instructorId: { type: String, trim: true },
    sections: [{ type: String, trim: true }],
  }],
  schedule: {
    // New structure: per-day schedules
    daySchedules: [{
      day: {
        type: String,
        enum: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        required: true,
      },
      startTime: {
        type: String,
        trim: true,
        default: '',
      },
      endTime: {
        type: String,
        trim: true,
        default: '',
      },
    }],
    // Legacy fields for backward compatibility
    days: [{
      type: String,
      enum: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    }],
    startTime: {
      type: String,
      trim: true,
    },
    endTime: {
      type: String,
      trim: true,
    },
  },
  regularSeats: {
    type: Number,
    min: [0, 'Regular seats cannot be negative'],
    default: 0,
  },
  irregularSeats: {
    type: Number,
    min: [0, 'Irregular seats cannot be negative'],
    default: 0,
  },
  availableSeats: {
    type: Number,
    default: 0,
    min: [0, 'Available seats cannot be negative'],
  },
  semester: {
    type: String,
    required: [true, 'Please provide semester'],
    trim: true,
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
  enrolledStudents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
  }],
}, {
  timestamps: true,
});

// Seat counts are optional; keep availableSeats stable even if not used.
courseSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('regularSeats') || this.isModified('irregularSeats') || this.isModified('enrolledStudents')) {
    const totalSeats = (this.regularSeats || 0) + (this.irregularSeats || 0);
    const enrolledCount = this.enrolledStudents ? this.enrolledStudents.length : 0;
    this.availableSeats = Math.max(0, totalSeats - enrolledCount);
  }
  next();
});

module.exports = mongoose.model('Course', courseSchema);

