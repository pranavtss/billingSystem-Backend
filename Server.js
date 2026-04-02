require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
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

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

const FRONTEND_ORIGIN = process.env.FRONTEND_URL || process.env.FRONTEND_ORIGIN || 'https://billingsystem1.onrender.com';
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));

app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', FRONTEND_ORIGIN);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    return res.status(204).end();
  }
  next();
});

const secretKey = process.env.JWT_SECRET || "FishApp";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/BillingSystem";
if (!process.env.MONGODB_URI) {
  console.warn("MONGODB_URI not set in .env; using local fallback.");
}

mongoose.connect(MONGODB_URI)
.then(() => {
  console.log("✅ Connected to MongoDB");
  createAdmin();
})
.catch((err) => {
  console.error("❌ Error connecting to MongoDB:", err);
  console.error("Make sure MongoDB is running locally or check MONGODB_URI in .env");
});


app.get('/healthz', (req, res) => {
  res.status(200).json({ ok: true, status: 'healthy' });
});
app.get('/readyz', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.status(200).json({ ok: true, status: 'ready' });
  } catch (err) {
    res.status(503).json({ ok: false, status: 'not-ready', message: String(err?.message || err) });
  }
});



async function createAdmin() {
  try {
    const adminID = process.env.ADMIN_ID || "admin";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    const adminUsername = process.env.ADMIN_USERNAME || "Administrator";
    
    const existingAdmin = await Login.findOne({ userID: adminID });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await new Login({
        userID: adminID,
        userpassword: hashedPassword,
        username: adminUsername,
        role: "admin",
      }).save();
      console.log(`Admin user created with userID: ${adminID}`);
    }
  } catch (err) {
    console.log({ "error": err });
  }
}



app.post("/", async (req, res) => {
  try {
    const { userID, userpassword } = req.body;

    if (!userID || !userpassword) {
      return res.status(400).json({ ok: false, message: "User ID and Password are required" });
    }

    const user = await Login.findOne({ userID });
    if (!user) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    const isMatch = await bcrypt.compare(userpassword, user.userpassword);
    if (!isMatch) {
      return res.status(401).json({ ok: false, message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userID: user.userID, role: user.role },
      secretKey,
    );

    return res.status(200).json({
      ok: true,
      message: "Login successful",
      token,
      role: user.role,
    });

  } catch (err) {
    console.error("LOGIN error:", err);
    return res.status(500).json({ ok: false, message: "Internal server error" });
  }
});




app.post("/admin", async (req, res) => {
  try {
    const { type } = req.body;
    console.log("POST /admin received type:", type, "Type of type:", typeof type, "Body:", JSON.stringify(req.body));

    
    if (type === "customer") {
      const { customerID, customername, customerphone } = req.body;
      if (!customerID || !customername || !customerphone) {
        return res.json({ message: "All customer fields are required" });
      }
      
      
      const letterCount = (String(customerID).match(/[a-zA-Z]/g) || []).length;
      if (letterCount > 2) {
        return res.json({ message: "Customer ID can contain maximum 2 alphabets" });
      }
      
      const newCustomer = new Customer({ customerID, customername, customerphone });
      await newCustomer.save();
      return res.json({ message: "Customer added successfully" });
    }

    
    if (type === "addfish") {
      const { fishID, fishName, kgPrice, boxPrice } = req.body;
      console.log("Received add fish request:", { fishID, fishName, kgPrice, boxPrice });

      if (!fishID || !fishName) {
        return res.status(400).json({ ok: false, msg: "Fish ID and name are required" });
      }
      
      
      const letterCount = (String(fishID).match(/[a-zA-Z]/g) || []).length;
      if (letterCount > 2) {
        return res.status(400).json({ ok: false, msg: "Fish ID can contain maximum 2 alphabets" });
      }

      
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

    
    if (type === "user") {
      const { userID, username, userpassword } = req.body;
      if (!userID || !username || !userpassword) {
        return res.json({ message: "All user fields are required" });
      }
      
      
      const letterCount = (String(userID).match(/[a-zA-Z]/g) || []).length;
      if (letterCount > 2) {
        return res.json({ message: "User ID can contain maximum 2 alphabets" });
      }
      
      const hashedPassword = await bcrypt.hash(userpassword, 10);
      const newUser = new Login({ userID, username, userpassword: hashedPassword });
      await newUser.save();
      return res.json({ message: "User added successfully" });
    }

    
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

      
      const finalKg = updateData.kgPrice !== undefined ? updateData.kgPrice : fish.kgPrice;
      const finalBox = updateData.boxPrice !== undefined ? updateData.boxPrice : fish.boxPrice;
      updateData.fishunit = finalKg > 0 ? "kg" : "box";

      const updated = await Fish.findOneAndUpdate(fishQuery, updateData, { new: true });
      return res.json({ ok: true, message: "Fish price updated successfully", data: updated });
    }

    
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

    
    if (type === "submittohistory") {
      try {
        const { customerID, items = [], userID: submittedBy, paidAmount = 0, isFullPaid = false } = req.body;

        if (!customerID) {
          return res.status(400).json({ ok: false, message: "Customer ID is required" });
        }

        
        const customer = await Customer.findOne({ customerID });
        const purchases = await Purchase.find({ customerID });

        const customerName = customer ? customer.customername : "Unknown";
        const customerphone = customer ? customer.customerphone : undefined;

      
        const userCache = new Map();
        const resolveUser = async (uid) => {
          if (!uid) return null;
          if (userCache.has(uid)) return userCache.get(uid);
          const found = await Login.findOne({ userID: uid });
          const val = found
            ? { userID: found.userID, username: found.username || found.userID, role: found.role }
            : { userID: uid, username: String(uid) };
          userCache.set(uid, val);
          return val;
        };

        const billedUserId = submittedBy || (purchases[0]?.userID) || (items[0]?.userID);
        const billedBy = await resolveUser(billedUserId);

        const itemsArray = [];
        for (const p of purchases) {
          const fish = await Fish.findOne({ fishID: p.fishID });
          const unitNorm = String(p.unit || "kg");
          const price = unitNorm === 'box' ? Number(p.boxPrice) || 0 : Number(p.kgPrice) || 0;
          const itemUser = await resolveUser(p.userID || billedBy?.userID);
          itemsArray.push({
            fishID: p.fishID,
            fishName: fish ? (fish.fishName || fish.name) : p.fishID,
            quantity: Number(p.quantity) || 0,
            unit: unitNorm,
            kgprice: Number(p.kgPrice) || 0,
            boxprice: Number(p.boxPrice) || 0,
            price,
            totalPrice: Number(p.totalPrice) || (Number(p.quantity) * price) || 0,
            userID: itemUser?.userID,
            userName: itemUser?.username,
            addedBy: itemUser,
            addedAt: p.createdAt || new Date(),
          });
        }

        if (Array.isArray(items) && items.length > 0) {
          for (const it of items) {
            const qty = Number(it.quantity ?? it.qty) || 0;
            const unitNorm = String(it.unit || "kg");
            const price = Number(it.price ?? it.kgprice ?? it.boxprice) || 0;
            const fish = await Fish.findOne({ fishID: it.fishID ?? it.fishId });
            const itemUser = await resolveUser(it.userID || billedBy?.userID);
            itemsArray.push({
              fishID: it.fishID ?? it.fishId ?? "",
              fishName: fish ? (fish.fishName || fish.name) : (it.fishName || it.fishId || it.fishID || ""),
              quantity: qty,
              unit: unitNorm,
              kgprice: unitNorm === 'kg' ? price : 0,
              boxprice: unitNorm === 'box' ? price : 0,
              price,
              totalPrice: Number(it.totalPrice) || qty * price || 0,
              userID: itemUser?.userID,
              userName: itemUser?.username,
              addedBy: itemUser,
              addedAt: it.addedAt || new Date(),
            });
          }
        }

        if (itemsArray.length === 0) {
          return res.status(400).json({ ok: false, message: "Nothing to submit" });
        }

        const billTotal = itemsArray.reduce((s, it) => s + (Number(it.totalPrice) || 0), 0);
        const paid = Number(paidAmount) || 0;
        const clampedPaid = Math.max(0, Math.min(paid, billTotal));
        const balanceForThisBill = billTotal - clampedPaid;

        const historyDoc = new History({
          customerID,
          customername: customerName,
          customerphone,
          items: itemsArray,
          totalPrice: billTotal,
          paidAmount: clampedPaid,
          isFullPaid: Boolean(isFullPaid) || (clampedPaid >= billTotal),
          billedBy,
          date: new Date(),
        });

        await historyDoc.save();
        await Purchase.deleteMany({ customerID });

        return res.json({ ok: true, message: "Purchase(s) moved to history", data: { billTotal, paid: clampedPaid, balance: balanceForThisBill } });
      }
      catch (err) {
        console.error("submittohistory error:", err);
        return res.status(500).json({ ok: false, message: "Failed to submit to history" });
      }
    }

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
      
      
      await History.deleteMany({customerID});
      
      
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
          
          purchaseObj.quantity = Number(purchaseObj.quantity) || 0;
          purchaseObj.kgPrice = Number(purchaseObj.kgPrice) || 0;
          purchaseObj.boxPrice = Number(purchaseObj.boxPrice) || 0;
          purchaseObj.totalPrice = Number(purchaseObj.totalPrice) || (
            purchaseObj.unit === 'kg' ? purchaseObj.kgPrice * purchaseObj.quantity : purchaseObj.boxPrice * purchaseObj.quantity
          );
          
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
    const history = await History.find({}).sort({ createdAt: -1 });
    return res.json({ok:true , data:history});
  }
  catch(err){
    console.log("Error fetching history" , err);
    return res.status(500).json({ok:false, message:"Error fetching history"});
  }
})

app.post("/user", async (req, res) => {
  try {
    const { userID, customerID, fishID, quantity, unit } = req.body;

    
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

    
    console.log("Purchase entry to save:", entry);

    await entry.save();
    
    
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





app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
