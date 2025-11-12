const mongoose = require('mongoose')
const validator = require('validator')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const teacherSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a name'],
        maxlength: [30, 'Name cannot exceed 30 characters'],
        minLength: [4, 'Name must be atleast 4 characters long'],
    },
    teacherId: {
        type: String,
        required: [true, 'Please provide teacher ID'],
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
        required: [true, 'Please provide mobile number'],
    },
    department: {
        type: String,
        required: [true, 'Please provide department'],
    },
    designation: {
        type: String,
        required: [true, 'Please provide designation'],
    },
    dateOfBirth: {
        type: Date,
        required: [true, 'Please provide date of birth'],
    },
    gender: {
        type: String,
        required: [true, 'Please provide gender'],
        enum: ['Male', 'Female', 'Other'],
    },
    address: {
        type: String,
        required: [true, 'Please provide your current address'],
    },
    teacherImage: {
        type: String,
        default: '',
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minLength: [8, 'Password must be atleast 8 characters long'],
        select: false
    }
})

teacherSchema.pre('save', async function (next){
    if(!this.isModified('password')){
        return next()
    }
    this.password = await bcrypt.hash(this.password, 10)
})

teacherSchema.methods.getJwtToken = function () {
    return jwt.sign({ id: this._id}, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE
    })
}

// Compares the provided password with the hashed password stored in the database
teacherSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password)
}

module.exports = mongoose.model('Teacher', teacherSchema)