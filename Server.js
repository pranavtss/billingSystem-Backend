const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const PORT = 5000;

const Login = require("./schema/loginschema");
const Customer = require("./schema/customerschema");
const Fish = require("./schema/fishschema");

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


// --------------------- ADMIN ROUTE ---------------------

app.post("/admin", async (req, res) => {
  try {
    const { type } = req.body;

    if (type === "customer") {
      const { customerID, customername, customerphone } = req.body;
      if (!customerID || !customername || !customerphone) {
        return res.json({ message: "All customer fields are required" });
      }
      const newCustomer = new Customer({ customerID, customername, customerphone });
      await newCustomer.save();
      return res.json({ message: "Customer added successfully" });
    }


    if (type === "fish") {
      const { fishID, fishName, fishPrice } = req.body;
      if (!fishID || !fishName || fishPrice === undefined) {
        return res.json({ message: "All fish fields are required" });
      }
      const newFish = new Fish({ fishID, fishName, fishPrice });
      await newFish.save();
      return res.json({ message: "Fish added successfully" });
    }
    

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
    return res.json({ message: "Invalid type" });

  } catch (err) {
    console.error(err);
    return res.json({ message: "Internal server error" });
  }
});

app.patch("/admin", async (req, res) => {
  try {
    const { type } = req.body;
    if (type === "editfish") {
      const { fishID, newprice } = req.body;
      if (!fishID || newprice === undefined) {
        return res.json({ message: "Fish ID and new price are required" });
      }
      const price = new FishPrice({fishID , newprice});
      await price.save();

      return res.json({ message: "Fish price updated successfully" });
    }

    return res.json({ message: "Invalid type" });
  } catch (err) {
    console.error(err);
    return res.json({ message: "Internal server error" });
  }
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

//---------------------------------get-----------------------------------------


app.get("/admin" , async(req,res) => {
  try{
    const {type} = req.query;

    if(type === "fish"){
      const fishes = await Fish.find({});
      res.json(fishes);
    }

  } catch (err) {
    console.error(err);
    res.json({ message: "Internal server error" });
  }
})







// --------------------- START SERVER ---------------------
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
