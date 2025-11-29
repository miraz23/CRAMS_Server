const nodemon = require('nodemon');

// create jwt token and save as a cookie
exports.sendToken = (user, statusCode, res) => {
  const token = user.getJwtToken();
  const options = {
    expires: new Date(
      Date.now() + process.env.COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    sameSite: 'none',
    secure: true,
  };
  
  // Build response data based on user type
  const responseData = {
    id: user._id,
    name: user.name,
    email: user.email,
  };
  
  // Add privilege if it's an admin
  if (user.privilege) {
    responseData.privilege = user.privilege;
  }
  
  // Add studentId if it's a student
  if (user.studentId) {
    responseData.studentId = user.studentId;
  }
  
  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      message: 'Log in successful!',
      data: responseData,
    });
};
