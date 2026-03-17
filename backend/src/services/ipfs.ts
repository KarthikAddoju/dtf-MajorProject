import axios from "axios";
import FormData from "form-data";
import fs from "fs";

export async function uploadToIPFS(filePath: string) {
  const pinataJwt = process.env.PINATA_JWT;

  if (!pinataJwt) {
    throw new Error("PINATA_JWT is not configured");
  }

  const data = new FormData();

  data.append("file", fs.createReadStream(filePath));

  const res = await axios.post(
    "https://api.pinata.cloud/pinning/pinFileToIPFS",
    data,
    {
      headers: {
        Authorization: `Bearer ${pinataJwt}`,
        ...data.getHeaders(),
      },
      maxBodyLength: Infinity,
    }
  );

  return res.data.IpfsHash;
}
