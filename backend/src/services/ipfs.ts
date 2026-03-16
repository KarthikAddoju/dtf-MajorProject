import axios from "axios";
import FormData from "form-data";
import fs from "fs";

export async function uploadToIPFS(filePath: string) {
  const data = new FormData();

  data.append("file", fs.createReadStream(filePath));

  const res = await axios.post(
    "https://api.pinata.cloud/pinning/pinFileToIPFS",
    data,
    {
      headers: {
        Authorization: `Bearer ${process.env.PINATA_JWT}`,
        ...data.getHeaders(),
      },
    }
  );

  return res.data.IpfsHash;
}