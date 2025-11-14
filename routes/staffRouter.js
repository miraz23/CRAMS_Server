const router = require('express').Router();
const staffController = require('../controllers/staffController');

// get all staff details
router.route('/')
  .get(staffController.getAllStaffDetails);

// register staff
router.route('/register')
    .post(staffController.registerStaff);

// staff login
router.route('/login')
  .post(staffController.loginStaff);

// staff logout
router.route('/logout')
  .post(staffController.logoutStaff);

// get single staff details
router.route('/:id')
  .get(staffController.getSingleStaffDetails)
  .put(staffController.updateStaff)
  .delete(staffController.deleteStaff);


module.exports = router;
