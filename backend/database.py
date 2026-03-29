import mysql.connector
import os
from fastapi import HTTPException
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# DB config using environment variables
db_config = {
    "host": os.getenv("TIDB_HOST", "localhost"),
    "port": int(os.getenv("TIDB_PORT", 4000)),
    "user": os.getenv("TIDB_USER", "root"),
    "password": os.getenv("TIDB_PASS", ""),
    "database": os.getenv("TIDB_DB", "test"),
    "ssl_disabled": os.getenv("TIDB_SSL_DISABLED", "False").lower() == "true"
}

def get_conn():
    try:
        return mysql.connector.connect(**db_config)
    except mysql.connector.Error as err:
        print(f"Error connecting to DB: {err}")
        raise HTTPException(status_code=500, detail="Could not connect to database")

def execute_query(query: str, params: tuple = None, fetch_all=True, fetch_one=False, commit=False):
    """Utility to execute pure SQL queries securely"""
    conn = get_conn()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(query, params or ())
        
        if commit:
            conn.commit()
            return cursor.lastrowid
        
        if fetch_one:
            return cursor.fetchone()
        
        if fetch_all:
            return cursor.fetchall()
            
    except mysql.connector.Error as err:
        print(f"SQL Execution Error: {err}")
        if commit:
            conn.rollback()
        raise HTTPException(status_code=400, detail=f"Database execution error: {err.msg}")
    finally:
        cursor.close()
        conn.close()
