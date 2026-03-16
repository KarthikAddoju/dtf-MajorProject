import express from "express"
import multer from "multer"
import { uploadToIPFS } from "../services/ipfs"

const router = express.Router()

// temporary local storage
const upload = multer({ dest: "uploads/" })

router.post("/", upload.single("certificate"), async (req, res) => {

  try {

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      })
    }

    const cid = await uploadToIPFS(req.file.path)

    res.json({
      success: true,
      cid
    })

  } catch (error) {

    console.error(error)

    res.status(500).json({
      success: false,
      message: "IPFS upload failed"
    })

  }

})

export default router