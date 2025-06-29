const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Read environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

console.log('🚀 Setting up Supabase database...')
console.log(`📍 Project URL: ${supabaseUrl}`)

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runSchema() {
  try {
    // Read the schema file
    const schemaPath = path.join(__dirname, '..', 'supabase', 'schema.sql')
    const schema = fs.readFileSync(schemaPath, 'utf8')
    
    // Split by semicolons to run statements individually
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`)
    
    // Note: The anon key doesn't have permissions to create tables
    // You'll need to run this directly in Supabase dashboard
    console.log('\n⚠️  Important: The anon key cannot create database schema.')
    console.log('📋 Please copy the contents of supabase/schema.sql and run it in:')
    console.log('   Supabase Dashboard → SQL Editor → New Query')
    console.log('\n🔗 Direct link to SQL Editor:')
    console.log(`   ${supabaseUrl.replace('.supabase.co', '.supabase.com')}/sql/new`)
    
    // Create storage buckets using the REST API
    console.log('\n📦 Creating storage buckets...')
    
    // Note: This also requires service key, not anon key
    console.log('⚠️  Storage buckets also need to be created manually in the dashboard')
    console.log('   Go to: Storage → New Bucket')
    console.log('   Create two buckets: "frames" and "pdfs" (both private)')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

runSchema()