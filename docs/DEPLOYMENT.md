# Deployment

## Current components

- Frontend: static HTML
- Backend: Supabase Edge Functions
- Database: Supabase Postgres
- Storage: Supabase Storage

## Edge Functions

Primary:
- normandy-story-sandbox
- game-agent-hub
- configure-game-ai

## Safe deployment sequence

1. Pull latest repository.
2. Review git diff.
3. Apply additive DB migrations first.
4. Deploy Edge Functions.
5. Check GET health endpoint.
6. Create a disposable test session.
7. Load it.
8. Execute one action.
9. Confirm four choices are returned.
10. Confirm existing production sessions remain unchanged.
11. Publish static frontend.

## Never

- never reset production game tables just to fix code
- never publish a service-role key
- never embed API keys in frontend HTML
- never commit player access tokens
