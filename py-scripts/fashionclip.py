from PIL import Image
import requests
import json
import aiohttp
import asyncio
from io import BytesIO
from fashion_clip.fashion_clip import FashionCLIP
import chromadb
import hashlib
import numpy as np
fclip = FashionCLIP('fashion-clip')

collection_name = "scraper"
chroma_client = chromadb.HttpClient(host='localhost', port=8000)
# Check if the collection exists, if not create it
try:
    collection = chroma_client.get_collection(name=collection_name)
    print(f"Collection '{collection_name}' already exists.")
except Exception as e:
    print(f"Collection '{collection_name}' does not exist. Creating it now.")
    collection = chroma_client.create_collection(name=collection_name)
    print(f"Collection '{collection_name}' created successfully.")

path = "/Users/blah/pkg/mush/scraper-v2/db/driesvannoten.com.db.json"
data = {}
# Load the JSON data from the file
with open(path, 'r') as file:
    data = json.load(file)

def item_hash(item):
    return hashlib.sha256(json.dumps(item).encode('utf-8')).hexdigest()

async def load_image_from_url(session, url):
    try:
        async with session.get(url) as response:
            content = await response.read()
            return Image.open(BytesIO(content))
    except Exception as e:
        print(f"Error loading image from {url}: {str(e)}")
        return None

async def load_images(urls):
    async with aiohttp.ClientSession() as session:
        tasks = [load_image_from_url(session, url) for url in urls]
        return await asyncio.gather(*tasks)

async def get_image_embeddings(image_urls):
    images = await load_images(image_urls)
    valid_images = [img for img in images if img is not None]
    image_embeddings = fclip.encode_images(valid_images, batch_size=len(valid_images))
    return image_embeddings

async def process_items(items):
    image_urls = [item['imageUrl'] for item in items if 'imageUrl' in item]
    image_embeddings = await get_image_embeddings(image_urls)
    valid_items = [item for item, embedding in zip(items, image_embeddings) if embedding is not None]
    metadatas = [{'item': json.dumps(item)} for item in valid_items]
    ids = [item_hash(item) for item in valid_items]
    return image_embeddings, metadatas, ids

async def run(data):
    i = 0
    batch_size = 32
    while i*batch_size < len(data):
        batch = data[i*batch_size:(i+1)*batch_size]
        image_embeddings, metadatas, ids = await process_items(batch)
        collection.add(
            embeddings=np.array(image_embeddings).tolist(),
            metadatas=metadatas,
            ids=ids
        )
        print(f"Processed {i*batch_size+len(batch)} items")
        i += 1

# Run the async function
asyncio.run(run(data))