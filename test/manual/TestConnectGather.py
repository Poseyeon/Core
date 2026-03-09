import os
from dotenv import load_dotenv
from pymongo import MongoClient
import mysql.connector
from mysql.connector import Error

load_dotenv()

# ------------------------------
# MongoDB connection
# ------------------------------
def connect_mongo():
    try:
        mongo_uri = os.getenv("MONGO_CONNECTION_STRING")
        db_name = os.getenv("MONGO_INITDB_DATABASE")

        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=3000)
        client.server_info()

        print("MongoDB connected!")
        return client[db_name]
    except Exception as e:
        print("MongoDB connection error:", e)
        return None


# ------------------------------
# MySQL connection
# ------------------------------
def connect_mysql():
    try:
        conn = mysql.connector.connect(
            host="localhost",
            port=os.getenv("MYSQL_PORT"),
            database=os.getenv("MYSQL_DATABASE"),
            user=os.getenv("MYSQL_USER"),
            password=os.getenv("MYSQL_PASSWORD"),
        )
        print("MySQL connected!")
        return conn
    except Error as e:
        print("MySQL connection error:", e)
        return None


# ------------------------------
# Fetch MySQL data for joining
# ------------------------------
def fetch_mysql_data(conn):
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT * FROM ASSET_MGMT")
    asset_mgmt = cursor.fetchall()

    cursor.execute("SELECT * FROM USERS")
    users = cursor.fetchall()

    cursor.execute("SELECT * FROM COMPANY")
    companies = cursor.fetchall()

    return asset_mgmt, users, companies


# ------------------------------
# Combine data from both DBs
# ------------------------------
def combine_data(mongo_assets, asset_mgmt, users, companies):
    result = []

    # Index MySQL lookups for fast join
    user_map = {u["USER_ID"]: u for u in users}
    company_map = {c["COMP_ID"]: c for c in companies}
    asset_map = {a["ASSET_ID"]: a for a in asset_mgmt}

    for asset in mongo_assets:
        aid = asset["asset_id"]

        if aid not in asset_map:
            continue

        mysql_row = asset_map[aid]
        user_row = user_map.get(mysql_row["USER_CR_ID"])
        comp_row = company_map.get(mysql_row["COMP_ID"])

        combined = {
            "asset_id": aid,
            "name": asset["name"],
            "type": asset["type"],
            "mongo": {
                "description": asset.get("description"),
                "classification": asset.get("classification"),
                "location": asset.get("location"),
                "owner": asset.get("owner"),
                "value": asset.get("value"),
                "status": asset.get("status"),
                "risks": asset.get("risks", []),
                "controls": asset.get("controls", []),
                "last_audit": asset.get("last_audit"),
            },
            "mysql": {
                "creator_user": user_row,
                "company": comp_row,
                "last_update": mysql_row["LAST_UPD"],
            }
        }

        result.append(combined)

    return result


# ------------------------------
# MAIN
# ------------------------------
def main():
    mongo_db = connect_mongo()
    mysql_conn = connect_mysql()

    if mongo_db is None or mysql_conn is None:
        print("One or more connections failed.")
        return

    # Load MongoDB assets
    mongo_assets = list(mongo_db["assets"].find({}))

    # Load MySQL data
    asset_mgmt, users, companies = fetch_mysql_data(mysql_conn)

    # Merge
    combined = combine_data(mongo_assets, asset_mgmt, users, companies)

    print("\n\n===== Combined Data =====")
    for entry in combined:
        print(entry)
        print("-" * 50)


if __name__ == "__main__":
    main()
