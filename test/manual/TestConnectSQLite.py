import os
import sqlite3
from dotenv import load_dotenv

# Load environment variables from .env file
print("Loading environment variables from .env file...")
load_dotenv()

# Get credentials from .env file
db_path = os.getenv("SQLITE_DB_PATH")
gui_path = os.getenv("SQLITE_GUI_PATH")

print(f"Database path: {db_path}")
print(f"GUI path: {gui_path}")

# Validate paths exist
if not db_path:
    print("ERROR: SQLITE_DB_PATH not set in .env file")
    exit(1)

if not os.path.exists(db_path):
    print(f"ERROR: Database file not found at {db_path}")
    exit(1)

# Connect to SQLite database
connection = None
try:
    print(f"\nAttempting to connect to database...")
    connection = sqlite3.connect(db_path)
    cursor = connection.cursor()
    print(f"✓ Successfully connected to: {db_path}")
    
    # Test connection
    print("Executing test query...")
    cursor.execute("SELECT sqlite_version();")
    version = cursor.fetchone()
    print(f"✓ SQLite version: {version[0]}")
    print("\n✓ Database connection test PASSED")
    
except sqlite3.Error as e:
    print(f"\n✗ SQLite Error: {e}")
    exit(1)
except Exception as e:
    print(f"\n✗ Unexpected error: {e}")
    exit(1)
finally:
    if connection:
        connection.close()
        print("Connection closed")