const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  fishID: { type: String, required: true },
  fishName: { type: String },
  quantity: { type: Number, required: true },
  unit: { type: String, default: 'kg' },
  kgprice: { type: Number, default: 0 },
  boxprice: { type: Number, default: 0 },
  price: { type: Number, default: 0 },
  totalPrice: { type: Number, required: true },
  userID: { type: String },
  userName: { type: String },
  addedBy: {
    userID: { type: String },
    username: { type: String },
    role: { type: String }
  },
  addedAt: { type: Date }
}, { _id: false });

const contentSchema = new mongoose.Schema({
  customerID: { type: String, required: true },
  customername: { type: String, required: true },
  customerphone: { type: String },
  items: { type: [itemSchema], default: [] },
  totalPrice: { type: Number, required: true },
  billedBy: {
    userID: { type: String },
    username: { type: String },
    role: { type: String }
  },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

const History = mongoose.model("History", contentSchema);
module.exports = History;