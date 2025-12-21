const express = require("express");
const cors = require("cors");

// Import Routes
const sourceRoutes = require("./routes/sourceRoutes");
const destinationRoutes = require("./routes/destinationRoutes");
const migrationRoutes = require("./routes/migrationRoutes");



const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend is working 👍");
});

// Source DB APIs
app.use("/source", sourceRoutes);
app.use("/destination", destinationRoutes);
app.use("/migration", migrationRoutes);



app.listen(5000, () => {
  console.log("Server running on port 5000");
});
