import { verify_token } from "../services/jwt-auth.js";

const auth_user_token = async (req, res, next) => {
  try {
    const auth_header = req.headers.authorization;

    if (!auth_header?.startsWith("Bearer ")) {
      return res.status(400).json({
        status: 0,
        message: "Authorization token missing or invalid",
      });
    }

    const token = auth_header.split(" ")[1];
    const user = await verify_token(token);
    
    if (!user) {
      return res.status(401).json({
        status: 0,
        message: "Invalid or expired token",
      });
    }
    
    req.user = user;
    next();
  } catch (error) {
    return res.status(500).json({
      status: 0,
      message: "Something went wrong",
    });
  }
};
export default auth_user_token;