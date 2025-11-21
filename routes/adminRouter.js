const router = require('express').Router();
const adminController = require('../controllers/adminController');
const auth = require('../middleware/Auth');

// get all admin details
router.route('/')
  .get(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Super Admin'),
    adminController.getAllAdminDetails
  );

// register admin
router.route('/register')
  .post(adminController.registerAdmin);

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

router.route('/user-management/staff')
  .get(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Admin', 'Super Admin'),
    adminController.getAllStaffsForAdmin
  );

router.route('/user-management/students/:id')
  .put(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Admin', 'Super Admin'),
    adminController.updateStudentByAdmin
  );

router.route('/user-management/teachers/:id')
  .put(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Admin', 'Super Admin'),
    adminController.updateTeacherByAdmin
  );

router.route('/user-management/staff/:id')
  .put(
    auth.checkUserAuthentication,
    auth.checkAdminPrivileges('Admin', 'Super Admin'),
    adminController.updateStaffByAdmin
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