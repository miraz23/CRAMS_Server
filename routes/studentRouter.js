const router = require('express').Router();
const studentController = require('../controllers/studentController');
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
  .put(studentController.updateStudent)
  .delete(studentController.deleteStudent);

module.exports = router;

