const router = require('express').Router();
const teacherController = require('../controllers/teacherController');
const extraCreditRequestController = require('../controllers/extraCreditRequestController');
const advisorAppointmentController = require('../controllers/advisorAppointmentController');
const auth = require('../middleware/Auth');

router.route('/')
  .get(teacherController.getAllTeacherDetails);

router.route('/register')
    .post(teacherController.registerTeacher);

router.route('/login')
  .post(teacherController.loginTeacher);

router.route('/logout')
  .post(teacherController.logoutTeacher);

router.route('/:id')
  .get(teacherController.getSingleTeacherDetails)
  .put(teacherController.updateTeacher)
  .delete(teacherController.deleteTeacher);

router.route('/advisor/dashboard')
  .get(auth.checkTeacherAuthentication, teacherController.getAdvisorDashboard);

router.route('/advisor/pending-reviews')
  .get(auth.checkTeacherAuthentication, teacherController.getPendingReviews);

router.route('/advisor/my-students')
  .get(auth.checkTeacherAuthentication, teacherController.getMyStudents);

router.route('/advisor/students/:studentId')
  .get(auth.checkTeacherAuthentication, teacherController.getStudentDetails);

router.route('/advisor/approved-courses')
  .get(auth.checkTeacherAuthentication, teacherController.getApprovedCourses);

router.route('/advisor/approve/:registrationId')
  .post(auth.checkTeacherAuthentication, teacherController.approveRegistration);

router.route('/advisor/reject/:registrationId')
  .post(auth.checkTeacherAuthentication, teacherController.rejectRegistration);

router.route('/advisor/bulk-approve/:studentId')
  .post(auth.checkTeacherAuthentication, teacherController.bulkApproveRegistrations);

router.route('/advisor/bulk-reject/:studentId')
  .post(auth.checkTeacherAuthentication, teacherController.bulkRejectRegistrations);

router.route('/advisor/extra-credit-requests/pending')
  .get(auth.checkTeacherAuthentication, extraCreditRequestController.getPendingExtraCreditRequests);

router.route('/advisor/extra-credit-requests/:requestId/approve')
  .post(auth.checkTeacherAuthentication, extraCreditRequestController.approveExtraCreditRequest);

router.route('/advisor/extra-credit-requests/:requestId/reject')
  .post(auth.checkTeacherAuthentication, extraCreditRequestController.rejectExtraCreditRequest);

router.route('/advisor/appointments')
  .get(auth.checkTeacherAuthentication, advisorAppointmentController.getAdvisorAppointments);

router.route('/advisor/appointments/:appointmentId/approve')
  .post(auth.checkTeacherAuthentication, advisorAppointmentController.approveAppointment);

router.route('/advisor/appointments/:appointmentId/reject')
  .post(auth.checkTeacherAuthentication, advisorAppointmentController.rejectAppointment);

module.exports = router;
