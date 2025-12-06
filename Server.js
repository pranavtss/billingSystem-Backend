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

    // Submit purchases for a customer into History and remove them from Purchase
    if (type === "submittohistory") {
      try {
        const { customerID, items = [] } = req.body;

        if (!customerID) {
          return res.status(400).json({ ok: false, message: "Customer ID is required" });
        }

        // Fetch customer & purchases
        const customer = await Customer.findOne({ customerID });
        const purchases = await Purchase.find({ customerID });

        const customerName = customer ? customer.customername : "Unknown";

        // build items array combining server purchases + optional client items
        const itemsArray = [];

        // server purchases -> item entries
        for (const p of purchases) {
          const fish = await Fish.findOne({ fishID: p.fishID });
          const unitNorm = String(p.unit || "kg");
          const price = unitNorm === 'box' ? Number(p.boxPrice) || 0 : Number(p.kgPrice) || 0;
          itemsArray.push({
            fishID: p.fishID,
            fishName: fish ? (fish.fishName || fish.name) : p.fishID,
            quantity: Number(p.quantity) || 0,
            unit: unitNorm,
            kgprice: Number(p.kgPrice) || 0,
            boxprice: Number(p.boxPrice) || 0,
            price,
            totalPrice: Number(p.totalPrice) || (Number(p.quantity) * price) || 0,
            userID: p.userID || undefined,
          });
        }

        // client-provided pending items -> item entries
        if (Array.isArray(items) && items.length > 0) {
          for (const it of items) {
            const qty = Number(it.quantity ?? it.qty) || 0;
            const unitNorm = String(it.unit || "kg");
            const price = Number(it.price ?? it.kgprice ?? it.boxprice) || 0;
            const fish = await Fish.findOne({ fishID: it.fishID ?? it.fishId });
            itemsArray.push({
              fishID: it.fishID ?? it.fishId ?? "",
              fishName: fish ? (fish.fishName || fish.name) : (it.fishName || it.fishId || it.fishID || ""),
              quantity: qty,
              unit: unitNorm,
              kgprice: unitNorm === 'kg' ? price : 0,
              boxprice: unitNorm === 'box' ? price : 0,
              price,
              totalPrice: Number(it.totalPrice) || qty * price || 0,
              userID: it.userID || undefined,
            });
          }
        }

        if (itemsArray.length === 0) {
          return res.status(400).json({ ok: false, message: "Nothing to submit" });
        }

        const billTotal = itemsArray.reduce((s, it) => s + (Number(it.totalPrice) || 0), 0);

        const historyDoc = new History({
          customerID,
          customername: customerName,
          items: itemsArray,
          totalPrice: billTotal,
          date: new Date(),
        });

        await historyDoc.save();

        // Remove server purchases
        await Purchase.deleteMany({ customerID });

        return res.json({ ok: true, message: "Purchase(s) moved to history" });
      }
      catch (err) {
        console.error("submittohistory error:", err);
        return res.status(500).json({ ok: false, message: "Server error" });
      }
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

    //Edit Bill
    if (type === "editBill") {
      const { _id, newPrice } = req.body;
      if (!_id || newPrice === undefined || newPrice === "") {
        return res.status(400).json({ ok: false, message: "Purchase ID and new price are required" });
      }

      const purchase = await Purchase.findById(_id);
      if (!purchase) {
        return res.status(404).json({ ok: false, message: "Purchase not found" });
      }

      const parsedPrice = Number(newPrice);
      if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ ok: false, message: "newPrice must be a non-negative number" });
      }

      const unitNorm = String(purchase.unit || "").toLowerCase();
      let updateData = {};
      if (unitNorm === 'kg') {
        updateData.kgPrice = parsedPrice;
        updateData.boxPrice = 0;
      } else if (unitNorm === 'box') {
        updateData.boxPrice = parsedPrice;
        updateData.kgPrice = 0;
      } else {
        return res.status(400).json({ ok: false, message: "Invalid unit in purchase record" });
      }

      const qtyNum = Number(purchase.quantity) || 0;
      updateData.totalPrice = qtyNum * parsedPrice;

      const saved = await Purchase.findByIdAndUpdate(_id, updateData, { new: true });
      return res.json({ ok: true, message: "Purchase updated successfully", data: saved });
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
    if(type === "deletefish"){
      const fishID = body.fishID || query.fishID;
      if(!fishID){
        return res.json({message:"Fish ID is required"});
      }
      const deleted = await Fish.findOneAndDelete({fishID});
      if(!deleted){
        return res.json({message:"Fish not found"});
      }
      return res.json({message:"Fish deleted successfully"});
    }

    if (type === "deleteBill") {
      const _id = req.body._id || req.query._id;
      if (!_id) {
        return res.status(400).json({ ok: false, message: "Purchase ID is required" });
      }
      const deleted = await Purchase.findOneAndDelete({ _id });
      if (!deleted) {
        return res.status(404).json({ ok: false, message: "Purchase not found" });
      }
      return res.json({ ok: true, message: "Purchase deleted successfully" });
    }

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

    if (type === "purchase") {
      
      const purchases = await Purchase.find({});
      const result = await Promise.all(
        purchases.map(async (p) => {
          const customer = await Customer.findOne({ customerID: p.customerID });
          const purchaseObj = p.toObject ? p.toObject() : p;
          // ensure numeric fields
          purchaseObj.quantity = Number(purchaseObj.quantity) || 0;
          purchaseObj.kgPrice = Number(purchaseObj.kgPrice) || 0;
          purchaseObj.boxPrice = Number(purchaseObj.boxPrice) || 0;
          purchaseObj.totalPrice = Number(purchaseObj.totalPrice) || (
            purchaseObj.unit === 'kg' ? purchaseObj.kgPrice * purchaseObj.quantity : purchaseObj.boxPrice * purchaseObj.quantity
          );
          // attach customer info to help the UI
          purchaseObj.customername = customer ? customer.customername : "Unknown";
          purchaseObj.customerphone = customer ? customer.customerphone : "N/A";
          return purchaseObj;
        })
      );

      return res.json({ ok: true, data: result });
    }

    return res.json({ ok: false, message: "Invalid type" });

  } catch (err) {
    console.error(err);
    return res.json({ ok: false, message: "Internal server error" });
  }
});

app.get("/history" , async(req,res)  => {
  try{
    const history = await History.find({});
    return res.json({ok:true , data:history});
  }
  catch(err){
    console.log("Error fetching history" , err);
  }
})


//---------------------USER--------------------------//

//-------------POST-------------------//

app.post("/user", async (req, res) => {
  try {
    const { userID, customerID, fishID, quantity, unit } = req.body;

    // basic validation
    if (userID === undefined || userID === null || !customerID || !fishID || quantity === undefined || !unit) {
      return res.status(400).json({ ok: false, message: "All fields are required (userID, customerID, fishID, quantity, unit)" });
    }
    const fish = await Fish.findOne({ fishID });
    if (!fish) {
      return res.status(404).json({ ok: false, message: "Fish not found" });
    }


    let kgPrice = 0;
    let boxPrice = 0;
    let pricePerUnit = 0;
    
    const unitNorm = unit.toLowerCase();
    
    if (unitNorm === 'kg') {
      kgPrice = Number(fish.kgPrice) || 0;
      pricePerUnit = kgPrice;
      console.log("kgPrice from fish:", kgPrice);
    } else if (unitNorm === 'box') {
      boxPrice = Number(fish.boxPrice) || 0;
      pricePerUnit = boxPrice;
      console.log("boxPrice from fish:", boxPrice);
    } else {
      return res.status(400).json({ ok: false, message: "Unit must be 'kg' or 'box'" });
    }

    // Calculate total
    const qtyNum = Number(quantity) || 0;
    const totalPrice = pricePerUnit * qtyNum;

    const entry = new Purchase({
      userID: userID,
      customerID,
      fishID,
      quantity: qtyNum,
      unit: unitNorm,
      kgPrice: kgPrice,
      boxPrice: boxPrice,
      totalPrice,
      date: new Date(),
    });

    // Log before saving
    console.log("Purchase entry to save:", entry);

    await entry.save();
    
    // Log after saving
    console.log("Purchase saved successfully");

    return res.status(201).json({
      ok: true,
      message: "Purchase recorded successfully",
      data: entry
    });

  } catch (err) {
    console.log("POST /user error:", err);
    return res.json({ ok: false, message: "Internal server error" });
  }
});




// --------------------- START SERVER ---------------------
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
