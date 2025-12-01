const mongoose = require("mongoose");

const fishSchema = new mongoose.Schema({
  fishID: { type: String, required: true },
  fishName: { type: String, required: true },
  fishunit: { type: String, default: "kg" },
  kgPrice: { type: Number, default: 0 },
  boxPrice: { type: Number, default:0 },
});

const Fish = mongoose.model("Fish", fishSchema);
module.exports = Fish;
