import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import path from "path";
import emailRoutes from "./routes/emailRoutes.js";
import { cookieMiddleware } from "./middleware/cookieMiddleware.js";

// Import routes
import authRoutes from './routes/authRoutes.js';
import trainerRoutes from './routes/trainerRoutes.js';
import productRoutes from './routes/productRoutes.js';
import planRoutes from './routes/planRoutes.js';


dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Global Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cookieMiddleware);

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/kovij-fitness-zone")
  .then(() => console.log("MongoDB connected"))
  .catch(error => console.error("MongoDB connection error:", error));


const __dirname = path.resolve();

app.use(express.static(path.join(__dirname,'/kovij-fitness-zone/dist')));

app.get('*',(req,res)=>{
  res.sendFile(path.join(__dirname,'kovij-fitness-zone','dist','index.html'))
})




// Use API routes
app.use("/api", emailRoutes);

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/trainers', trainerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/plans', planRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
