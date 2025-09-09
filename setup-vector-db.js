// Script to set up pgvector and document chunks table
const { Client } = require('pg');
const fs = require('fs');

async function setupVectorDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://hipaa_gpt_db_user:GDHcLMxieiyb15s3Ni0xgeETEzJgRePI@dpg-d2tjrb0gjchc739ujee0-a.oregon-postgres.render.com/hipaa_gpt_db',
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to PostgreSQL...');
    await client.connect();
    console.log('✓ Connected successfully!\n');

    // Read SQL file
    const sql = fs.readFileSync('./setup-vector-database.sql', 'utf8');
    
    // Split by semicolons and execute each statement
    const statements = sql.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          console.log('Executing:', statement.substring(0, 50) + '...');
          await client.query(statement);
          console.log('✓ Success\n');
        } catch (err) {
          console.error('Warning:', err.message);
          // Continue even if some statements fail (e.g., extension already exists)
        }
      }
    }

    // Verify setup
    console.log('Verifying setup...');
    
    // Check if vector extension is installed
    const extResult = await client.query(`
      SELECT installed_version 
      FROM pg_available_extensions 
      WHERE name = 'vector'
    `);
    
    if (extResult.rows.length > 0) {
      console.log('✓ pgvector extension available');
    }

    // Check if table exists
    const tableResult = await client.query(`
      SELECT COUNT(*) 
      FROM information_schema.tables 
      WHERE table_name = 'document_chunks'
    `);
    
    if (tableResult.rows[0].count > 0) {
      console.log('✓ document_chunks table exists');
    }

    await client.end();
    
    console.log('\n✅ Vector database setup complete!');
    console.log('Ready to store and search document embeddings.');
    
  } catch (err) {
    console.error('❌ Setup error:', err);
    process.exit(1);
  }
}

setupVectorDatabase();