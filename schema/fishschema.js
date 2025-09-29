const mongoose = require("mongoose");

const fishSchema = new mongoose.Schema({
  fishID: { type: String, required: true },
  fishName: { type: String, required: true },
  fishPrice: { type: Number, required: true }
});

const Fish = mongoose.model("Fish", fishSchema);
module.exports = Fish;
