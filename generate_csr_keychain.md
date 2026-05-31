# How to Fix Certificate Issue

The certificate was imported but missing its private key. Here's the proper way:

## Using Keychain Access App (Recommended):

1. Open **Keychain Access** app (Cmd+Space, type "Keychain Access")

2. From menu bar: **Keychain Access > Certificate Assistant > Request a Certificate from a Certificate Authority**

3. Fill in:
   - Email: abdullah@ownerfi.ai
   - Common Name: Abdullah Jamal Abunasrah
   - CA Email: (leave blank)
   - Select: "Saved to disk"
   - Check: "Let me specify key pair information"

4. Save CSR to Desktop as "OwnerFi.certSigningRequest"

5. Key Pair Information:
   - Key Size: 2048 bits
   - Algorithm: RSA

6. Upload this new CSR to Apple Developer Portal

7. Download the new certificate

8. Double-click the downloaded certificate - it will automatically pair with the private key

This ensures the private key stays in your keychain and pairs correctly with the certificate.
