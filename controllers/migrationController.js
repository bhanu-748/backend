const { createClient } = require("../config/dbClient");

exports.migrateData = async (req, res) => {
  console.log("📥 Incoming Migration Payload:", req.body);

  const { source, destination, mapping, autoJoin } = req.body;

  if (!source || !destination)
    return res.json({ success: false, message: "Source & Destination required ❌" });

  if (!destination.table)
    return res.json({ success: false, message: "Destination table required ❌" });

  if (!mapping || Object.keys(mapping).length === 0)
    return res.json({ success: false, message: "Column mapping required ❌" });

  const sourceTables =
    source.tables?.length ? source.tables :
    source.table ? [source.table] : [];

  if (!sourceTables.length)
    return res.json({ success: false, message: "No source tables provided ❌" });

  const sourceClient = createClient(source);
  const destClient   = createClient(destination);

  try {
    await sourceClient.connect();
    await destClient.connect();

    const destinationTable = `"${destination.table}"`;

    // ---------------- Validate Destination Columns ----------------
    const destColsResult = await destClient.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='${destination.table}'
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

    const destColumns = Object.values(mapping);

    const insertQuery = `
      INSERT INTO ${destinationTable} (${destColumns.join(",")})
      VALUES (${destColumns.map((_, i) => `$${i + 1}`).join(",")})
      ON CONFLICT DO NOTHING
    `;

    let totalRecords = 0;
    let inserted = 0;
    let failed = 0;

    // =====================================================================
    // ⭐⭐⭐ AUTO JOIN MODE (FINAL — FULLY FIXED) ⭐⭐⭐
    // =====================================================================
    if (autoJoin) {
      console.log("🚀 AUTO JOIN ENABLED");

      const rootTable = sourceTables[0];

      const fkQuery = `
        SELECT 
          tc.table_name   AS child_table,
          kcu.column_name AS child_col,
          ccu.table_name  AS parent_table,
          ccu.column_name AS parent_col
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu 
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND (tc.table_name IN (${sourceTables.map(t => `'${t}'`).join(",")})
        OR   ccu.table_name IN (${sourceTables.map(t => `'${t}'`).join(",")}))
      `;

      const relations = await sourceClient.query(fkQuery);

      if (!relations.rows.length) {
        return res.json({
          success: false,
          message: "No FK relationships found between selected tables ❌"
        });
      }

      // ---------------- Cache Columns For Each Table ----------------
      const tableColumnMap = {};

      for (const table of sourceTables) {
        const cols = await sourceClient.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name='${table}'
        `);
        tableColumnMap[table] = cols.rows.map(c => c.column_name);
      }

      // ---------------- Build SELECT Columns ----------------
      const selectCols = [];

      for (let srcCol of Object.keys(mapping)) {
        const foundTable = Object.keys(tableColumnMap)
          .find(tbl => tableColumnMap[tbl].includes(srcCol));

        if (foundTable) {
          selectCols.push(`${foundTable}.${srcCol} AS ${srcCol}`);
        }
      }

      if (!selectCols.length) {
        return res.json({
          success: false,
          message: "No mapped columns exist in selected tables ❌"
        });
      }

      // ---------------- SMART JOIN GRAPH BUILDER ----------------
      let sql = `SELECT ${selectCols.join(", ")} FROM ${rootTable}`;
      const joined = new Set([rootTable]);

      let changed = true;

      while (changed) {
        changed = false;

        for (const r of relations.rows) {
          const { child_table, child_col, parent_table, parent_col } = r;

          // Case 1 → we have child → join parent
          if (joined.has(child_table) && !joined.has(parent_table)) {
            sql += `
              LEFT JOIN ${parent_table}
              ON ${child_table}.${child_col} = ${parent_table}.${parent_col}
            `;
            joined.add(parent_table);
            changed = true;
          }

          // Case 2 → we have parent → join child
          else if (joined.has(parent_table) && !joined.has(child_table)) {
            sql += `
              LEFT JOIN ${child_table}
              ON ${child_table}.${child_col} = ${parent_table}.${parent_col}
            `;
            joined.add(child_table);
            changed = true;
          }
        }
      }

      console.log("AUTO JOIN SQL:\n", sql);

      const joinedData = await sourceClient.query(sql);
      totalRecords = joinedData.rows.length;

      for (const row of joinedData.rows) {
        try {
          const values = Object.keys(mapping).map(c => row[c] ?? null);
          await destClient.query(insertQuery, values);
          inserted++;
        } catch {
          failed++;
        }
      }

      return res.json({
        success: true,
        message: "Auto Join Migration Completed 👍",
        totalRecords,
        inserted,
        failed,
        skippedDuplicates: totalRecords - inserted - failed
      });
    }

    // =====================================================================
    // ⭐⭐⭐ NORMAL MULTI-TABLE (NO JOIN) APPEND ⭐⭐⭐
    // =====================================================================
    console.log("👉 Running simple multi-table migration...");

    for (const table of sourceTables) {
      const result = await sourceClient.query(`SELECT * FROM "${table}"`);
      const rows = result.rows;

      totalRecords += rows.length;

      const availableCols = Object.keys(mapping).filter(c =>
        rows[0] && rows[0].hasOwnProperty(c)
      );

      for (const row of rows) {
        try {
          const values = availableCols.map(c => row[c] ?? null);
          await destClient.query(insertQuery, values);
          inserted++;
        } catch {
          failed++;
        }
      }
    }

    return res.json({
      success: true,
      message: "Multi-table Migration Completed 👍",
      totalRecords,
      inserted,
      failed,
      skippedDuplicates: totalRecords - inserted - failed
    });

  } catch (err) {
    console.log("Migration Failed ❌", err);
    return res.json({ success: false, message: err.message });

  } finally {
    try { await sourceClient.end(); } catch {}
    try { await destClient.end(); } catch {}
  }
};
