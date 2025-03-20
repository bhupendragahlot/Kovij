// src/middleware/cookieMiddleware.js
export const cookieMiddleware = (req, res, next) => {
    if (!req.cookies.user) {
      // Set a cookie named "user" with a default value "anonymous"
      res.cookie("user", "anonymous", { maxAge: 900000, httpOnly: true });
    }
    next();
  };
  