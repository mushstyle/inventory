from transformers import pipeline
from PIL import Image
import requests
from fashion_clip.fashion_clip import FashionCLIP

# Create a zero-shot image classification pipeline using the FashionCLIP model
pipe = pipeline("zero-shot-image-classification", model="patrickjohncyh/fashion-clip")

# Function to load an image from a URL
def load_image_from_url(url):
    return Image.open(requests.get(url, stream=True).raw)

def classify_image(image, candidate_labels):
    try:
        results = pipe(images=[image], candidate_labels=candidate_labels)
        return results
    except Exception as e:
        print(f"Error in classification: {str(e)}")
        print(f"Image type: {type(image)}")
        print(f"Candidate labels: {candidate_labels}")
        raise

# Example usage
if __name__ == "__main__":
    # URL of the image you want to classify
    image_url = "https://www.driesvannoten.com/cdn/shop/files/242-020915-9121-802_0.jpg?crop=center&height=866&v=1717753749&width=650"
    
    # Load the image
    image = load_image_from_url(image_url)
    
    # Define candidate labels for classification
    candidate_labels = ["dress", "shirt", "shoes", "pants", "jacket"]
    
    # Perform classification
    results = classify_image(image, candidate_labels)

    fclip = FashionCLIP('fashion-clip')
    image_embedding = fclip.encode_images([image], batch_size=1)
    print(image_embedding)
    # Print results
    #for result in results:
    #    print(result)