// Middleware to restrict access to administrators only.

const adminOnly = (req, res, next) => {

  // Check whether an authenticated user exists.
  if (!req.user || !req.user._id) {
    return res.status(401).json({
      success: false,
      message: "Authentication required"
    });
  }

  // Check whether the authenticated user is an administrator.
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required"
    });
  }

  // Allow the administrator to access the next handler.
  next();
};

module.exports = adminOnly;