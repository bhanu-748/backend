const { createClient } = require("../config/dbClient");

exports.migrateData = async (req, res) => {
  const { source, destination, mapping } = req.body;

  // --------------------- VALIDATION LAYER ---------------------
  if (!source || !destination) {
    return res.json({
      success: false,
      message: "Source and Destination configuration is required ❌",
    });
  }

  if (!source.table || !destination.table) {
    return res.json({
      success: false,
      message: "Source and Destination tables must be selected ❌",
    });
  }

  if (!mapping || Object.keys(mapping).length === 0) {
    return res.json({
      success: false,
      message: "Column mapping is required ❌",
    });
  }

  const sourceClient = createClient(source);
  const destClient = createClient(destination);

  try {
    await sourceClient.connect();
    await destClient.connect();

    const sourceTable = `"${source.table}"`;
    const destinationTable = `"${destination.table}"`;

    // --------------------- VALIDATE COLUMNS EXIST ---------------------
    const srcColsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='${source.table}'
    `;
    const destColsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='${destination.table}'
    `;

    const srcColsResult = await sourceClient.query(srcColsQuery);
    const destColsResult = await destClient.query(destColsQuery);

    const srcCols = srcColsResult.rows.map(r => r.column_name);
    const destCols = destColsResult.rows.map(r => r.column_name);

    // Validate source mapping columns exist
    for (let col of Object.keys(mapping)) {
      if (!srcCols.includes(col)) {
        return res.json({
          success: false,
          message: `Source column '${col}' does not exist ❌`,
        });
      }
    }

    // Validate destination mapping columns exist
    for (let col of Object.values(mapping)) {
      if (!destCols.includes(col)) {
        return res.json({
          success: false,
          message: `Destination column '${col}' does not exist ❌`,
        });
      }
    }

    // --------------------- FETCH SOURCE DATA ---------------------
    const sourceResult = await sourceClient.query(
      `SELECT * FROM ${sourceTable}`
    );

    const rows = sourceResult.rows;

    if (rows.length === 0) {
      return res.json({
        success: true,
        message: "No data found in source table",
        totalRecords: 0,
      });
    }

    // --------------------- PREPARE INSERT ---------------------
    const sourceColumns = Object.keys(mapping);
    const destColumns = Object.values(mapping);

    const insertQuery = `
      INSERT INTO ${destinationTable} (${destColumns.join(",")})
      VALUES (${destColumns.map((_, i) => `$${i + 1}`).join(",")})
      ON CONFLICT DO NOTHING
    `;

    let successCount = 0;
    let failCount = 0;

    // --------------------- INSERT RECORDS ---------------------
    for (const row of rows) {
      const values = sourceColumns.map((col) => row[col]);

      try {
        await destClient.query(insertQuery, values);
        successCount++;
      } catch (err) {
        console.error("Insert failed:", err.message);
        failCount++;
      }
    }

    return res.json({
      success: true,
      message: "Migration Completed 👍",
      totalRecords: rows.length,
      inserted: successCount,
      failed: failCount,
      skippedDuplicates: rows.length - successCount - failCount,
    });

  } catch (err) {
    console.error("Migration Failed ❌", err);

    return res.json({
      success: false,
      message: "Migration Failed ❌",
      error: err.message,
    });

  } finally {
    await sourceClient.end();
    await destClient.end();
  }
};
