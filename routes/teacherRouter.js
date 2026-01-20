const router = require('express').Router();
const teacherController = require('../controllers/teacherController');
const extraCreditRequestController = require('../controllers/extraCreditRequestController');
const advisorAppointmentController = require('../controllers/advisorAppointmentController');
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

// advisor my students
router.route('/advisor/my-students')
  .get(auth.checkTeacherAuthentication, teacherController.getMyStudents);

// advisor student details
router.route('/advisor/students/:studentId')
  .get(auth.checkTeacherAuthentication, teacherController.getStudentDetails);

// advisor approved courses
router.route('/advisor/approved-courses')
  .get(auth.checkTeacherAuthentication, teacherController.getApprovedCourses);

// approve/reject course registrations
router.route('/advisor/approve/:registrationId')
  .post(auth.checkTeacherAuthentication, teacherController.approveRegistration);

router.route('/advisor/reject/:registrationId')
  .post(auth.checkTeacherAuthentication, teacherController.rejectRegistration);

router.route('/advisor/bulk-approve/:studentId')
  .post(auth.checkTeacherAuthentication, teacherController.bulkApproveRegistrations);

router.route('/advisor/bulk-reject/:studentId')
  .post(auth.checkTeacherAuthentication, teacherController.bulkRejectRegistrations);

// Extra Credit Request Routes
// Get pending extra credit requests
router.route('/advisor/extra-credit-requests/pending')
  .get(auth.checkTeacherAuthentication, extraCreditRequestController.getPendingExtraCreditRequests);

// Approve extra credit request
router.route('/advisor/extra-credit-requests/:requestId/approve')
  .post(auth.checkTeacherAuthentication, extraCreditRequestController.approveExtraCreditRequest);

// Reject extra credit request
router.route('/advisor/extra-credit-requests/:requestId/reject')
  .post(auth.checkTeacherAuthentication, extraCreditRequestController.rejectExtraCreditRequest);

// Advisor Appointment Routes
// Get my appointments
router.route('/advisor/appointments')
  .get(auth.checkTeacherAuthentication, advisorAppointmentController.getAdvisorAppointments);

// Approve appointment
router.route('/advisor/appointments/:appointmentId/approve')
  .post(auth.checkTeacherAuthentication, advisorAppointmentController.approveAppointment);

// Reject appointment
router.route('/advisor/appointments/:appointmentId/reject')
  .post(auth.checkTeacherAuthentication, advisorAppointmentController.rejectAppointment);

module.exports = router;