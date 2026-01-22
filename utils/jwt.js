const nodemon = require('nodemon');

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
  
  const responseData = {
    id: user._id,
    name: user.name,
    email: user.email,
  };
  
  if (user.privilege) {
    responseData.privilege = user.privilege;
  }
  
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
