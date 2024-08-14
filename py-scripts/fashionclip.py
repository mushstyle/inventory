from PIL import Image
import requests
import json
import aiohttp
import asyncio
from io import BytesIO
from fashion_clip.fashion_clip import FashionCLIP
import chromadb

chroma_client = chromadb.HttpClient(host='localhost', port=8000)
fclip = FashionCLIP('fashion-clip')

path = "/Users/blah/pkg/mush/scraper-v2/db/driesvannoten.com.db.json"
data = {}
# Load the JSON data from the file
with open(path, 'r') as file:
    data = json.load(file)

#for item in data:
#    print(item['imageUrl'])

async def load_image_from_url(session, url):
    async with session.get(url) as response:
        content = await response.read()
        return Image.open(BytesIO(content))

async def load_images(urls):
    async with aiohttp.ClientSession() as session:
        tasks = [load_image_from_url(session, url) for url in urls]
        return await asyncio.gather(*tasks)

async def get_image_embeddings(image_urls):
    images = await load_images(image_urls)
    image_embeddings = fclip.encode_images(images, batch_size=len(image_urls))
    return image_embeddings

if __name__ == "__main__":
    # Take the first 16 imageUrls from data
    image_urls = [item['imageUrl'] for item in data[:16] if 'imageUrl' in item]

    # Get image embeddings
    image_embeddings = asyncio.run(get_image_embeddings(image_urls))

    print(image_embeddings[0])
    print(len(image_embeddings[0]))
    print(f"Generated embeddings for {len(image_embeddings)} images")

#    image_url = "https://www.driesvannoten.com/cdn/shop/files/242-020915-9121-802_0.jpg?crop=center&height=866&v=1717753749&width=650"
  # load_image
  #  fclip = FashionCLIP('fashion-clip')
#    image_embeddings = fclip.encode_images([image], batch_size=1)
  #  print(image_embeddings)

"""
embeddings, metadata, ids
* load DB file
* loop through item JSONs
* each clothing item, we get an embedding
* we stringify its JSON as metadata
"""