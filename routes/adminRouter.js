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