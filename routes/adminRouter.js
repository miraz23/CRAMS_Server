const router = require('express').Router();
const adminController = require('../controllers/adminController');
const auth = require('../middleware/Auth');
const upload = require('../middleware/upload');

// get all admin details
router.route('/')
  .get(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Super Admin'),
    adminController.getAllAdminDetails
  );

// CSV upload for student creation (Super Admin and Admin)
router.route('/upload-student-csv')
  .post(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Admin', 'Super Admin'),
    upload.single('csvFile'),
    adminController.uploadStudentCSV
  );

// CSV upload for admin creation (Super Admin only)
router.route('/upload-csv')
  .post(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Super Admin'),
    upload.single('csvFile'),
    adminController.uploadAdminCSV
  );

// CSV upload for teacher creation (Super Admin only)
router.route('/upload-teacher-csv')
  .post(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Super Admin'),
    upload.single('csvFile'),
    adminController.uploadTeacherCSV
  );

// admin login
router.route('/login')
  .post(adminController.loginAdmin);

// admin logout
router.route('/logout')
  .post(adminController.logoutAdmin);

// Course Management Routes
// Add new course
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

// Get, update, or delete single course
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

// Section Management Routes
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

// User Management (Admin Dashboard)
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

// get single admin details
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