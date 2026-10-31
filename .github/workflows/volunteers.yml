# Generatore carte settimanali — gira gratis su GitHub Actions.
# Segreti da impostare in GitHub: Settings > Secrets and variables > Actions
#   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
name: Carte settimanali

on:
  schedule:
    - cron: "0 3 * * 1"      # lunedì 03:00 UTC
  workflow_dispatch:          # pulsante "Run workflow" per lanciarlo a mano

jobs:
  generate:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: worker
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npx tsx src/generate-volunteers.ts
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
