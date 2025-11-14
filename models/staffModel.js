const mongoose = require('mongoose')
const validator = require('validator')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const staffSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a name'],
        maxlength: [30, 'Name cannot exceed 30 characters'],
        minLength: [4, 'Name must be atleast 4 characters long'],
    },
    staffId: {
        type: String,
        required: [true, 'Please provide staff ID'],
        unique: true,
    },
    designation: {
        type: String,
        required: [true, 'Please provide designation'],
    },
    department: {
        type: String,
        required: [true, 'Please provide department'],
    },
    mobileNumber: {
        type: String,
        required: [true, 'Please provide mobile number'],
    },
    email: {
        type: String,
        required: [true, 'Please provide email'],
        unique: true,
        validate: [validator.isEmail, 'Please enter a valid email'],
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
        required: [true, 'Please provide address'],
    },
    staffImage: {
        type: String,
        default: '',
    },
    privilege: {
        type: String,
        default: 'Staff'
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minLength: [8, 'Password must be atleast 8 characters long'],
        select: false
    }
})

staffSchema.pre('save', async function (next){
    if(!this.isModified('password')){
        return next()
    }
    this.password = await bcrypt.hash(this.password, 10)
})


staffSchema.methods.getJwtToken = function () {
    return jwt.sign({ id: this._id}, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE
    })
}

// Compares the provided password with the hashed password stored in the database
staffSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password)
}

module.exports = mongoose.model('Staff', staffSchema)