class Visitor:
    def __init__(self, name: str, timestamp: str, image_url: str):
        self.name = name
        self.timestamp = timestamp
        self.image_url = image_url

    def to_dict(self):
        return {
            "name": self.name,
            "timestamp": self.timestamp,
            "image_url": self.image_url
        }