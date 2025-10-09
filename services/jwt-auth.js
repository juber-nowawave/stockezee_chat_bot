import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

export const verify_token = async (token) => {
  try {
    const isValid = jwt.verify(token, process.env.JWT_SECRET);
    return isValid;
  } catch (error) {
    console.log("Error during verify JWT token:", error.message);
  }
};
