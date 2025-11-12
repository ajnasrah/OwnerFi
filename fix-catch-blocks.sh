#!/bin/bash

# Script to fix empty catch blocks in API routes
# Adds error parameter and console.error logging

echo "Fixing empty catch blocks in API routes..."

# Array of files with empty catch blocks
files=(
  "src/app/api/property-actions/route.ts"
  "src/app/api/chatbot/route.ts"
  "src/app/api/properties/details/route.ts"
  "src/app/api/stripe/cancel-subscription/route.ts"
  "src/app/api/users/[id]/route.ts"
  "src/app/api/realtor/profile/route.ts"
  "src/app/api/realtor/dashboard/route.ts"
  "src/app/api/stripe/billing-portal/route.ts"
  "src/app/api/property-matching/calculate/route.ts"
  "src/app/api/properties/similar/route.ts"
  "src/app/api/stripe/checkout/route.ts"
  "src/app/api/admin/check-credits/route.ts"
  "src/app/api/admin/activate-subscription/route.ts"
  "src/app/api/stripe/simple-checkout/route.ts"
  "src/app/api/workflow/complete-abdullah/route.ts"
  "src/app/api/admin/update-plan/route.ts"
  "src/app/api/stripe/webhook/route.ts"
  "src/app/api/admin/check-session/route.ts"
  "src/app/api/buyer/like-property/route.ts"
  "src/app/api/admin/properties/[id]/route.ts"
  "src/app/api/buyer/profile/route.ts"
  "src/app/api/admin/disputes/route.ts"
  "src/app/api/buyer/liked-properties/route.ts"
  "src/app/api/admin/contacts/route.ts"
  "src/app/api/cities/search/route.ts"
  "src/app/api/cities/nearby/route.ts"
  "src/app/api/cities/coordinates/route.ts"
)

count=0
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    # Replace } catch { with } catch (error) {
    # and add console.error on next line if not present
    sed -i '' 's/} catch {/} catch (error) {/g' "$file"
    ((count++))
    echo "  ✓ Fixed $file"
  else
    echo "  ⚠️  Skipped $file (not found)"
  fi
done

echo ""
echo "Fixed $count files"
echo ""
echo "Note: You still need to manually add console.error statements"
echo "inside each catch block where they're missing."
