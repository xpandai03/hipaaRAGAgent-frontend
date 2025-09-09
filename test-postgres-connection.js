// Quick test script to verify PostgreSQL RAG setup
// Run with: node test-postgres-connection.js

const { Client } = require('pg');

// Your Render database connection
const client = new Client({
  connectionString: 'postgresql://hipaa_gpt_db_user:GDHcLMxieiyb15s3Ni0xgeETEzJgRePI@dpg-d2tjrb0gjchc739ujee0-a.oregon-postgres.render.com/hipaa_gpt_db',
  ssl: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  try {
    console.log('Connecting to PostgreSQL...');
    await client.connect();
    console.log('✓ Connected successfully!\n');

    // Test if documents table exists
    console.log('Checking for documents table...');
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'documents'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('✗ Documents table not found. Run setup-rag-database.sql first.\n');
      await client.end();
      return;
    }
    console.log('✓ Documents table exists!\n');

    // Test search query
    console.log('Testing search for "diabetes"...');
    const searchResult = await client.query(
      "SELECT content, metadata FROM documents WHERE content ILIKE $1 LIMIT 5",
      ['%diabetes%']
    );

    if (searchResult.rows.length > 0) {
      console.log(`✓ Found ${searchResult.rows.length} document(s):\n`);
      searchResult.rows.forEach((doc, i) => {
        console.log(`Document ${i + 1}:`);
        console.log(`Content: ${doc.content.substring(0, 100)}...`);
        console.log(`Metadata: ${JSON.stringify(doc.metadata)}\n`);
      });
    } else {
      console.log('✗ No documents found. You may need to insert sample data.\n');
    }

    await client.end();
    console.log('Test completed successfully!');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

testConnection();