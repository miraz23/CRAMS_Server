const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema(
  {
    sectionName: {
      type: String,
      required: [true, 'Please provide a section name'],
      uppercase: true,
      trim: true,
      unique: true,
    },
    semester: {
      type: String,
      required: [true, 'Please provide semester information'],
      trim: true,
    },
    shift: {
      type: String,
      required: [true, 'Please provide shift information'],
      trim: true,
    },
    assignedAdvisor: {
      type: String,
      required: [true, 'Please provide an assigned advisor'],
      trim: true,
    },
    regularStudents: {
      type: Number,
      default: 0,
      min: [0, 'Regular students cannot be negative'],
    },
    maxIrregularStudents: {
      type: Number,
      default: 0,
      min: [0, 'Maximum irregular students cannot be negative'],
    },
    totalCapacity: {
      type: Number,
      required: [true, 'Please provide total section capacity'],
      min: [1, 'Section capacity must be at least 1'],
      max: [50, 'Section capacity cannot exceed 50'],
    },
    enrolledStudents: {
      type: Number,
      default: 0,
      min: [0, 'Enrolled students cannot be negative'],
    },
    availableSeats: {
      type: Number,
      min: [0, 'Available seats cannot be negative'],
      default: function () {
        const total = this.totalCapacity || 0;
        const enrolled = this.enrolledStudents || 0;
        return Math.max(total - enrolled, 0);
      },
    },
    crName: {
      type: String,
      required: [true, 'Please provide the CR name'],
      trim: true,
    },
    crContact: {
      type: String,
      required: [true, 'Please provide the CR contact'],
      trim: true,
    },
    acrName: {
      type: String,
      required: [true, 'Please provide the ACR name'],
      trim: true,
    },
    acrContact: {
      type: String,
      required: [true, 'Please provide the ACR contact'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

sectionSchema.pre('save', function (next) {
  // Set regularStudents to enrolledStudents if not explicitly set
  if (this.regularStudents === undefined || this.regularStudents === null) {
    this.regularStudents = Number(this.enrolledStudents || 0);
  }

  // Calculate totalCapacity from regularStudents + maxIrregularStudents
  const regular = Number(this.regularStudents || 0);
  const maxIrregular = Number(this.maxIrregularStudents || 0);
  this.totalCapacity = regular + maxIrregular;

  // Validate totalCapacity
  if (this.totalCapacity < 1 || this.totalCapacity > 50) {
    return next(
      new Error(
        'Total capacity must be between 1 and 50'
      )
    );
  }

  const total = Number(this.totalCapacity || 0);
  const enrolled = Number(this.enrolledStudents || 0);

  if (enrolled > total) {
    return next(
      new Error(
        'Enrolled students cannot exceed total section capacity'
      )
    );
  }

  this.availableSeats = Math.max(total - enrolled, 0);
  next();
});

module.exports = mongoose.model('Section', sectionSchema);

