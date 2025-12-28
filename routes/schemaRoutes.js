const express = require("express");
const router = express.Router();

const { getRelationships } = require("../controllers/schemaController");

router.post("/get-relationships", getRelationships);

module.exports = router;
