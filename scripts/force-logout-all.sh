#!/bin/bash

# Force Logout All Users Script
# This script changes the NEXTAUTH_SECRET to invalidate all existing sessions

set -e

echo "🔐 Force Logout All Users"
echo "========================="
echo ""
echo "⚠️  WARNING: This will log out ALL users immediately!"
echo "They will need to sign in again."
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "❌ Cancelled"
  exit 0
fi

echo ""
echo "🔄 Generating new NEXTAUTH_SECRET..."

# Generate new secret
NEW_SECRET=$(openssl rand -base64 32)

echo "✅ New secret generated: $NEW_SECRET"
echo ""

# Backup current .env.local
if [ -f .env.local ]; then
  cp .env.local .env.local.backup.$(date +%Y%m%d_%H%M%S)
  echo "📁 Backed up .env.local"
fi

# Update .env.local
if [ -f .env.local ]; then
  # Check if NEXTAUTH_SECRET exists
  if grep -q "NEXTAUTH_SECRET" .env.local; then
    # Replace existing value
    if [[ "$OSTYPE" == "darwin"* ]]; then
      # macOS
      sed -i '' "s|NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=\"$NEW_SECRET\"|" .env.local
    else
      # Linux
      sed -i "s|NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=\"$NEW_SECRET\"|" .env.local
    fi
    echo "✅ Updated NEXTAUTH_SECRET in .env.local"
  else
    # Add new entry
    echo "" >> .env.local
    echo "NEXTAUTH_SECRET=\"$NEW_SECRET\"" >> .env.local
    echo "✅ Added NEXTAUTH_SECRET to .env.local"
  fi
else
  echo "❌ .env.local not found"
  exit 1
fi

echo ""
echo "✅ Local environment updated!"
echo ""
echo "📝 Next steps:"
echo "   1. Restart your dev server (Ctrl+C and run 'npm run dev')"
echo "   2. Update production environment:"
echo "      vercel env add NEXTAUTH_SECRET production"
echo "      (paste: $NEW_SECRET)"
echo "   3. Redeploy: vercel --prod"
echo ""
echo "🎉 Done! All users will be logged out."
