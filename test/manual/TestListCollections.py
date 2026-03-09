import os
from dotenv import load_dotenv
from pymongo import MongoClient, errors

load_dotenv()

mongo_uri = os.getenv("MONGO_CONNECTION_STRING")
db_name = os.getenv("MONGO_INITDB_DATABASE")

try:
    # Connect to MongoDB
    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=3000)
    client.server_info()

    db = client[db_name]

    print("Connected successfully!")
    print("Available Collections:", db.list_collection_names())

    # Access the "assets" collection
    assets_collection = db["assets"]

    print("\n--- Assets Documents ---")
    for doc in assets_collection.find():
        print(doc)

except errors.ServerSelectionTimeoutError as e:
    print("Error while connecting to MongoDB!")
    print("Error:", e)
