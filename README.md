# Lumoryn Billing – Backend

Node.js / Express REST API for the **Lumoryn Billing** application — a billing and sales management system designed specifically for **fish shop workflows**.

This backend handles authentication, customers, fish catalog, billing, purchases, and sales history. The database is **cloud‑deployed using MongoDB Atlas**.

---

## 🚀 Project Overview

The backend is built to support a **single-admin billing flow**, matching real fish shop operations:

* One staff member handles billing
* Other staff focus on weighing fish and order delivery
* Simple schemas and fast API responses for counter usage

This repository contains **only the backend API**.

---

## 🔗 Frontend Repository

The frontend is built with **React + Vite**.

👉 **Frontend GitHub Repository:**
[BillingSytem Frontend Repo Link](https://github.com/pranavtss/billingSystem.git)

---

## 🛠️ Tech Stack

* **Node.js**
* **Express.js**
* **MongoDB Atlas** (cloud database)
* **Mongoose** (ODM)

---

## 📦 Features

* User authentication (admin login)
* Customer management
* Fish catalog management (add/edit/delete)
* Purchase and billing records
* Sales history tracking
* Clean schema-based data modeling

---

## ⚙️ Requirements

* Node.js **18+**
* MongoDB Atlas account (or MongoDB local for development)

---

## Render Deployment (Backend)

1. Push your backend branch to GitHub.
2. In Render, click **New +** → **Web Service**.
3. Connect repository: `pranavtss/billingSystem-Backend`.
4. Use these settings:
  * **Environment**: Node
  * **Build Command**: `npm install`
  * **Start Command**: `npm start`
  * **Plan**: Free (or higher)
5. Add environment variables in Render:
  * `MONGODB_URI` = your Atlas URI (with `/billingSystem` DB name)
  * `JWT_SECRET` = strong random string
  * `ADMIN_ID` = admin
  * `ADMIN_PASSWORD` = admin123 (change in production)
  * `ADMIN_USERNAME` = Administrator
  * `FRONTEND_ORIGIN` = your deployed frontend URL (exact URL)
6. Deploy and verify:
  * `https://<your-backend>.onrender.com/healthz`
  * `https://<your-backend>.onrender.com/readyz`

Note: Render injects `PORT` automatically. Server is configured to use `process.env.PORT`.

---

## 🔐 Environment Variables

Create a `.env` file in the root directory:

```env
MONGODB_URI=your_mongodb_atlas_connection_string
PORT=5000
```

If `PORT` is not specified, the server defaults to **5000**.

---

## ▶️ Setup & Run

1. Clone the repository

```bash
git clone https://github.com/pranavtss/billingSystem-Backend.git
```

2. Navigate to the project folder

```bash
cd billingSystem-Backend
```

3. Install dependencies

```bash
npm install
```

4. Start the server

```bash
npm start
```

Server will run at:

```
http://localhost:5000
```

---

## 📡 API Endpoints (Overview)

### Authentication

* `POST /` — Admin login
  **Body:** `userID`, `userpassword`

### Admin Operations

* `GET /admin?type=customer|purchase|fish|user` — Fetch collections
* `POST /admin` — Add/edit fish, customers, users, bills, submit to history
* `DELETE /admin` — Delete fish, customers, users, bill items

### User Operations

* `POST /user` — Record a customer purchase

---

## 📁 Project Structure

```
Server.js        # Express app entry point
schema/          # Mongoose models
package.json     # Dependencies & scripts
```

---

## 🧪 Development Tips

* Use **Postman** for testing
* Ensure MongoDB Atlas IP whitelist allows your connection
* API will fail fast if DB connection is unavailable

---

## 📌 Notes

* Built for **real-world small business usage**
* Designed to align with fish shop operational needs
* Future scope: role-based access, analytics, and performance optimization

---

## 📜 License

This project is intended for **educational and learning purposes**.

⭐ If you find this project useful, consider starring the repository!
