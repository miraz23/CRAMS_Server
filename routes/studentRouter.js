const router = require('express').Router();
const studentController = require('../controllers/studentController');
const courseRegistrationController = require('../controllers/courseRegistrationController');
const extraCreditRequestController = require('../controllers/extraCreditRequestController');
const advisorAppointmentController = require('../controllers/advisorAppointmentController');
const auth = require('../middleware/Auth');

router.route('/')
  .get(studentController.getAllStudentDetails);
  
router.route('/login')
  .post(studentController.loginStudent);

router.route('/logout')
  .post(studentController.logoutStudent);

router.route('/schedule')
  .get(auth.checkStudentAuthentication, studentController.getStudentSchedule);

router.route('/routine')
  .get(auth.checkStudentAuthentication, studentController.getStudentRoutine);

router.route('/system-settings')
  .get(studentController.getSystemSettings);

router.route('/courses/available')
  .get(auth.checkStudentAuthentication, courseRegistrationController.getAvailableCourses);

router.route('/courses/selected')
  .get(auth.checkStudentAuthentication, courseRegistrationController.getSelectedCourses);

router.route('/courses/add')
  .post(auth.checkStudentAuthentication, courseRegistrationController.addCourseToSelection);

router.route('/courses/remove/:courseId')
  .delete(auth.checkStudentAuthentication, courseRegistrationController.removeCourseFromSelection);

router.route('/courses/submit')
  .post(auth.checkStudentAuthentication, courseRegistrationController.submitForApproval);

router.route('/courses/status')
  .get(auth.checkStudentAuthentication, courseRegistrationController.getRegistrationStatus);

router.route('/extra-credit-requests')
  .post(auth.checkStudentAuthentication, extraCreditRequestController.createExtraCreditRequest)
  .get(auth.checkStudentAuthentication, extraCreditRequestController.getMyExtraCreditRequests);

router.route('/advisor')
  .get(auth.checkStudentAuthentication, advisorAppointmentController.getMyAdvisor);

router.route('/appointments')
  .post(auth.checkStudentAuthentication, advisorAppointmentController.bookAppointment)
  .get(auth.checkStudentAuthentication, advisorAppointmentController.getMyAppointments);

router.route('/:id')
  .get(studentController.getSingleStudentDetails)
  .put(studentController.updateStudent)
  .delete(studentController.deleteStudent);

module.exports = router;

