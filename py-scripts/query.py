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

def async_to_sync(f):
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        return asyncio.run(f(*args, **kwargs))
    return wrapper

@app.route('/', methods=['GET', 'POST'])
@async_to_sync
async def handle_query():
    def get_form_html():
        return '''
        <form method="post" action="/">
            <input type="text" name="query" placeholder="Enter your query" autofocus>
            <input type="number" name="num_results" value="9">
            <input type="submit" value="Search">
        </form>
        '''

    if request.method == 'POST':
        if request.form:
            query_text = request.form.get('query', '')
            num_results = int(request.form.get('num_results', 5))
        else:
            return {"error": "No form data received."}, 400

        results = await query(query_text, num_results)
        
        # Process the results to return a JSON-friendly format
        processed_results = []
        for item, score in zip(results['metadatas'][0], results['distances'][0]):
            item_data = json.loads(item['item'])
            processed_results.append({
                'title': item_data.get('title', ''),
                'imageUrl': await get_cropped_image_url(item_data.get('imageUrl', '')),
                'price': f"${item_data.get('price', 0):.2f}",
                'score': score,
                'name': item.get('name', '')
            })
        
        # Sort processed_results by score in descending order
        processed_results.sort(key=lambda x: x['score'], reverse=True)
        
        # Create an HTML table to display the results
        html_content = '''
        <style>
            .results-container {
                display: flex;
                flex-wrap: wrap;
                justify-content: flex-start;
                gap: 20px;
                padding: 20px 0;
                max-width: 1000px;
                margin: 0 auto;
            }
            .result-card {
                flex: 0 0 calc(33.333% - 20px);
                max-width: calc(33.333% - 20px);
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 15px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                box-sizing: border-box;
            }
            .result-card img {
                width: 100%;
                height: 200px;
                object-fit: cover;
                border-radius: 4px;
            }
            .result-info {
                margin-top: 10px;
            }
            @media (max-width: 768px) {
                .result-card {
                    flex: 0 0 calc(50% - 20px);
                    max-width: calc(50% - 20px);
                }
            }
            @media (max-width: 480px) {
                .result-card {
                    flex: 0 0 100%;
                    max-width: 100%;
                }
            }
        </style>
        <div class="results-container">
        '''
        for result in processed_results:
            html_content += f'''
            <div class="result-card">
                <img src="{result['imageUrl']}" alt="{result['title']}">
                <div class="result-info">
                    <h3>{result['title']}</h3>
                    <p>Brand: {result['name']}</p>
                    <p>Price: {result['price']}</p>
                    <p>Score: {result['score']:.4f}</p>
                </div>
            </div>
            '''
        html_content += '</div>'
        
        # Combine the form and results
        return f'{get_form_html()}<br>{html_content}'
    else:
        return get_form_html()

@app.route('/api/query', methods=['POST'])
@async_to_sync
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
            'name': item.get('name', '')
        })
    
    processed_results.sort(key=lambda x: x['score'], reverse=True)
    
    return jsonify(processed_results)

@app.route('/template', methods=['GET'])
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