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

// Manual CORS handler to ensure PATCH is explicitly allowed
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Access-Control-Request-Method, Access-Control-Request-Headers');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

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
    console.log("POST /admin received type:", type, "Type of type:", typeof type, "Body:", JSON.stringify(req.body));

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
      const { fishID, fishName, kgPrice, boxPrice } = req.body;
      console.log("Received add fish request:", { fishID, fishName, kgPrice, boxPrice });

      if (!fishID || !fishName) {
        return res.status(400).json({ ok: false, msg: "Fish ID and name are required" });
      }

      // Convert to numbers, treating only undefined/null/empty string as "not provided"
      const parsedKg = (kgPrice === undefined || kgPrice === null || kgPrice === "")
        ? 0
        : Number(kgPrice);
      const parsedBox = (boxPrice === undefined || boxPrice === null || boxPrice === "")
        ? 0
        : Number(boxPrice);
      console.log("Parsed prices:", { parsedKg, parsedBox });

      if (parsedKg === 0 && parsedBox === 0) {
        return res.status(400).json({ ok: false, msg: "Provide at least one price (kg or box)" });
      }

      if (Number.isNaN(parsedKg) || Number.isNaN(parsedBox)) {
        return res.status(400).json({ ok: false, msg: "Prices must be valid numbers" });
      }

      if (parsedKg < 0 || parsedBox < 0) {
        return res.status(400).json({ ok: false, msg: "Prices cannot be negative" });
      }

      const existing = await Fish.findOne({ fishID });
      if (existing) {
        return res.status(400).json({ ok: false, msg: "Fish ID already exists" });
      }

      const legacyUnit = parsedKg > 0 ? "kg" : "box";
      const fishData = {
        fishID,
        fishName,
        fishunit: legacyUnit,
        kgPrice: parsedKg,
        boxPrice: parsedBox,
      };
      console.log("Creating fish with data:", fishData);
      const newFish = new Fish(fishData);

      await newFish.save();
      console.log("Saved fish:", newFish.toObject());
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

    // Edit fish price
    if (type === "editfish") {
      const { fishID, fishName, kgPrice, boxPrice } = req.body;

      if (!fishID && !fishName) {
        return res.status(400).json({ ok: false, message: "Provide fishID or fishName to update" });
      }

      const fishQuery = fishID ? { fishID } : { fishName };
      const fish = await Fish.findOne(fishQuery);
      if (!fish) {
        return res.status(404).json({ ok: false, message: "Fish not found" });
      }

      // Build update object only with provided values
      const updateData = {};
      
      if (kgPrice !== undefined && kgPrice !== null && kgPrice !== "") {
        const parsedKg = Number(kgPrice);
        if (Number.isNaN(parsedKg) || parsedKg < 0) {
          return res.status(400).json({ ok: false, message: "Invalid kg price" });
        }
        updateData.kgPrice = parsedKg;
      }
      
      if (boxPrice !== undefined && boxPrice !== null && boxPrice !== "") {
        const parsedBox = Number(boxPrice);
        if (Number.isNaN(parsedBox) || parsedBox < 0) {
          return res.status(400).json({ ok: false, message: "Invalid box price" });
        }
        updateData.boxPrice = parsedBox;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ ok: false, message: "Provide at least one price to update" });
      }

      // Determine unit based on which price is higher
      const finalKg = updateData.kgPrice !== undefined ? updateData.kgPrice : fish.kgPrice;
      const finalBox = updateData.boxPrice !== undefined ? updateData.boxPrice : fish.boxPrice;
      updateData.fishunit = finalKg > 0 ? "kg" : "box";

      const updated = await Fish.findOneAndUpdate(fishQuery, updateData, { new: true });
      return res.json({ ok: true, message: "Fish price updated successfully", data: updated });
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

    // Edit Bill
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

    //  Edit customer
    if (type === "editcustomer") {
      console.log("✅ INSIDE editcustomer block in POST route");
      const { customerID, customername, customerphone } = req.body;
      if (!customerID) {
        return res.status(400).json({ message: "Customer ID is required" });
      }
      if (!customername || String(customername).trim() === "") {
        return res.status(400).json({ message: "Customer name is required" });
      }
      if (!customerphone || String(customerphone).trim() === "") {
        return res.status(400).json({ message: "Customer phone is required" });
      }
      const updated = await Customer.findOneAndUpdate(
        { customerID },
        { customername, customerphone },
        { new: true }
      );
      if (!updated) {
        return res.status(404).json({ message: "Customer not found" });
      }
      return res.json({ message: "Customer updated successfully", data: updated });
    }

    return res.json({ message: "Invalid type" });

  } catch (err) {
    console.error(err);
    return res.json({ message: "Internal server error" });
  }
});

app.patch("/admin", async (req, res) => {
  try {
    const { type } = req.body;
    console.log("Received PATCH request of type:", type);


    //  Edit fish
    if (type === "editfish") {
      const { fishID, kgPrice, boxPrice } = req.body;
      console.log("Edit fish request:", { fishID, kgPrice, boxPrice });

      if (!fishID) {
        return res.status(400).json({ ok: false, message: "Fish ID is required" });
      }

      const parsedKg = (kgPrice === undefined || kgPrice === null || kgPrice === "")
        ? null
        : Number(kgPrice);
      const parsedBox = (boxPrice === undefined || boxPrice === null || boxPrice === "")
        ? null
        : Number(boxPrice);

      if (parsedKg === null && parsedBox === null) {
        return res.status(400).json({ ok: false, message: "Provide at least one price to update" });
      }

      if ((parsedKg !== null && Number.isNaN(parsedKg)) || (parsedBox !== null && Number.isNaN(parsedBox))) {
        return res.status(400).json({ ok: false, message: "Prices must be valid numbers" });
      }

      if ((parsedKg !== null && parsedKg < 0) || (parsedBox !== null && parsedBox < 0)) {
        return res.status(400).json({ ok: false, message: "Prices cannot be negative" });
      }

      // Only update fields that have values (non-null)
      const updateField = {};
      if (parsedKg !== null) {
        updateField.kgPrice = parsedKg;
      }
      if (parsedBox !== null) {
        updateField.boxPrice = parsedBox;
      }

      console.log("Update fields:", updateField);

      try {
        const updatedFish = await Fish.findOneAndUpdate(
          { fishID },
          updateField,
          { new: true }
        );

        if (!updatedFish) {
          return res.status(404).json({ ok: false, message: "Fish not found" });
        }
        console.log("Updated fish:", updatedFish.toObject());
        return res.json({ ok: true, message: "Fish price updated successfully", data: updatedFish });
      } catch (err) {
        console.error("Error updating fish:", err);
        return res.status(500).json({ ok: false, message: "Internal server error" });
      }
    }



    //  Edit customer
    if (type === "editcustomer") {
      console.log("✅ INSIDE editcustomer block in POST route");
      const { customerID, customername, customerphone } = req.body;
      if (!customerID) {
        return res.status(400).json({ message: "Customer ID is required" });
      }
      if (!customername || String(customername).trim() === "") {
        return res.status(400).json({ message: "Customer name is required" });
      }
      if (!customerphone || String(customerphone).trim() === "") {
        return res.status(400).json({ message: "Customer phone is required" });
      }
      const updated = await Customer.findOneAndUpdate(
        { customerID },
        { customername, customerphone },
        { new: true }
      );
      if (!updated) {
        return res.status(404).json({ message: "Customer not found" });
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

    //  Edit customer
    if (type === "editcustomer") {
      const { customerID, customername, customerphone } = req.body;
      if (!customerID) {
        return res.status(400).json({ message: "Customer ID is required" });
      }
      if (!customername || String(customername).trim() === "") {
        return res.status(400).json({ message: "Customer name is required" });
      }
      if (!customerphone || String(customerphone).trim() === "") {
        return res.status(400).json({ message: "Customer phone is required" });
      }
      const updated = await Customer.findOneAndUpdate(
        { customerID },
        { customername, customerphone },
        { new: true }
      );
      if (!updated) {
        return res.status(404).json({ message: "Customer not found" });
      }
      return res.json({ message: "Customer updated successfully", data: updated });
    }

    return res.json({ message: "Invalid type" });
  } catch (err) {
    console.error(err);
    return res.json({ message: "Internal server error" });
  }
});

app.delete("/admin" ,async(req,res) => {
  try{
    // Accept 'type' and ids from either body (JSON) or query string to be robust
    const type = (req.body && req.body.type) || (req.query && req.query.type);
    const body = req.body || {};
    const query = req.query || {};

    if(type === "deletecustomer"){
      const customerID = body.customerID || query.customerID;
      if(!customerID){
        return res.json({message:"Customer ID is required"});
      }
      const deleted = await Customer.findOneAndDelete({customerID});
      if(!deleted){
        return res.json({message:"Customer not found"});
      }
      
      // Delete all history records for this customer
      await History.deleteMany({customerID});
      
      // Delete all pending purchases for this customer
      await Purchase.deleteMany({customerID});
      
      return res.json({message:"Customer deleted successfully"});
    }

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
