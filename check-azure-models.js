const { AzureOpenAI } = require('openai');

const AZURE_ENDPOINT = 'https://adavi-mf694jmx-eastus2.cognitiveservices.azure.com';
const AZURE_API_KEY = 'YOUR_AZURE_API_KEY_HERE';

async function checkAzureModels() {
  console.log('=== Azure OpenAI Diagnostic Check ===\n');
  console.log('Endpoint:', AZURE_ENDPOINT);
  console.log('Region: East US 2\n');

  // Test 1: Check if GPT-5-mini deployment works
  console.log('1. Testing GPT-5-mini deployment:');
  try {
    const response = await fetch(
      `${AZURE_ENDPOINT}/openai/deployments/gpt-5-mini/chat/completions?api-version=2024-08-01-preview`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': AZURE_API_KEY,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'test' }],
          max_completion_tokens: 10,
        }),
      }
    );
    if (response.ok) {
      console.log('✅ GPT-5-mini deployment is working\n');
    } else {
      const error = await response.text();
      console.log('❌ GPT-5-mini deployment error:', error, '\n');
    }
  } catch (error) {
    console.log('❌ GPT-5-mini connection error:', error.message, '\n');
  }

  // Test 2: Try different embedding model names
  const embeddingModels = [
    'text-embedding-ada-002',
    'text-embedding-3-small',
    'text-embedding-3-large',
    'ada',
    'embeddings',
    'text-embedding-ada'
  ];

  console.log('2. Testing embedding model deployments:');
  for (const modelName of embeddingModels) {
    try {
      const response = await fetch(
        `${AZURE_ENDPOINT}/openai/deployments/${modelName}/embeddings?api-version=2024-08-01-preview`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': AZURE_API_KEY,
          },
          body: JSON.stringify({
            input: 'test',
          }),
        }
      );
      
      if (response.ok) {
        console.log(`✅ "${modelName}" deployment exists and works!`);
        const data = await response.json();
        console.log(`   Embedding dimensions: ${data.data[0].embedding.length}`);
      } else {
        const errorText = await response.text();
        if (errorText.includes('DeploymentNotFound')) {
          console.log(`❌ "${modelName}" - deployment not found`);
        } else {
          console.log(`❌ "${modelName}" - other error:`, errorText.substring(0, 100));
        }
      }
    } catch (error) {
      console.log(`❌ "${modelName}" - connection error:`, error.message);
    }
  }

  console.log('\n3. Available model list (via API):');
  try {
    // Try to get models list
    const response = await fetch(
      `${AZURE_ENDPOINT}/openai/models?api-version=2024-08-01-preview`,
      {
        method: 'GET',
        headers: {
          'api-key': AZURE_API_KEY,
        },
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      console.log('Available models:', JSON.stringify(data, null, 2));
    } else {
      const error = await response.text();
      console.log('Could not retrieve models list:', error.substring(0, 200));
    }
  } catch (error) {
    console.log('Error getting models list:', error.message);
  }

  console.log('\n=== RECOMMENDATION ===');
  console.log('Based on the tests above, you need to:');
  console.log('1. Go to Azure Portal (https://portal.azure.com)');
  console.log('2. Navigate to your Azure OpenAI resource: adavi-mf694jmx-eastus2');
  console.log('3. Go to "Model deployments" section');
  console.log('4. Click "Deploy model" and select an embedding model');
  console.log('5. Common embedding models to deploy:');
  console.log('   - text-embedding-ada-002 (1536 dimensions)');
  console.log('   - text-embedding-3-small (1536 dimensions)');
  console.log('   - text-embedding-3-large (3072 dimensions)');
  console.log('6. Give it a deployment name (e.g., "embeddings" or "text-embedding-ada-002")');
  console.log('7. Once deployed, update the code with the correct deployment name');
}

checkAzureModels().catch(console.error);