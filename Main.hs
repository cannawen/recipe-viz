{-# LANGUAGE DuplicateRecordFields #-}
{-# LANGUAGE NamedFieldPuns        #-}
{-# LANGUAGE OverloadedStrings     #-}
{-# LANGUAGE OverloadedLists       #-}

module Main where

import Configuration.Dotenv (loadFile, defaultConfig, onMissingFile)
import Data.Foldable (traverse_)
import OpenAI.V1
import OpenAI.V1.Chat.Completions

import qualified Data.Text as T
import qualified Data.Text.IO as Text.IO
import qualified System.Environment as Environment

main :: IO ()
main = do
  -- Load .env if present (so OPENAI_API_KEY can live in .env and not be committed)
  onMissingFile (loadFile defaultConfig) (pure ())

  key <- Environment.getEnv "OPENAI_API_KEY"

  clientEnv <- getClientEnv "https://api.openai.com"

  let Methods{ createChatCompletion } =
        makeMethods clientEnv (T.pack key) Nothing Nothing

  let prompt = "tell me a joke"

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
