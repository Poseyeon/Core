import os
from dotenv import load_dotenv
from pymongo import MongoClient, errors

load_dotenv()

mongo_uri = os.getenv("MONGO_CONNECTION_STRING")
db_name = os.getenv("MONGO_INITDB_DATABASE")

try:
    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=3000)
    client.server_info()
    db = client[db_name]

    print("Conected successfully!")
    print("Available Collections:", db.list_collection_names())

except errors.ServerSelectionTimeoutError as e:
    print("Error while connecting to MongoDB!")
    print("Error:", e)
