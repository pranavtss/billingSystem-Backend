const mongoose = require("mongoose");

const contentSchema = new mongoose.Schema({
  customerID:{type :Number , required : true},
  fishID : {type:Number , required : true},
  quantity : {type : Number , required : true},
  totalAmount:{type: Number },
  date:{type: Date, default: Date.now}
} , {timestamps : true});

const History = mongoose.model("History" , contentSchema);
module.exports = History;