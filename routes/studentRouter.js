const router = require('express').Router();
const studentController = require('../controllers/studentController');
const auth = require('../middleware/Auth');

// register student
router.route('/register')
  .post(studentController.registerStudent);

module.exports = router;