# Trike Backoffice Design Guidelines

## AI Functionality Representation

To ensure consistency across the platform, all AI-powered features, suggestions, and tools MUST use the **Lightning Bolt** (`Zap`) icon from `lucide-react`.

### Icon Usage
- **Icon**: `Zap`
- **Styling**: 
  - For active/accented AI features, use the brand orange color: `text-[#F74A05]` or `text-orange-500`.
  - In dark mode contexts or specific badges, use `fill-current` to ensure the bolt is visually prominent.
- **Animation**: When AI is "thinking" or processing, use the `animate-pulse` class on the `Zap` icon.

### Rationale
The `Zap` icon is our project's designated symbol for "intelligent automation" and "instant processing," distinguishing AI features from static content or simple manual tools (which may use `Sparkles` or other icons).

---
*Note: This guideline was established on Dec 31, 2025, to resolve inconsistencies between `Sparkles` and `Zap` icons used for AI suggestions, transcription, and content analysis.*

