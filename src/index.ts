import express, { Request, Response } from "express";
import mysql from "mysql2/promise";
import { Client } from "ssh2";
import dotenv from "dotenv";
dotenv.config(); // โหลดไฟล์ .env
let db: mysql.Connection | null = null;

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT),
};

const sshConfig = {
  host: process.env.SSH_HOST,
  port: Number(process.env.SSH_PORT),
  username: process.env.SSH_USER,
  password: process.env.SSH_PASS,
};
const sshClient = new Client();
sshClient.connect(sshConfig);
const app = express();
const PORT = process.env.PORT || 3200;
main();
app.get("/", async (req: Request, res: Response) => {
  try {
    const result = await db?.query(
      "SELECT * FROM realtime_kg03_fixasset LIMIT 10"
    );
    res.json(result);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Opps has error from internal" });
  }
});
app.get("/gmac", async(req: Request, res: Response) => {
  let ids: string[] = [];
  if (typeof req.query.ids === "string") {
    ids = req.query.ids.split(",");
  } else if (Array.isArray(req.query.ids)) {
    ids = req.query.ids.flatMap(id => typeof id === "string" ? id.split(",") : []);
  } else {
    return res.status(400).json({ error: "Missing or invalid 'ids' query parameter" });
  }
  try {
    const placeholders = ids.map(() => "?").join(","); // "?,?"
    const result = await db?.query(
      `WITH ranked AS (
        SELECT t.*,
               ROW_NUMBER() OVER (PARTITION BY gmac ORDER BY updated_at DESC) AS rn,
               DATE_FORMAT(time, '%Y-%m-%d %H:%i:%s') AS time_readable 
        FROM realtime_kg03_fixasset t
        WHERE gmac IN (${placeholders})
      )
      SELECT *
      FROM ranked
      WHERE rn <= 10
      ORDER BY gmac, updated_at DESC;`, ids
    );
   // const result = await db?.query(`SELECT *, DATE_FORMAT(time, '%Y-%m-%d %H:%i:%s') AS time_readable FROM realtime_kg03_fixasset WHERE gmac IN (${placeholders}) ORDER BY updated_at DESC`, ids);
    if (result && Array.isArray(result)) {
      res.json(result[0]);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Opps has error from internal" });
    
  }
});
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
function main() {
  console.log("Connecting to SSH...");
  sshClient.on("ready", () => {
    console.log("SSH connection established.");

    sshClient.forwardOut(
      "127.0.0.1",
      0,
      process.env.DB_HOST!,
      Number(process.env.DB_PORT!),
      async (err, stream) => {
        if (err) {
          console.error("Error setting up SSH tunnel:", err.message);
          return;
        }
        // db = mysql.createConnection({
        //   ...dbConfig,
        //   stream, // ใช้ stream จาก SSH tunnel
        // });

        // db.connect((err) => {
        //   if (err) {
        //     console.error("Error connecting to MySQL:", err.message);
        //     return;
        //   }
        //   console.log("Connected to MySQL through SSH!");
        // });
        // สร้างการเชื่อมต่อฐานข้อมูลผ่าน SSH tunnel
        mysql
          .createConnection({
            ...dbConfig,
            stream,
          })
          .then((connection) => {
            db = connection;
            console.log("Database connection established through SSH tunnel.");
          })
          .catch((dbErr) => {
            console.error("Database connection error:", dbErr.message);
          });

        // db.then(() => {
        //   console.log("Database connection established through SSH tunnel.");
        // }).catch((dbErr) => {
        //   console.error("Database connection error:", dbErr.message);
        // });
        // console.log("SSH tunnel established. Connecting to database...");
        // db.then(() => {
        //   console.log("Database connection established through SSH tunnel.");
        // }).catch((dbErr) => {
        //   console.error("Database connection error:", dbErr.message);
        // });
      }
    );
  });
}
