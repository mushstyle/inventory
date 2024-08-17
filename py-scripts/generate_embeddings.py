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

def fix_url(domain, url):
    if url is None:
        return None
    if url.startswith("//"):
        return "https:" + url
    elif url.startswith("/"):
        return domain + url
    return url

def item_hash(domain, item):
    return hashlib.sha256(json.dumps(fix_url(domain, item['link'])).encode('utf-8')).hexdigest()

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

async def process_items(domain, items):
    image_urls = [fix_url(domain, item['imageUrl']) for item in items if 'imageUrl' in item]
    image_embeddings = await get_image_embeddings(image_urls)
    valid_items = [item for item, embedding in zip(items, image_embeddings) if embedding is not None]
    metadatas = [{'item': json.dumps(item)} for item in valid_items]
    ids = [item_hash(domain, item) for item in valid_items]
    return image_embeddings, metadatas, ids

async def run(name, domain, data):
    print(f"Processing {name} with {len(data)} items")
    i = 0
    batch_size = 32
    while i*batch_size < len(data):
        batch = data[i*batch_size:(i+1)*batch_size]
        image_embeddings, metadatas, ids = await process_items(domain, batch)
        collection.add(
            embeddings=np.array(image_embeddings).tolist(),
            metadatas=[{**m, 'name': name} for m in metadatas],
            ids=ids
        )
        print(f"Processed {i*batch_size+len(batch)} items")
        i += 1

def process_sites(sites, path):
    for site in sites:
        print(f"Processing {site['name']}")
        name = site['name']
        domain = site['url']
        db_file = site['dbFile']
        try:
            with open(path + "/db/" + db_file, 'r') as file:
                data = json.load(file)
        except Exception as e:
            print(f"Error processing {name}: {str(e)}")
            continue
        asyncio.run(run(name, domain, data))

def process_single_site(sites, path, target_name):
    for site in sites:
        if site['name'].lower() == target_name.lower():
            process_sites([site], path)
            return
    print(f"No matching site found for '{target_name}'")

import argparse

if __name__ == "__main__":
    path = "/Users/blah/pkg/mush/scraper-v2"
    parser = argparse.ArgumentParser(description="Process fashion data for all sites or a specific site.")
    parser.add_argument("target_name", type=str, nargs='?', help="Name of the site to process (optional)")
    args = parser.parse_args()

    with open(path + '/sites/index.json', 'r') as file:
        index = json.load(file)

    if args.target_name:
        process_single_site(index, path, args.target_name)
    else:
        process_sites(index, path)
