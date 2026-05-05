// src/utils/auth.js
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-prod";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";

const hashPassword = (password) => bcrypt.hash(password, SALT_ROUNDS);

const comparePassword = (password, hash) => bcrypt.compare(password, hash);

const signToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
};

const extractUser = (req) => {
  const auth = req?.headers?.authorization || "";
  if (!auth.startsWith("Bearer ")) return null;
  return verifyToken(auth.slice(7));
};

module.exports = { hashPassword, comparePassword, signToken, verifyToken, extractUser };
