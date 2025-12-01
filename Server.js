const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const PORT = 5000;

const Login = require("./schema/loginschema");
const Customer = require("./schema/customerschema");
const Fish = require("./schema/fishschema");
const History = require("./schema/history");
const Purchase = require("./schema/addpurchaseschema");

const app = express();
app.use(express.json());
app.use(cors());

const secretKey = "FishApp";


// MongoDB connection
mongoose.connect("mongodb://localhost:27017/BillingSystem", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log("Connected to MongoDB");
  createAdmin();
})
.catch((err) => {
  console.log({ "Error connecting to MongoDB": err });
});


// --------------------- CREATE ADMIN ---------------------
async function createAdmin() {
  try {
    const existingAdmin = await Login.findOne({ userID: "admin" });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      await new Login({
        userID: "admin",
        userpassword: hashedPassword,
        username: "Administrator",
        role: "admin",
      }).save();
      console.log("Admin user created with userID: admin and password: admin123");
    }
  } catch (err) {
    console.log({ "error": err });
  }
}


// --------------------- LOGIN ROUTE ---------------------
app.post("/", async (req, res) => {
  try {
    const { userID, userpassword } = req.body;

    if (!userID || !userpassword) {
      return res.json({ message: "User ID and Password are required" });
    }

    const user = await Login.findOne({ userID });
    if (!user) {
      return res.json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(userpassword, user.userpassword);
    if (!isMatch) {
      return res.json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userID: user.userID, role: user.role },
      secretKey,
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      role: user.role,
    });

  } catch (err) {
    console.error(err);
    return res.json({ message: "Internal server error" });
  }
});


// --------------------- POST ---------------------

app.post("/admin", async (req, res) => {
  try {
    const { type } = req.body;

    // Add customer
    if (type === "customer") {
      const { customerID, customername, customerphone } = req.body;
      if (!customerID || !customername || !customerphone) {
        return res.json({ message: "All customer fields are required" });
      }
      const newCustomer = new Customer({ customerID, customername, customerphone });
      await newCustomer.save();
      return res.json({ message: "Customer added successfully" });
    }

    // Add fish
    if (type === "addfish") {
      const { fishID, fishName, fishunit, kgPrice, boxPrice } = req.body;

      if (!fishID || !fishName) {
        return res.status(400).json({ ok: false, msg: "Fish ID and name are required" });
      }

      const unit = String(fishunit || "").trim().toLowerCase();
      if (unit !== "kg" && unit !== "box") {
        return res.status(400).json({ ok: false, msg: "fishunit must be 'kg' or 'box'" });
      }

      // Determine the provided price based on unit
      if (unit === "kg") {
        if (kgPrice === undefined || kgPrice === null || kgPrice === "") {
          return res.status(400).json({ ok: false, msg: "kgPrice is required for unit 'kg'" });
        }
      } else {
        if (boxPrice === undefined || boxPrice === null || boxPrice === "") {
          return res.status(400).json({ ok: false, msg: "boxPrice is required for unit 'box'" });
        }
      }

      const existing = await Fish.findOne({ fishID });
      if (existing) {
        return res.status(400).json({ ok: false, msg: "Fish ID already exists" });
      }

      const newFish = new Fish({
        fishID,
        fishName,
        fishunit: unit,
        kgPrice: unit === "kg" ? Number(kgPrice) : 0,
        boxPrice: unit === "box" ? Number(boxPrice) : 0,
      });

      await newFish.save();
      return res.status(201).json({ ok: true, msg: "Fish added successfully", fish: newFish });
    }

    // Add user
    if (type === "user") {
      const { userID, username, userpassword } = req.body;
      if (!userID || !username || !userpassword) {
        return res.json({ message: "All user fields are required" });
      }
      const hashedPassword = await bcrypt.hash(userpassword, 10);
      const newUser = new Login({ userID, username, userpassword: hashedPassword });
      await newUser.save();
      return res.json({ message: "User added successfully" });
    }

    // Delete fish
    if (type === "deletefish") {
      const { fishID } = req.body;
      if (!fishID) {
        return res.json({ message: "Fish ID is required" });
      }
      const deleted = await Fish.findOneAndDelete({ fishID });
      if (!deleted) {
        return res.json({ message: "Fish not found" });
      }
      return res.json({ message: "Fish Deleted successfully" });
    }


    return res.json({ message: "Invalid type" });

  } catch (err) {
    console.error(err);
    return res.json({ message: "Internal server error" });
  }
});


//----------------------------------PATCH------------------------------------------//

app.patch("/admin", async (req, res) => {
  try {
    const { type } = req.body;
    console.log("Received PATCH request of type:", type);


    //  Edit fish
    if (type === "editfish") {
      const { fishID, fishunit, newprice } = req.body;

      if (!fishID || !fishunit || newprice === undefined || newprice === "") {
        return res.status(400).json({ ok: false, message: "Fish ID, unit, and new price are required" });
      }

      const unit = String(fishunit || "").trim().toLowerCase();
      if (unit !== "kg" && unit !== "box") {
        return res.status(400).json({ ok: false, message: "fishunit must be 'kg' or 'box'" });
      }

      // prepare the update field and zero the other price to avoid confusion
      const updateField = unit === "kg"
        ? { kgPrice: Number(newprice), boxPrice: 0 }
        : { boxPrice: Number(newprice), kgPrice: 0 };

      try {
        const updatedFish = await Fish.findOneAndUpdate(
          { fishID },
          updateField,
          { new: true }
        );

        if (!updatedFish) {
          return res.status(404).json({ ok: false, message: "Fish not found" });
        }
        return res.json({ ok: true, message: "Fish price updated successfully", data: updatedFish });
      } catch (err) {
        console.error("Error updating fish:", err);
        return res.status(500).json({ ok: false, message: "Internal server error" });
      }
    }



    //  Edit customer
    if (type === "editcustomer") {
      const { customerID, customername, customerphone } = req.body;
      if (!customerID) {
        return res.json({ message: "Customer ID is required" });
      }
      const updated = await Customer.findOneAndUpdate(
        { customerID },
        { customername, customerphone },
        { new: true }
      );
      if (!updated) {
        return res.json({ message: "Customer not found" });
      }
      return res.json({ message: "Customer updated successfully", data: updated });
    }

    return res.json({ message: "Invalid type" });
  } catch (err) {
    console.error(err);
    return res.json({ message: "Internal server error" });
  }
});

//--------------------------------Delete---------------------------------------//

app.delete("/admin" ,async(req,res) => {
  try{
    // Accept 'type' and ids from either body (JSON) or query string to be robust
    const type = (req.body && req.body.type) || (req.query && req.query.type);
    const body = req.body || {};
    const query = req.query || {};

    //---------------------Customer------------------//
    if(type === "deletecustomer"){
      const customerID = body.customerID || query.customerID;
      if(!customerID){
        return res.json({message:"Customer ID is required"});
      }
      const deleted = await Customer.findOneAndDelete({customerID});
      if(!deleted){
        return res.json({message:"Customer not found"});
      }
      return res.json({message:"Customer deleted successfully"});
    }

    //---------------------User------------------//
    if(type === "deleteuser"){
      const userID = body.userID || query.userID;
      console.log("Deleting user with ID:", userID);
      if(!userID){
        return res.json({message:"User ID is required"});
      }
      const deleted = await Login.findOneAndDelete({userID});
      console.log("Deleted user:", deleted);
      if(!deleted){
        return res.json({message:"User not found"});
      }
      return res.json({message:"User deleted successfully"});
    }

    //---------------------Fish------------------//
    return res.json({message: "Invalid type"});
  }
  catch(err){
    console.error(err);
    return res.json({message:"Internal server error" });
  }
})




//---------------------------------get-----------------------------------------


app.get("/admin", async (req, res) => {
  try {
    const { type } = req.query;

    if (type === "fish") {
      const fishes = await Fish.find({});
      return res.json({ ok: true, data: fishes });
    }

    if (type === "customer") {
      const customers = await Customer.find({});
      return res.json({ ok: true, data: customers });
    }

    if (type === "user") {
      const users = await Login.find({});
      return res.json({ ok: true, data: users });
    }
    

    return res.json({ ok: false, message: "Invalid type" });

  } catch (err) {
    console.error(err);
    return res.json({ ok: false, message: "Internal server error" });
  }
});


//---------------------USER--------------------------//

//-------------POST-------------------//

app.post("/user", async (req, res) => {
  try {
    const { customerID, fishID, quantity, unit } = req.body;
    if (!customerID || !fishID || quantity === undefined || !unit) {
      return res.status(400).json({ ok: false, message: "All fields are required" });
    }
    const entry = new Purchase({
      customerID,
      fishID,
      quantity: Number(quantity),
      unit
    });

    await entry.save();
    return res.status(201).json({ ok: true, message: "Purchase recorded successfully", data: entry });
  } catch (err) {
    console.error("POST /user error:", err);
    return res.status(500).json({ ok: false, message: "Internal server error" });
  }
});


//------------------Get-----------------------//

app.get("/admin", async (req, res) => {
  try{
    const { type } = req.query;
    
    if(type === "purchase"){
      const history = await History.find({totalPrice: 0  });
      return res.json({ok:true , data : history});
    }
    return res.json({ok:false , message : "Invalid type" });
  }
  catch(err){
    console.log(err);
    return res.json({ok:false , message : "Internal server error" });
  }
});
  


// --------------------- START SERVER ---------------------
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
