const router = require('express').Router();
const studentController = require('../controllers/studentController');
const courseRegistrationController = require('../controllers/courseRegistrationController');
const extraCreditRequestController = require('../controllers/extraCreditRequestController');
const advisorAppointmentController = require('../controllers/advisorAppointmentController');
const auth = require('../middleware/Auth');

// get all student details
router.route('/')
  .get(studentController.getAllStudentDetails);
  
// student login
router.route('/login')
  .post(studentController.loginStudent);

// student logout
router.route('/logout')
  .post(studentController.logoutStudent);

// get authenticated student's schedule
router.route('/schedule')
  .get(auth.checkStudentAuthentication, studentController.getStudentSchedule);

// get authenticated student's routine (all courses in section)
router.route('/routine')
  .get(auth.checkStudentAuthentication, studentController.getStudentRoutine);

// get system settings (public)
router.route('/system-settings')
  .get(studentController.getSystemSettings);

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

// Extra Credit Request Routes
// Create extra credit request
router.route('/extra-credit-requests')
  .post(auth.checkStudentAuthentication, extraCreditRequestController.createExtraCreditRequest)
  .get(auth.checkStudentAuthentication, extraCreditRequestController.getMyExtraCreditRequests);

// Advisor Appointment Routes
// Get my advisor information
router.route('/advisor')
  .get(auth.checkStudentAuthentication, advisorAppointmentController.getMyAdvisor);

// Book appointment
router.route('/appointments')
  .post(auth.checkStudentAuthentication, advisorAppointmentController.bookAppointment)
  .get(auth.checkStudentAuthentication, advisorAppointmentController.getMyAppointments);

// NOTE: Keep parameterized routes LAST so they don't swallow specific routes above.
// get single student details + update + delete
router.route('/:id')
  .get(studentController.getSingleStudentDetails)
  .put(studentController.updateStudent)
  .delete(studentController.deleteStudent);

module.exports = router;

