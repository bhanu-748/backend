const express = require("express");
const router = express.Router();

const {
  connectSourceDB,
  getSourceTables,
getSourceTableColumns
} = require("../controllers/sourceController");

router.post("/connect-source-db", connectSourceDB);
router.post("/get-source-tables", getSourceTables);

router.post("/get-source-columns", getSourceTableColumns);


module.exports = router;
