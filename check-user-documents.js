// Script to check what data exists in user_documents table
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://hipaa_gpt_db_user:GDHcLMxieiyb15s3Ni0xgeETEzJgRePI@dpg-d2tjrb0gjchc739ujee0-a.oregon-postgres.render.com/hipaa_gpt_db',
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkUserDocuments() {
  try {
    console.log('Connecting to PostgreSQL...');
    await client.connect();
    console.log('✓ Connected successfully!\n');

    console.log('Fetching documents from user_documents table...\n');
    const result = await client.query(`
      SELECT user_id, document_id, filename, LEFT(data, 100) as preview, created_at
      FROM user_documents 
      ORDER BY created_at DESC
    `);
    
    if (result.rows.length === 0) {
      console.log('No documents found in user_documents table.');
    } else {
      console.log(`Found ${result.rows.length} document(s):\n`);
      console.log('══════════════════════════════════════════════════════════════════════');
      
      result.rows.forEach((row, index) => {
        console.log(`Document ${index + 1}:`);
        console.log(`  User ID:     ${row.user_id}`);
        console.log(`  Document ID: ${row.document_id}`);
        console.log(`  Filename:    ${row.filename}`);
        console.log(`  Preview:     ${row.preview}...`);
        console.log(`  Created:     ${row.created_at}`);
        console.log('──────────────────────────────────────────────────────────────────────');
      });
    }

    await client.end();
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

checkUserDocuments();