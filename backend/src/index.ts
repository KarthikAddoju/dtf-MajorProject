import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import mintRoute from "./routes/mint";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 4000;

mongoose.connect("mongodb://127.0.0.1:27017/dtf")
.then(() => {
    console.log("MongoDB Connected");
    app.get("/", (req, res) => {
        res.send("Backend is running 🚀");
      });
    app.use("/api/mint", mintRoute);
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
})
.catch(err => console.error(err));