const router = require('express').Router();
const teacherController = require('../controllers/teacherController');
const auth = require('../middleware/Auth');

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
  .put(teacherController.updateTeacher)
  .delete(teacherController.deleteTeacher);

// advisor dashboard overview
router.route('/advisor/dashboard')
  .get(auth.checkTeacherAuthentication, teacherController.getAdvisorDashboard);

// advisor pending reviews
router.route('/advisor/pending-reviews')
  .get(auth.checkTeacherAuthentication, teacherController.getPendingReviews);

module.exports = router;