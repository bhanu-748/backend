const { createClient } = require("../config/dbClient");

exports.migrateData = async (req, res) => {
  const { source, destination, mapping } = req.body;

  if (!source || !destination) {
    return res.json({
      success: false,
      message: "Source and Destination configuration is required ❌",
    });
  }

  if (!destination.table) {
    return res.json({
      success: false,
      message: "Destination table must be selected ❌",
    });
  }

  if (!mapping || Object.keys(mapping).length === 0) {
    return res.json({
      success: false,
      message: "Column mapping is required ❌",
    });
  }

  const sourceTables =
    source.tables && source.tables.length > 0
      ? source.tables
      : source.table
      ? [source.table]
      : [];

  if (sourceTables.length === 0) {
    return res.json({
      success: false,
      message: "No source tables provided ❌",
    });
  }

  const sourceClient = createClient(source);
  const destClient = createClient(destination);

  try {
    await sourceClient.connect();
    await destClient.connect();

    const destinationTable = `"${destination.table}"`;

    // ✅ Validate DESTINATION columns only
    const destColsResult = await destClient.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema='public' 
      AND table_name='${destination.table}'
    `);
    const destCols = destColsResult.rows.map(r => r.column_name);

    for (let col of Object.values(mapping)) {
      if (!destCols.includes(col)) {
        return res.json({
          success: false,
          message: `Destination column '${col}' does not exist ❌`,
        });
      }
    }

    let totalRecords = 0;
    let inserted = 0;
    let failed = 0;

    // 🔥 PROCESS EACH SOURCE TABLE
    for (const table of sourceTables) {
      const tableName = `"${table}"`;

      const srcColsResult = await sourceClient.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema='public' 
        AND table_name='${table}'
      `);

      const srcCols = srcColsResult.rows.map(r => r.column_name);

      // ✅ Pick only mappings that exist in this table
      const validMappings = Object.keys(mapping)
        .filter(src => srcCols.includes(src))
        .reduce((obj, key) => {
          obj[key] = mapping[key];
          return obj;
        }, {});

      // If this table has nothing mapped → skip
      if (!Object.keys(validMappings).length) continue;

      const sourceColumns = Object.keys(validMappings);
      const destColumns = Object.values(validMappings);

      const insertQuery = `
        INSERT INTO ${destinationTable} (${destColumns.join(",")})
        VALUES (${destColumns.map((_, i) => `$${i + 1}`).join(",")})
        ON CONFLICT DO NOTHING
      `;

      const result = await sourceClient.query(`SELECT * FROM ${tableName}`);
      const rows = result.rows;
      totalRecords += rows.length;

      for (const row of rows) {
        try {
          const values = sourceColumns.map(col => row[col] ?? null);
          await destClient.query(insertQuery, values);
          inserted++;
        } catch (err) {
          console.log(`Insert failed in table ${table}:`, err.message);
          failed++;
        }
      }
    }

    return res.json({
      success: true,
      message: "Multi-table Migration Completed 👍",
      totalRecords,
      inserted,
      skippedDuplicates: totalRecords - inserted - failed,
      failed,
    });

  } catch (err) {
    console.error("Migration Failed ❌", err);

    return res.json({
      success: false,
      message: "Migration Failed ❌",
      error: err.message,
    });

  } finally {
    try { await sourceClient.end(); } catch {}
    try { await destClient.end(); } catch {}
  }
};
