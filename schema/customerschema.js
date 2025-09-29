const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema({
  customerID: { type: String, required: true },
  customername: { type: String, required: true },
  customerphone: { type: String, required: true }
});

const Customer = mongoose.model("Customer", customerSchema);
module.exports = Customer;
