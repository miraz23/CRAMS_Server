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