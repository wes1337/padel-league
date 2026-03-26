# Invite Card Design Guidelines

Generated via Canvas API (`drawInviteCard` in `SessionPage.tsx`). Each share generates a unique variation.

## Canvas

- **Size**: 680 x 480px (landscape, optimized for chat previews)
- **Format**: PNG, no rounded corners
- **Output**: `padello-invite.png`

## Layout (top to bottom)

1. **Session label** — top center, white, 600 weight 20px
2. **VS zone** — center of card, the focal point
3. **Tagline** — below center, bold uppercase, accent color, 800 weight 28px
4. **Subtitle** — small muted text, 500 weight 14px, `#9ca3af`
5. **Footer** — "🎾 Padello", 500 weight 13px, `#6b7280`

## Color System

- **Background**: dark navy/black (`#0a0e1a` base)
- **Left team glow**: radial gradient, 0.15 opacity max
- **Right team glow**: radial gradient, 0.15 opacity max
- **VS text**: gold/yellow `#fbbf24` with shadow glow (0.4 opacity, 30px blur)
- **Tagline**: bright accent color (e.g. `#4ade80` green)
- **Labels/subtitle**: `#9ca3af`
- **Footer**: `#6b7280`
- **White text**: `#ffffff` for session label

## Style Rules

- **Esports/gaming match card** aesthetic — dark, bold, energetic
- Always has a competitive "versus" feel
- Uses emoji for personality (rackets, fire, lightning, swords, etc.)
- Diagonal background stripes at 0.04 opacity for texture
- Dashed center divider line (white, 0.1 opacity)
- Emojis rendered at 80px (main) and 28px (accents) in serif font
- All text uses `system-ui, sans-serif`
- Text always center-aligned

## Randomization (per share)

Elements that should vary each time to keep it fresh:

### Taglines (pick 1 randomly)
Fun, competitive, short uppercase phrases. Examples:
- GAME ON!
- WHO'S NEXT?
- BRING YOUR A-GAME
- NO MERCY TONIGHT
- LET'S SETTLE THIS
- COURT IS CALLING
- TIME TO BATTLE
- READY TO RUMBLE?
- SHOW NO WEAKNESS
- SMASH OR BE SMASHED

### Color themes (pick 1 randomly)
Each theme defines: left glow, right glow, VS color, tagline color
- Blue vs Purple (default): `#3b82f6`, `#a855f7`, `#fbbf24`, `#4ade80`
- Red vs Blue: `#ef4444`, `#3b82f6`, `#fbbf24`, `#facc15`
- Green vs Orange: `#22c55e`, `#f97316`, `#ffffff`, `#4ade80`
- Cyan vs Pink: `#06b6d4`, `#ec4899`, `#fbbf24`, `#67e8f9`
- Yellow vs Red: `#eab308`, `#ef4444`, `#ffffff`, `#fbbf24`

### Emoji pairs (pick 1 randomly)
Left + right main emojis, plus accent emojis near VS:
- 🏓 / 🏓 + 🔥🔥
- ⚔️ / ⚔️ + 💥💥
- 🎾 / 🎾 + ⚡⚡
- 💪 / 💪 + 🔥🔥
- 🏸 / 🏸 + 💥💥

### Background pattern
Keep diagonal stripes but vary:
- Stripe spacing: 30–50px
- Stripe width: 15–25px
- Opacity: 0.03–0.06

## What NOT to do

- No rounded corners on the canvas
- No photos or external images (emoji + canvas shapes only)
- No text below the footer
- Don't make glows too bright (max 0.15 opacity)
- Don't use more than 2 accent colors per card
- Keep it readable — dark background, light text, high contrast on VS
