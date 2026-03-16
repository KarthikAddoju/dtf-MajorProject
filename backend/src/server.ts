import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import uploadRoutes from "./routes/upload"

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json())

// routes
app.use("/upload", uploadRoutes)

app.get("/", (req, res) => {
  res.send("DACS Backend Running")
})

const PORT = 5000

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
