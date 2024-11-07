import { Server } from "socket.io";
import http from "http"; // لإستخدام HTTP Server
import express from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";
import pg from "pg";
import adminRoutes from "./routes/adminRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import commonRoutes from "./routes/commonRoutes.js";
import technicianRoutes from "./routes/technicianRoutes.js";
import testRoute from "./routes/testRoute.js";

dotenv.config();

const pgUrl = process.env.DATABASE_URL;
const PORT = process.env.PORT || 5000;

//Client configuration
const { Client } = pg;
const client = new Client(pgUrl);

const app = express();

// Create HTTP Server using with Socket.io
const server = http.createServer(app);
//Allow access from any source (make sure to set this value when using in production)
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(cors());
app.use(express.json());

//Image
app.use("/image", express.static("upload/images"));
//ROUTES:
app.use("/admin", adminRoutes);
app.use("/customers", customerRoutes);
app.use("/technician", technicianRoutes);
app.use("/common", commonRoutes);
app.use("/test", testRoute);

// connect Socket.io for notifications
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  //listen to events
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

//listener
client
  .connect()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server is listening on ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
  });

export { client, io };
