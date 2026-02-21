{-# LANGUAGE DuplicateRecordFields #-}
{-# LANGUAGE NamedFieldPuns        #-}
{-# LANGUAGE OverloadedStrings     #-}
{-# LANGUAGE OverloadedLists       #-}

module Main where

import Configuration.Dotenv (loadFile, defaultConfig, onMissingFile)
import Data.Foldable (traverse_)
import OpenAI.V1
import OpenAI.V1.Chat.Completions

import qualified Data.ByteString.Lazy as LBS
import qualified Data.Text as T
import Data.Text.Encoding.Error (lenientDecode)
import qualified Data.Text.Encoding as T.Enc
import qualified Data.Text.IO as Text.IO
import qualified Network.HTTP.Client as HTTP
import qualified Network.HTTP.Client.TLS as TLS
import qualified System.Environment as Environment

-- Change this URL to fetch a different page.
urlToFetch :: String
urlToFetch = "https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/?print="

main :: IO ()
main = do
  -- Load .env if present (so OPENAI_API_KEY can live in .env and not be committed)
  onMissingFile (loadFile defaultConfig) (pure ())

  key <- Environment.getEnv "OPENAI_API_KEY"

  -- Fetch the content of the URL
  manager <- TLS.newTlsManager
  request <- HTTP.parseRequest urlToFetch
  response <- HTTP.httpLbs request manager
  let bodyBytes = HTTP.responseBody response
  let rawContent = T.Enc.decodeUtf8With lenientDecode (LBS.toStrict bodyBytes)
  -- Keep under model context limit (~128k tokens; ~4 chars/token → cap at 80k chars)
  let maxChars = 80000
  let pageContent = T.take maxChars rawContent
  let truncatedNote =
        if T.length rawContent > maxChars
          then "\n\n[Content truncated for length.]\n\n"
          else "\n\n"

  clientEnv <- getClientEnv "https://api.openai.com"

  let Methods{ createChatCompletion } =
        makeMethods clientEnv (T.pack key) Nothing Nothing

  let prompt =
        "Given the following web page content (from "
          <> T.pack urlToFetch
          <> "), return a mermaid data structure."
          <> "The data structure should have ingredient amounts as inputs (i.e. 400g flour, 200g water), and actions as boxes (i.e. mix). "
          <> "The ingredients should flow into the appropriate action box so that the user can see the recipe steps visually. "
          <> "In the recipe states to combine ingredient A and ingredient B in one step, then combine ingredient C in another step, then there should be two separate action boxes. "
          <> "The Mermaid chart should all be connected in some way. "
          <> "Only return the data structure, no other text. Don't even use a code block to format it. "
          <> truncatedNote
          <> "---\n\n"
          <> pageContent

  ChatCompletionObject{ choices } <-
    createChatCompletion
      _CreateChatCompletion
        { messages =
            [ User
                { content = [ Text{ text = prompt } ]
                , name = Nothing
                }
            ]
        , model = "gpt-4o-mini"
        }

  let display Choice{ message } =
        Text.IO.putStrLn (messageToContent message)

  traverse_ display choices
