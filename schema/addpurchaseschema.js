const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  userID: { type: String, required: true },
  customerID: { type: String, required: true },
  fishID: { type: String, required: true },
  quantity: { type: Number, required: true },
  unit: { type: String, required: true },
  kgPrice: { type: Number, default: 0 },
  boxPrice: { type: Number, default: 0 },
  totalPrice: { type: Number, required: true },
  date: { type: Date, default: Date.now }
});

const Purchase = mongoose.model('Purchase', purchaseSchema);
module.exports = Purchase;