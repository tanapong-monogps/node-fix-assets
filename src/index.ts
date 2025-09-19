import express, { Request, Response } from "express";
import mysql from "mysql2/promise";
import { Client } from "ssh2";
let db: mysql.Connection | null = null;

const dbConfig = {
  host: "127.0.0.1", // ใช้ localhost เพราะเชื่อมต่อผ่าน SSH Tunnel
  user: "admin_payroll",
  password: "@m0n0St0ck4dm1n#",
  database: "db_fixassets",
  port: 3306,
};
const sshConfig = {
  host: "8.213.196.146", // IP หรือ hostname ของ SSH server
  port: 22, // พอร์ต SSH (ค่าเริ่มต้นคือ 22)
  username: "root",
  password: "M0n0G5SsR3alt1m3@Ali", // หรือใช้ privateKey แทน password
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
      dbConfig.host,
      dbConfig.port,
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
