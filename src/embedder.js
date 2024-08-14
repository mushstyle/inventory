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

const getEmbedding = async (text, model = 'text-embedding-3-small') => {
  try {
    const response = await openai.embeddings.create({
      model: model,
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/*
async function getImageEmbedding(imagePath) {
  // Load CLIP model
  const clipPipeline = await pipeline('feature-extraction', "patrickjohncyh/fashion-clip");

  // Generate embedding
  const result = await clipPipeline(imagePath, { pooling: 'mean', normalize: true });

  return result.data;
}

const imgUrl = "https://www.driesvannoten.com/cdn/shop/files/242-020915-9121-802_0.jpg?crop=center&height=866&v=1717753749&width=650"
await getImageEmbedding(imgUrl)
*/

class MyClassificationPipeline {
  static task = 'zero-shot-image-classification';
  static model = 'patrickjohncyh/fashion-clip';
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      // Dynamically import the Transformers.js library
      let { pipeline, env } = await import('@xenova/transformers');
      //env.allowLocalModels = false;

      // NOTE: Uncomment this to change the cache directory
      // env.cacheDir = './.cache';

      this.instance = pipeline(this.task, this.model, { progress_callback });
    }

    return this.instance;
  }
}

const classifier = await MyClassificationPipeline.getInstance();
console.log(classifier)
console.log("FashionCLIP loaded.")