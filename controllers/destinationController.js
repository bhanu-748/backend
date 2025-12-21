const { createClient } = require("../config/dbClient");

// ------------------ TEST CONNECTION ------------------
exports.connectDestinationDB = async (req, res) => {
  const client = createClient(req.body);

  try {
    await client.connect();
    res.json({ success: true, message: "Connected to Destination DB 👍" });
    await client.end();
  } catch (err) {
    console.error(err);
    res.json({
      success: false,
      message: "Failed to connect Destination DB ❌",
      error: err.message,
    });
  }
};

// ------------------ GET DESTINATION TABLES ------------------
exports.getDestinationTables = async (req, res) => {
  const client = createClient(req.body);

  try {
    await client.connect();

    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables
      WHERE table_schema = 'public';
    `);

    await client.end();

    res.json({
      success: true,
      tables: result.rows
    });

  } catch (err) {
    console.error(err);
    res.json({
      success: false,
      message: "Failed to fetch destination tables ❌",
      error: err.message
    });
  }
};

// ------------------ GET DESTINATION COLUMNS ------------------
exports.getDestinationColumns = async (req, res) => {
  const { host, port, user, password, database, tableName } = req.body;

  const client = createClient({ host, port, user, password, database });

  try {
    await client.connect();

    const result = await client.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = $1`,
      [tableName]
    );

    await client.end();

    res.json({
      success: true,
      columns: result.rows
    });

  } catch (err) {
    console.error(err);
    res.json({
      success: false,
      message: "Failed to fetch destination columns ❌",
      error: err.message
    });
  }
};
