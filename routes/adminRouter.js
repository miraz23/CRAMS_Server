const router = require('express').Router();
const adminController = require('../controllers/adminController');


// register admin
router.route('/register')
  .post(adminController.registerAdmin);

// admin login
router.route('/login')
  .post(adminController.loginAdmin);

// admin logout
router.route('/logout')
  .post(adminController.logoutAdmin);

module.exports = router;