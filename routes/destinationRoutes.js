const express = require("express");
const router = express.Router();

const {
  connectDestinationDB,
  getDestinationTables,
  getDestinationColumns
} = require("../controllers/destinationController");

router.post("/connect-destination-db", connectDestinationDB);
router.post("/get-destination-tables", getDestinationTables);
router.post("/get-destination-columns", getDestinationColumns);

module.exports = router;
