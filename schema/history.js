const mongoose = require("mongoose");

const contentSchema = new mongoose.Schema({
  customerID:{type :String , required : true},
  fishID : {type:String , required : true},
  quantity : {type : Number , required : true},
  unit:{type:String , required : true},
  kgprice:{type: Number ,default : 0},
  boxprice:{type: Number ,default : 0},
  totalPrice:{type: Number ,required : true},
  date:{type: Date, default: Date.now}
} , {timestamps : true});

const History = mongoose.model("History" , contentSchema);
module.exports = History;