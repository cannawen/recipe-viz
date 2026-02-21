# recipe-viz

A small Haskell program that calls the OpenAI API (e.g. to get a joke). The API key is read from the environment so it is never hard-coded or committed.

## Setup

1. **Copy the example env file and add your key**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set your OpenAI API key:

   ```
   OPENAI_API_KEY=sk-your-actual-key-here
   ```

   `.env` is in `.gitignore`, so it will not be committed.

2. **Build and run**

   ```bash
   cabal build
   cabal run recipe-viz
   ```

   The program loads variables from `.env` (if present) then reads `OPENAI_API_KEY` and calls the OpenAI chat completions API with the prompt “tell me a joke”.

## Requirements

- GHC and Cabal (e.g. from [GHCup](https://www.haskell.org/ghcup/))
- An OpenAI API key

## Security note

If you ever paste an API key into chat or commit it by mistake, revoke that key in the OpenAI dashboard and create a new one.
