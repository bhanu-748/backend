const { createClient } = require("../config/dbClient");

// ------------------ TEST CONNECTION ------------------
exports.connectSourceDB = async (req, res) => {
  const client = createClient(req.body);

  try {
    await client.connect();
    res.json({ success: true, message: "Connected to Source DB 👍" });
    await client.end();
  } catch (err) {
    console.error(err);
    res.json({
      success: false,
      message: "Failed to connect ❌",
      error: err.message,
    });
  }
};

// ------------------ GET TABLES ------------------
exports.getSourceTables = async (req, res) => {
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
      message: "Failed to fetch tables ❌",
      error: err.message
    });
  }
};

// ------------------ GET COLUMNS OF SELECTED TABLE ------------------
exports.getSourceTableColumns = async (req, res) => {
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
      message: "Failed to fetch columns ❌",
      error: err.message
    });
  }
};

