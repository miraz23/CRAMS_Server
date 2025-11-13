const router = require('express').Router();
const teacherController = require('../controllers/teacherController');

// get all teacher details
router.route('/')
  .get(teacherController.getAllTeacherDetails);

// register teacher
router.route('/register')
    .post(teacherController.registerTeacher);

// teacher login
router.route('/login')
  .post(teacherController.loginTeacher);

// teacher logout
router.route('/logout')
  .post(teacherController.logoutTeacher);

router.route('/:id')
  .get(teacherController.getSingleTeacherDetails)

module.exports = router;