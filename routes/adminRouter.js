const router = require('express').Router();
const adminController = require('../controllers/adminController');


// register first admin (no authentication required)
router.route('/register-superadmin')
  .post(adminController.registerAdmin);

  module.exports = router;