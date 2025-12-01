const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  customerID: { type: String, required: true },
  fishID: { type: String, required: true },
  quantity: { type: Number, required: true },
  unit: { type: String, required: true }
});

const Purchase = mongoose.model('Purchase', purchaseSchema);
module.exports = Purchase;