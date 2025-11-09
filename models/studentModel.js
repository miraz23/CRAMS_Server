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
        required: [true, 'Please provide mobile number'],
    },
    department: {
        type: String,
        required: [true, 'Please provide department'],
    },
    fatherName: {
        type: String,
        required: [true, 'Please provide father name'],
    },
    motherName: {
        type: String,
        required: [true, 'Please provide mother name'],
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
    religion: {
        type: String,
        required: [true, 'Please provide religion'],
    },
    nationality: {
        type: String,
        required: [true, 'Please provide nationality'],
    },
    presentAddress: {
        type: String,
        required: [true, 'Please provide present address'],
    },
    permanentAddress: {
        type: String,
        required: [true, 'Please provide permanent address'],
    },
    sscBoardInstitute: {
        type: String,
        required: [true, 'Please provide SSC board/institute'],
    },
    sscGroup: {
        type: String,
        required: [true, 'Please provide SSC group'],
    },
    sscPassingYear: {
        type: Number,
        required: [true, 'Please provide SSC passing year'],
    },
    sscGPA: {
        type: Number,
        required: [true, 'Please provide SSC GPA'],
        min: [0, 'GPA cannot be negative'],
        max: [5, 'GPA cannot exceed 5'],
    },
    hscBoardInstitute: {
        type: String,
        required: [true, 'Please provide HSC board/institute'],
    },
    hscGroup: {
        type: String,
        required: [true, 'Please provide HSC group'],
    },
    hscPassingYear: {
        type: Number,
        required: [true, 'Please provide HSC passing year'],
    },
    hscGPA: {
        type: Number,
        required: [true, 'Please provide HSC GPA'],
        min: [0, 'GPA cannot be negative'],
        max: [5, 'GPA cannot exceed 5'],
    },
    studentImage: {
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

// Compares the provided password with the hashed password stored in the database
studentSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password)
}

module.exports = mongoose.model('Student', studentSchema)