from firebase_admin import credentials, firestore, initialize_app

# Initialize Firebase Admin SDK
cred = credentials.Certificate("path/to/your/firebase-config.json")
initialize_app(cred)

db = firestore.client()

def add_visitor(visitor_data):
    """
    Adds a visitor's information to the Firestore database.
    
    :param visitor_data: A dictionary containing visitor information.
    """
    db.collection("visitors").add(visitor_data)

def fetch_visitors():
    """
    Fetches all visitor logs from the Firestore database.
    
    :return: A list of visitor data.
    """
    visitors_ref = db.collection("visitors")
    docs = visitors_ref.stream()
    return [{**doc.to_dict(), "id": doc.id} for doc in docs]