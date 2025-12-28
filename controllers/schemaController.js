const { createClient } = require("../config/dbClient");

exports.getRelationships = async (req, res) => {
  const config = req.body;

  const client = createClient(config);

  try {
    await client.connect();

    const query = `
      SELECT
        tc.table_name AS source_table,
        kcu.column_name AS source_column,
        ccu.table_name AS target_table,
        ccu.column_name AS target_column
      FROM 
        information_schema.table_constraints AS tc
      JOIN 
        information_schema.key_column_usage AS kcu
      ON 
        tc.constraint_name = kcu.constraint_name
      JOIN 
        information_schema.constraint_column_usage AS ccu
      ON 
        ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY';
    `;

    const result = await client.query(query);

    res.json({
      success: true,
      relationships: result.rows
    });

  } catch (err) {
    console.log("❌ Relationship fetch failed:", err);
    res.json({
      success: false,
      message: "Failed to fetch DB relationships",
      error: err.message
    });
  } finally {
    try { await client.end(); } catch {}
  }
};
