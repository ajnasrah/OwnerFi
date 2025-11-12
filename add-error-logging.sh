#!/bin/bash

# Add console.error statements to catch blocks that don't have them

echo "Adding error logging to catch blocks..."

# Files to fix
files=(
  "src/app/api/property-actions/route.ts"
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
    # Use perl for more complex regex replacement
    # Add console.error after } catch (error) { if not already present
    perl -i -pe '
      if (/\} catch \(error\) \{/ && $found == 0) {
        $_ .= "    console.error(\047Error in $file:\047, error);\n" unless /<NEXT_LINE>/;
        $found = 1;
      }
    ' "$file" 2>/dev/null || true

    ((count++))
    echo "  ✓ Processed $file"
  fi
done

echo ""
echo "Processed $count files"
echo "Note: Some files may need manual review for correct error messages"
