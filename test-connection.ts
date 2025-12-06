#!/usr/bin/env npx tsx

/**
 * Test script to verify Apito MCP server connection
 */

import { ApitoGraphQLClient } from './src/graphql-client.js';

const endpoint = process.env.APITO_GRAPHQL_ENDPOINT || 'http://localhost:5050/secured/graphql';
const apiKey = process.env.APITO_API_KEY || process.env.APITO_AUTH_TOKEN || '';

if (!apiKey) {
  console.error('Error: APITO_API_KEY or APITO_AUTH_TOKEN environment variable is required');
  process.exit(1);
}

async function testConnection() {
  console.log('Testing Apito MCP Server Connection...\n');
  console.log(`Endpoint: ${endpoint}`);
  console.log(`API Key: ${apiKey.substring(0, 20)}...\n`);

  try {
    const client = new ApitoGraphQLClient(endpoint, apiKey);
    
    console.log('1. Testing getProjectModelsInfo (list models)...');
    const models = await client.getProjectModelsInfo();
    console.log(`✅ Found ${models.length} model(s):\n`);
    
    if (models.length === 0) {
      console.log('   No models found in the project.');
    } else {
      models.forEach((model, index) => {
        const fieldCount = model.fields?.length || 0;
        console.log(`   ${index + 1}. ${model.name}`);
        console.log(`      Fields: ${fieldCount}`);
        if (fieldCount > 0 && fieldCount <= 5) {
          model.fields?.forEach(field => {
            console.log(`         - ${field.identifier} (${field.field_type})`);
          });
        } else if (fieldCount > 5) {
          model.fields?.slice(0, 3).forEach(field => {
            console.log(`         - ${field.identifier} (${field.field_type})`);
          });
          console.log(`         ... and ${fieldCount - 3} more`);
        }
        console.log('');
      });
    }
    
    console.log('✅ List models test passed!');
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

testConnection();

