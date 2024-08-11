/*
- load a DB file (loop?)
- load embeddings file
- for each file, load the file
- loop through products. If no embedding, call OpenAI
- save embedding to file
 */

import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set in the environment variables.');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});