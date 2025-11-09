const router = require('express').Router();
const studentController = require('../controllers/studentController');
const auth = require('../middleware/Auth');

// get all student details
router.route('/')
  .get(studentController.getAllStudentDetails);
  
// register student
router.route('/register')
  .post(studentController.registerStudent);

// get single student details
router.route('/:id')
  .get(studentController.getSingleStudentDetails);

module.exports = router;