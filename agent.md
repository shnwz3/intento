# Intento Agent Context

This file grounds all future AI work on Intento. Stay inside this product context unless the user explicitly changes it.

## Product Definition

Intento is a cursor-first typing agent.

Its job is to help the user keep the cursor anywhere on the screen and receive a context-aware response, correction, or field value that can be typed directly at that cursor position.

The product should stay centered on this experience: understand what is visible, combine that with relevant user context, generate grounded text, and type or fill it directly.

## What Intento Does Today

- Intento reads the current on-screen context from a captured image of the primary display.
- It uses that visual context to generate the next text the user would likely want to type.
- It can correct selected words, spelling mistakes, grammar, and sentence flow without changing the original intent.
- It can generate direct replies and active-field text based on what is visible on screen.
- It can automate multi-step form filling using visible form context plus saved user context.
- Its output is meant for direct execution, not explanation-heavy chat.

## Brain And User Context

- Intento stores user context in Brain profiles.
- A Brain can contain structured headings, tags, and raw document text.
- Current document support in the codebase includes PDF, DOCX, TXT, and JSON.
- Resume and profile ingestion are primary use cases right now.
- Brain context is especially useful for form filling, profile-based writing, and job-application workflows.
- If exact personal data is missing, the system should skip or leave the field blank instead of inventing sensitive information.

## AI And Provider Strategy

- The user adds API keys in Settings and chooses the active provider.
- Intento currently supports Groq, OpenAI, Gemini, Anthropic, OpenRouter, and an optional local Ollama fallback in code.
- The app currently routes each task to a suitable model profile for that provider.
- The product should remain provider-flexible while preserving the same cursor-first experience.

## Product Boundaries

- Intento is a typing agent first, not a general chatbot.
- Keep the focus on contextual writing, correction, auto-fill, and form completion around the active cursor.
- Do not reposition the product as a general productivity suite, screen analytics tool, or unrelated AI workspace.
- Do not invent features that are not implemented or explicitly requested by the user.

## Important Truths About The Current Implementation

- Screen understanding is image-based today.
- OCR is a future direction, not a current capability.
- The current implementation uses explicit user consent before screen capture.
- Descriptions of the product should stay grounded in visible screen context and user-provided Brain data.

## Output Rules For Intento Features

- Return final usable text, not meta commentary.
- Avoid phrases like "the screen shows" or "here is the response."
- Keep output natural, concise, and human-sounding.
- Preserve the user's likely intent and surrounding context.
- For form filling, prefer exact user data when available and avoid fabricating sensitive facts.

## Current Product Priority

Build the best possible typing agent around the active cursor.

Every new feature should strengthen this loop:

1. Understand visible context.
2. Combine it with user memory when relevant.
3. Generate grounded text.
4. Type or fill it directly.

## Features That Are Not Yet True

- OCR-based screen parsing
- Product directions outside the typing-agent mission unless the user adds them later

This file should evolve with the product. Until it changes, the typing agent around the active cursor is the center of Intento.
