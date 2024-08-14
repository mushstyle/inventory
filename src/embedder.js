/*
- load a DB file (loop?)
- load embeddings file
- for each file, load the file
- loop through products. If no embedding, call OpenAI
- save embedding to file
 */

import { CLIPModel } from '@xenova/transformers';

//const processor = new CLIPProcessor().from_pretrained("patrickjohncyh/fashion-clip");
const model = await CLIPModel.from_pretrained("patrickjohncyh/fashion-clip", { quantized: false });

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

console.log(model)

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