from PIL import Image
import requests
from fashion_clip.fashion_clip import FashionCLIP

# Function to load an image from a URL
def load_image_from_url(url):
    return Image.open(requests.get(url, stream=True).raw)

# Example usage
if __name__ == "__main__":
    # URL of the image you want to classify
    image_url = "https://www.driesvannoten.com/cdn/shop/files/242-020915-9121-802_0.jpg?crop=center&height=866&v=1717753749&width=650"
    
    # Load the image
    image = load_image_from_url(image_url)
    fclip = FashionCLIP('fashion-clip')
    image_embeddings = fclip.encode_images([image], batch_size=1)
    print(image_embeddings)
