const { createClient } = require("../config/dbClient");

exports.migrateData = async (req, res) => {
  const { source, destination, mapping } = req.body;

  const sourceClient = createClient(source);
  const destClient = createClient(destination);

  try {
    await sourceClient.connect();
    await destClient.connect();

    const sourceTable = `"${source.table}"`;
    const destinationTable = `"${destination.table}"`;

    // 1️⃣ Fetch source rows
    const sourceResult = await sourceClient.query(
      `SELECT * FROM ${sourceTable}`
    );

    const rows = sourceResult.rows;

    if (rows.length === 0) {
      await sourceClient.end();
      await destClient.end();

      return res.json({
        success: true,
        message: "No data found in source table",
        totalRecords: 0
      });
    }

    // 2️⃣ Prepare insert structure
    const sourceColumns = Object.keys(mapping);     
    const destColumns = Object.values(mapping);     

    const insertQuery = `
      INSERT INTO ${destinationTable} (${destColumns.join(",")})
      VALUES (${destColumns.map((_, i) => `$${i + 1}`).join(",")})
      ON CONFLICT DO NOTHING
    `;

    let successCount = 0;
    let failCount = 0;

    // 3️⃣ Insert each record
    for (const row of rows) {
      const values = sourceColumns.map(col => row[col]);

      try {
        await destClient.query(insertQuery, values);
        successCount++;
      } catch (err) {
        console.error("Insert failed:", err.message);
        failCount++;
      }
    }

    await sourceClient.end();
    await destClient.end();

    res.json({
      success: true,
      message: "Migration Completed 👍",
      totalRecords: rows.length,
      successCount,
      failCount
    });

  } catch (err) {
    console.error("Migration Failed ❌", err);

    await sourceClient.end();
    await destClient.end();

    res.json({
      success: false,
      message: "Migration Failed ❌",
      error: err.message
    });
  }
};
