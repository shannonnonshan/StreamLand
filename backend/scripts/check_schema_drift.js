const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function parseSchema(schemaText) {
  const modelNames = new Set();
  const enumNames = new Set();
  const models = {};

  const lines = schemaText.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    const modelMatch = line.match(/^model\s+(\w+)\s+\{/);
    const enumMatch = line.match(/^enum\s+(\w+)\s+\{/);
    if (modelMatch) {
      const name = modelMatch[1];
      modelNames.add(name);
      i++;
      const fields = [];
      let mapName = null;
      while (i < lines.length && !lines[i].trim().startsWith('}')) {
        const ln = lines[i].trim();
        // capture @@map("table")
        const mapMatch = ln.match(/^@@map\((?:"|')(.*?)(?:"|')\)/);
        if (mapMatch) {
          mapName = mapMatch[1];
        }
        // skip comments and empty
        if (!ln || ln.startsWith('//')) { i++; continue; }
        // field line
        const fieldLineMatch = ln.match(/^(\w+)\s+(\w+\[?\]?)/);
        if (fieldLineMatch) {
          const fieldName = fieldLineMatch[1];
          const typeToken = fieldLineMatch[2];
          fields.push({ name: fieldName, type: typeToken, raw: ln });
        }
        i++;
      }
      models[name] = { fields, mapName };
    } else if (enumMatch) {
      enumNames.add(enumMatch[1]);
      i++;
      // skip enum body
      while (i < lines.length && !lines[i].trim().startsWith('}')) i++;
    } else {
      i++;
    }
  }

  return { models, modelNames, enumNames };
}

(async function main() {
  try {
    const schemaPath = path.resolve(__dirname, '..', 'prisma', 'postgres', 'schema.prisma');
    const schemaText = fs.readFileSync(schemaPath, 'utf8');
    const { models, modelNames, enumNames } = parseSchema(schemaText);

    const results = [];

    for (const [modelName, { fields, mapName }] of Object.entries(models)) {
      // Decide table name candidates
      const candidates = [];
      if (mapName) candidates.push(mapName);
      candidates.push(modelName.toLowerCase());
      candidates.push(modelName.toLowerCase() + 's');

      let foundTable = null;
      let dbColumns = [];
      for (const tbl of candidates) {
        const rows = await prisma.$queryRawUnsafe(
          `SELECT column_name FROM information_schema.columns WHERE table_name='${tbl}' ORDER BY ordinal_position`
        ).catch(() => null);
        if (rows && rows.length) {
          foundTable = tbl;
          dbColumns = rows.map(r => r.column_name);
          break;
        }
      }

      if (!foundTable) continue; // table not present in DB

      // compute expected scalar columns
      const expected = [];
      for (const f of fields) {
        const { name, type, raw } = f;
        // skip relation fields: lines containing @relation(
        if (raw.includes('@relation(')) continue;
        // skip relation lists where base type is another model
        const baseType = type.replace(/\[\]/, '');
        if (modelNames.has(baseType)) continue;
        // otherwise it's a column
        expected.push(name);
      }

      const missing = expected.filter(e => !dbColumns.includes(e));
      const extra = dbColumns.filter(c => !expected.includes(c) && c !== 'id');

      results.push({ model: modelName, table: foundTable, missing, extra });
    }

    console.log(JSON.stringify(results, null, 2));

    // pretty print summary
    const issues = results.filter(r => r.missing.length || r.extra.length);
    if (issues.length === 0) {
      console.log('No drift detected for mapped tables.');
    } else {
      console.log('Drift summary:');
      for (const it of issues) {
        console.log(`- Model ${it.model} (table ${it.table}): missing columns: ${it.missing.join(', ') || '-'}; extra columns: ${it.extra.join(', ') || '-'} `);
      }
    }
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
