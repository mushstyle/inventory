# Using FashionCLIP

Start Chroma
```
chroma run ~/.chroma/scraper
```

Run command: 
```python
pip install fashion-clip
python3.11 py-scripts/generate_embeddings.py

# Run query server
python3.11 py-scripts/query.py --cropped-images-path PATH --html-template-path PATH
```