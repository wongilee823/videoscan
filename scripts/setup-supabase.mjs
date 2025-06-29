import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Read environment variables
const supabaseUrl = 'https://lvvdgdrfkneklvnfeass.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dmRnZHJma25la2x2bmZlYXNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExNTM3NTMsImV4cCI6MjA2NjcyOTc1M30.h5p43-VwRK8P5f0hrsD3aL7MfP3IKXcAQEhS4PrJ0vY'

console.log('🚀 Setting up Supabase...')

// Since we can't run DDL with anon key, let's at least test the connection
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testConnection() {
  try {
    // Test if we can connect
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      console.log('❌ Connection error:', error.message)
    } else {
      console.log('✅ Successfully connected to Supabase!')
    }

    // Read the schema file
    const schemaPath = path.join(__dirname, '..', 'supabase', 'schema.sql')
    const schema = fs.readFileSync(schemaPath, 'utf8')
    
    console.log('\n📋 Database Schema Instructions:')
    console.log('================================')
    console.log('Since we need admin privileges to create tables, please:')
    console.log('\n1. Go to your Supabase Dashboard')
    console.log('2. Navigate to SQL Editor')
    console.log('3. Create a new query')
    console.log('4. Paste and run the following SQL:\n')
    console.log('--- BEGIN SQL SCHEMA ---')
    console.log(schema)
    console.log('--- END SQL SCHEMA ---')
    
    console.log('\n📦 Storage Buckets Instructions:')
    console.log('=================================')
    console.log('1. Go to Storage in your Supabase Dashboard')
    console.log('2. Create a new bucket called "frames" (set to private)')
    console.log('3. Create a new bucket called "pdfs" (set to private)')
    
    // Try to check if tables exist (this will fail if not created yet)
    const { data: tables, error: tablesError } = await supabase
      .from('users')
      .select('count')
      .limit(1)
    
    if (tablesError && tablesError.code === '42P01') {
      console.log('\n⚠️  Tables not found. Please run the schema first.')
    } else if (!tablesError) {
      console.log('\n✅ Tables appear to be set up!')
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

testConnection()