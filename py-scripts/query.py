import chromadb
import numpy as np
import json
from fashion_clip.fashion_clip import FashionCLIP
from flask import Flask, request, jsonify
import asyncio
import functools

import argparse

parser = argparse.ArgumentParser(description='Process cropped images and set HTML template path.')
parser.add_argument('--cropped-images-path', default="/Users/blah/pkg/mush/scraper-v2/db/cropped_images.db.json",
                    help='Path to the cropped images JSON file')
parser.add_argument('--html-template-path', default="/Users/blah/pkg/mush/scraper-v2/html/image_query.html",
                    help='Path to the HTML template file')
args = parser.parse_args()

cropped_images_path = args.cropped_images_path
cropped_images = json.load(open(cropped_images_path))
html_template_path = args.html_template_path

async def get_cropped_image_url(image_url):
    if image_url in cropped_images:
        return cropped_images[image_url]
    return image_url

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

async def query(query_text, num_results=5):
    text_embeddings = await asyncio.to_thread(fclip.encode_text, [query_text], batch_size=1)
    results = await asyncio.to_thread(
        collection.query,
        query_embeddings=np.array(text_embeddings).tolist(),
        n_results=num_results,
    )
    return results

app = Flask(__name__)

@app.route('/api/query', methods=['POST'])
async def api_query():
    data = request.json
    if not data or 'query' not in data:
        return {"error": "Invalid input. 'query' is required."}, 400

    query_text = data['query']
    num_results = data.get('numItems', 5)

    results = await query(query_text, num_results)
    
    processed_results = []
    for item, score in zip(results['metadatas'][0], results['distances'][0]):
        item_data = json.loads(item['item'])
        processed_results.append({
            'title': item_data.get('title', ''),
            'imageUrl': await get_cropped_image_url(item_data.get('imageUrl', '')),
            'price': item_data.get('price', 0),
            'currency': 'USD',  # Assuming USD, adjust if needed
            'score': score,
            'name': item.get('name', ''),
            'link': item_data.get('link', '')  # Add the link to the response
        })
    
    processed_results.sort(key=lambda x: x['score'], reverse=True)
    
    return jsonify(processed_results)

@app.route('/', methods=['GET'])
def get_template():
    try:
        with open(html_template_path, 'r') as file:
            template_content = file.read()
        return template_content
    except FileNotFoundError:
        return f"Template file not found at {html_template_path}", 404
    except Exception as e:
        return f"Error reading template file: {str(e)}", 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3001, debug=True)