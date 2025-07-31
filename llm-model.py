import psycopg2
import json
import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.memory import ConversationBufferMemory

# Set your Gemini API key
os.environ["GOOGLE_API_KEY"] = "AIzaSyB1mqAz7GdrfZUlN_24HNK_WgRiV9LlIls"

def connect_db():
    """Establish connection to PostgreSQL database."""
    return psycopg2.connect(
        dbname="dvdrental",
        user="postgres",
        password="root",
        host="localhost",
        port="5432"
    )

def convert_to_serializable(obj):
    """Convert non-serializable objects to string format."""
    return str(obj)

def extract_training_data():
    """Extracts schema and sample data from the database for AI training."""
    conn = connect_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
    table_names = [row[0] for row in cursor.fetchall()]
    training_data = {}
    
    for table in table_names:
        cursor.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name = '{table}'")
        columns = [col[0] for col in cursor.fetchall()]
        
        cursor.execute(f"SELECT * FROM {table} LIMIT 50")
        rows = cursor.fetchall()

        # Convert all values to serializable format
        formatted_rows = [[convert_to_serializable(value) if not isinstance(value, (int, float, str, bool, type(None))) else value for value in row] for row in rows]

        training_data[table] = {"columns": columns, "sample_rows": formatted_rows}
    
    conn.close()
    
    with open("training_data.json", "w") as f:
        json.dump(training_data, f, indent=4, default=convert_to_serializable)
    
    print("Training data extracted to training_data.json")
    return training_data

def generate_query_with_gemini(user_input, training_data, llm):
    """Generates an SQL query using Gemini AI."""
    prompt = f"""
    You are an SQL expert. Given the database schema:
    {json.dumps(training_data, indent=2)}
    
    Generate a valid SQL query based on the user's request: "{user_input}".
    Ensure the query is safe and well-structured.
    """
    
    response = llm.invoke(prompt)
    return response.content if response else "SELECT 'Error generating query' AS result"

def execute_query(query):
    """Executes the given SQL query on the database."""
    try:
        conn = connect_db()
        cursor = conn.cursor()
        cursor.execute(query)
        results = cursor.fetchall()
        conn.close()
        
        return "\n".join(map(str, results)) if results else "No results found."
    except psycopg2.Error as e:
        return f"Error executing query: {e}"

def chatbot(training_data):
    """Runs a chatbot that generates and executes SQL queries."""
    llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", google_api_key=os.environ["GOOGLE_API_KEY"])
    
    # ✅ Fixed Memory issue: Explicit output key
    memory = ConversationBufferMemory(memory_key="chat_history", output_key="bot")
    
    print("Hello! Ask me anything about the database.")
    print("Example: 'Show all from users where name = \"John\"'")
    
    while True:
        user_input = input("You: ")
        if user_input.lower() in ["exit", "quit"]:
            print("Goodbye!")
            break
        
        memory.save_context({"user": user_input}, {"bot": "Generating SQL query..."})  # Save user input
        query = generate_query_with_gemini(user_input, training_data, llm)
        print(f"Generated query: {query}")
        
        memory.save_context({"user": user_input}, {"bot": query})  # Store query as bot response
        result = execute_query(query)
        
        memory.save_context({"user": user_input}, {"bot": result})  # Store query result
        print("Bot:", result)

if __name__ == "__main__":
    training_data = extract_training_data()
    chatbot(training_data)
