# README FOR AI (Claude/ChatGPT)

This folder contains ALL brand prompts for the OwnerFi/Carz/Abdullah media system.

## Quick Commands

When I say:
- **"Update the OwnerFi prompt"** → You ONLY update Brand 2 section inside BRAND_SYSTEM_PROMPTS.md
- **"Update the Abdullah prompt"** → You ONLY update Brand 1 section
- **"Update Property Videos prompt"** → You ONLY update Brand 3 section
- **"Update Benefit Videos prompt"** → You ONLY update Brand 4 section
- **"Update Carz prompt"** → You ONLY update Brand 5 section
- **"Update Vass Distro prompt"** → You ONLY update Brand 6 section
- **"Update Gaza prompt"** → You ONLY update Brand 7 section
- **"Add YouTube title changes"** → You update the GLOBAL RULES title block
- **"Add new caption rules"** → You update the GLOBAL RULES caption block

## Generate Content Commands

When I say:
- **"Generate scripts for [brand]"** → Follow that brand's rules exactly
- **"Write 5 scripts for OwnerFi"** → Generate 5 complete outputs (script, title, caption, hashtags, first comment)
- **"Property video for [address]"** → Generate 30s and 15s versions

## Rules You MUST Follow

1. **NEVER** rewrite the entire file unless instructed
2. **NEVER** change brand personality without explicit permission
3. **ALWAYS** maintain tone, emojis, format, and length per brand
4. **ALWAYS** include all 5 outputs: Script, Title, Caption, Hashtags, First Comment
5. **ALWAYS** follow YouTube title rules (emoji + power word + 20-35 chars)
6. **ALWAYS** follow caption formula (200-300 chars)

## Brand Quick Reference

| Brand | Voice | CTA |
|-------|-------|-----|
| Abdullah | Goofy, real, funny | "Follow Abdullah for more." |
| OwnerFi | Calm, helpful, trustworthy | "Visit www.ownerfi.ai..." |
| Property | Excited, clear, walkthrough | "Visit www.ownerfi.ai..." |
| Benefit | Empowering, motivational | "Visit www.ownerfi.ai..." |
| Carz | Fast, bold, insider | "Follow Carz for more." |
| Vass Distro | Serious, compliance, B2B | "Follow Vass Distro for updates." |
| Gaza | Somber, respectful, human | "Share to keep awareness alive." |

## File Structure

```
/prompts/
├── BRAND_SYSTEM_PROMPTS.md  ← Master file (all brands)
├── README_FOR_CLAUDE.md     ← This file (instructions)
```

## Adding New Brands

To add a new brand, create a new section in BRAND_SYSTEM_PROMPTS.md following this format:

```
############################################
#   BRAND X — [BRAND NAME]
############################################

VOICE:
- [Voice characteristics]

CONTENT:
- [Content types]

SCRIPT RULES:
- [Word count]
- [Style notes]
- [CTA]

TITLE EMOJIS: [allowed emojis]

EXAMPLE OUTPUT:
---
SCRIPT:
[example]

TITLE:
[example]

CAPTION:
[example]

FIRST COMMENT:
[example]
---
```
