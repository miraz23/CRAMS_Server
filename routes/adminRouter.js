const router = require('express').Router();
const adminController = require('../controllers/adminController');
const auth = require('../middleware/Auth');
const upload = require('../middleware/upload');

router.route('/')
  .get(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Super Admin'),
    adminController.getAllAdminDetails
  );

router.route('/upload-student-csv')
  .post(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Admin', 'Super Admin'),
    upload.single('csvFile'),
    adminController.uploadStudentCSV
  );

router.route('/upload-csv')
  .post(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Super Admin'),
    upload.single('csvFile'),
    adminController.uploadAdminCSV
  );

router.route('/upload-teacher-csv')
  .post(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Super Admin'),
    upload.single('csvFile'),
    adminController.uploadTeacherCSV
  );

router.route('/login')
  .post(adminController.loginAdmin);

router.route('/logout')
  .post(adminController.logoutAdmin);

router.route('/courses')
  .post(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Admin', 'Super Admin'),
    adminController.addCourse
  )
  .get(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Admin', 'Super Admin'),
    adminController.getCourses
  );

router.route('/courses/:id')
  .get(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Admin', 'Super Admin'),
    adminController.getSingleCourse
  )
  .put(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Admin', 'Super Admin'),
    adminController.updateCourse
  )
  .delete(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Admin', 'Super Admin'),
    adminController.deleteCourse
  );

router.route('/sections')
  .post(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Admin', 'Super Admin'),
    adminController.createSection
  )
  .get(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Admin', 'Super Admin'),
    adminController.getSections
  );

router.route('/sections/populate-from-students')
  .post(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Admin', 'Super Admin'),
    adminController.populateSectionsFromStudents
  );

router.route('/sections/:id')
  .get(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Admin', 'Super Admin'),
    adminController.getSingleSection
  )
  .put(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Admin', 'Super Admin'),
    adminController.updateSection
  )
  .delete(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Admin', 'Super Admin'),
    adminController.deleteSection
  );

router.route('/sections/:sectionId/courses/:courseId/schedule')
  .put(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Admin', 'Super Admin'),
    adminController.updateSectionCourseSchedule
  );

router.route('/user-management/overview')
  .get(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Admin', 'Super Admin'),
    adminController.getUserManagementOverview
  );

router.route('/user-management/students')
  .get(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Admin', 'Super Admin'),
    adminController.getAllStudentsForAdmin
  );

router.route('/user-management/teachers')
  .get(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Admin', 'Super Admin'),
    adminController.getAllTeachersForAdmin
  );

router.route('/user-management/advisors')
  .get(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Admin', 'Super Admin'),
    adminController.getAllAdvisors
  );

router.route('/user-management/students/:id')
  .put(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Super Admin'),
    adminController.updateStudentByAdmin
  )
  .delete(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Super Admin'),
    adminController.deleteStudentByAdmin
  );

router.route('/user-management/teachers/:id')
  .put(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Super Admin'),
    adminController.updateTeacherByAdmin
  )
  .delete(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Super Admin'),
    adminController.deleteTeacherByAdmin
  );

router.route('/system-settings')
  .get(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Admin', 'Super Admin'),
    adminController.getSystemSettings
  )
  .put(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Admin', 'Super Admin'),
    adminController.updateSystemSettings
  );

router.route('/:id')
  .get(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Super Admin'),
    adminController.getSingleAdminDetails
  )
  .put(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Super Admin'),
    adminController.updateAdminPrivilege
  )
  .delete(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Super Admin'),
    adminController.deleteAdmin
  );

module.exports = router;
