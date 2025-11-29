const router = require('express').Router();
const studentController = require('../controllers/studentController');
const courseRegistrationController = require('../controllers/courseRegistrationController');
const auth = require('../middleware/Auth');

// get all student details
router.route('/')
  .get(studentController.getAllStudentDetails);
  
// register student
router.route('/register')
  .post(studentController.registerStudent);

// student login
router.route('/login')
  .post(studentController.loginStudent);

// student logout
router.route('/logout')
  .post(studentController.logoutStudent);

// get single student details
router.route('/:id')
  .get(studentController.getSingleStudentDetails)
  .post(studentController.updateStudent)
  .delete(studentController.deleteStudent);

// update and delete student
router.route('/:id')
  .put(studentController.updateStudent)
  .delete(studentController.deleteStudent);

// Course Registration Routes (Protected)
// Get available courses
router.route('/courses/available')
  .get(auth.checkStudentAuthentication, courseRegistrationController.getAvailableCourses);

// Get selected courses
router.route('/courses/selected')
  .get(auth.checkStudentAuthentication, courseRegistrationController.getSelectedCourses);

// Add course to selection
router.route('/courses/add')
  .post(auth.checkStudentAuthentication, courseRegistrationController.addCourseToSelection);

// Remove course from selection
router.route('/courses/remove/:courseId')
  .delete(auth.checkStudentAuthentication, courseRegistrationController.removeCourseFromSelection);

// Submit courses for approval
router.route('/courses/submit')
  .post(auth.checkStudentAuthentication, courseRegistrationController.submitForApproval);

// Get registration status
router.route('/courses/status')
  .get(auth.checkStudentAuthentication, courseRegistrationController.getRegistrationStatus);

module.exports = router;

