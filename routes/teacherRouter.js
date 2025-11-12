const router = require('express').Router();
const teacherController = require('../controllers/teacherController');

// get all teacher details
router.route('/')
  .get(teacherController.getAllTeacherDetails);

// register teacher
router.route('/register')
    .post(teacherController.registerTeacher);

module.exports = router;