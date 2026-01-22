const mongoose = require('mongoose')
const validator = require('validator')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const studentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a name'],
        maxlength: [30, 'Name cannot exceed 30 characters'],
        minLength: [4, 'Name must be atleast 4 characters long'],
    },
    studentId: {
        type: String,
        required: [true, 'Please provide student ID'],
        unique: true,
    },
    email: {
        type: String,
        required: [true, 'Please provide an email'],
        unique: true,
        validate: [validator.isEmail, 'Please enter a valid email'],
    },
    mobileNumber: {
        type: String,
    },
    department: {
        type: String,
    },
    fatherName: {
        type: String,
    },
    motherName: {
        type: String,
    },
    dateOfBirth: {
        type: Date,
    },
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Other'],
    },
    religion: {
        type: String,
    },
    nationality: {
        type: String,
    },
    presentAddress: {
        type: String,
    },
    permanentAddress: {
        type: String,
    },
    sscBoardInstitute: {
        type: String,
    },
    sscGroup: {
        type: String,
    },
    sscPassingYear: {
        type: Number,
    },
    sscGPA: {
        type: Number,
        min: [0, 'GPA cannot be negative'],
        max: [5, 'GPA cannot exceed 5'],
    },
    hscBoardInstitute: {
        type: String,
    },
    hscGroup: {
        type: String,
    },
    hscPassingYear: {
        type: Number,
    },
    hscGPA: {
        type: Number,
        min: [0, 'GPA cannot be negative'],
        max: [5, 'GPA cannot exceed 5'],
    },
    studentImage: {
        type: String,
        default: '',
    },
    section: {
        type: String,
        trim: true,
        uppercase: true,
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minLength: [8, 'Password must be atleast 8 characters long'],
        select: false
    }
})

studentSchema.pre('save', async function (next){
    if(!this.isModified('password')){
        return next()
    }
    this.password = await bcrypt.hash(this.password, 10)
})

studentSchema.methods.getJwtToken = function () {
    return jwt.sign({ id: this._id}, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE
    })
}

studentSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password)
}

module.exports = mongoose.model('Student', studentSchema)
