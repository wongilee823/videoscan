#!/bin/bash

echo "📋 Setting up Supabase database schema..."

# Extract project ref from URL
PROJECT_REF="lvvdgdrfkneklvnfeass"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"

echo "🔗 Project: ${PROJECT_REF}"

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo "❌ psql command not found. Installing postgresql..."
    brew install postgresql
fi

echo ""
echo "⚠️  To run the schema directly, we need your database password."
echo "You can find it in your Supabase dashboard under:"
echo "Settings → Database → Connection string"
echo ""
echo "Or use this direct link:"
echo "https://supabase.com/dashboard/project/${PROJECT_REF}/settings/database"
echo ""
echo "Once you have the password, run:"
echo "psql 'postgresql://postgres:[YOUR-PASSWORD]@db.${PROJECT_REF}.supabase.co:5432/postgres' -f supabase/schema.sql"
echo ""
echo "Alternatively, you can:"
echo "1. Copy the schema from supabase/schema.sql"
echo "2. Paste it in the SQL Editor at:"
echo "   https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new"
echo "3. Click 'Run'"