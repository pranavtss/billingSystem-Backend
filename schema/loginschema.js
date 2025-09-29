const mongoose = require("mongoose");

const loginSchema = new mongoose.Schema({
  userID: { type: String, required: true },
  username: { type: String },
  userpassword: { type: String, required: true },
  role: { type: String, default: "user" }
});

const Login = mongoose.model("Login", loginSchema);
module.exports = Login;
