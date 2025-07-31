import os
from langchain_google_genai import ChatGoogleGenerativeAI
import psycopg2
import json
import time
import requests
import re
from flask import Flask, jsonify,request

app = Flask(__name__)
# Set your Gemini API key
os.environ["GOOGLE_API_KEY"] = "AIzaSyATNF479QLaGILiipviMSxGLB1hKVsRyO8"

api_data = {}

def connect_db():
    """Establish connection to PostgreSQL database."""
    return psycopg2.connect(
        dbname="finhub",
        user="postgres",
        password="root",
        host="localhost",
        port="5432"
    )   

def api_response():
    """Fetch data from the API and store it in the global api_data variable."""
    global api_data  # Declare api_data as global to modify it
    try:
        url = "https://webapi.niftytrader.in/webapi/symbol/psymbol-list"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            api_data = response  # Update the global api_data
            print("API data fetched successfully")
        else:
            print(f"API request failed with status code: {response.status_code}")
            api_data = {}  # Set to empty dict if API fails
    except Exception as e:
        print(f"An error occurred in api_response: {e}")
        api_data = {}  # Set to empty dict on error

def search_symbol_in_tables(symbol_name):
    # Connect to your PostgreSQL database
    conn = connect_db()
    cursor = conn.cursor()
    
    
    result = {}
    
    try:
        # Step 1: Get all table names in the 'public' schema
        cursor.execute("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_catalog = 'finhub'
                AND table_name LIKE 'stocks_%';
        """)
        tables = cursor.fetchall()

        # Step 2: Search for the symbol_name in each table
        for table in tables:
            table_name = table[0]
            
            # Construct dynamic query to search for symbol_name in each table
            # Note: Replace 'symbol_column' with the actual column name you're searching in
            search_query = f"SELECT * FROM public.{table_name} WHERE symbol_name = %s"

            cursor.execute(search_query, (symbol_name,))
            rows = cursor.fetchall()

            # If there are matching rows, add them to the result dictionary
            if rows:
                result[table_name] = rows
        
        # Step 3: Return the result as a JSON object
        return json.dumps(result, default=str)  # default=str is used to handle non-serializable types (like dates)

    except Exception as e:
        print(f"An error occurred: {e}")
        return {}

    finally:
        cursor.close()
        conn.close()

def generate_analysis_with_gemini(user_input, training_data, llm):
    prompt = f"""
Your role is that you are an Stock Market Expert and a Financial Exert with 50 years of experience and You have to give the answer to the question that is asked by the user by analysing the below data:
{json.dumps(training_data)}

Generate a professional answer in easy language based on this user input => : "{user_input}".
Must Note Your answer must be according to user input for example 
if user ask for some analyses then user that given data to do the analysis and provide the output.
"Reply with 'sorry I am not able to answer this question' only if you do not have correct answer to a question.".
"""
    
    response = llm.invoke(prompt)

    if response and "Please enter a valid query." not in response.content:
        return response.content.strip()
    
def livedata(symbol_name):
    if '.' in symbol_name:
        symbol = symbol_name.split('.')[0]
    else:
        symbol = symbol_name  # or handle the case when there's no dot

    # url = "https://webapi.niftytrader.in/webapi/symbol/psymbol-list"
    try:
        # response = requests.get(url, timeout=5)
        response=api_data
        print("live_data_response",response)
        if response.status_code == 200:
            # Parse the JSON data
            data = response.json()
            final_data=0
            for i in data['resultData']:
                if i['symbol_name'] == symbol:
                    final_data = i
                    break
            return final_data
        else:
            print(f"Failed to fetch data from nifty api. HTTP Status code: {response.status_code}")
    except Exception as e:
        print(f"An error occurred in data fetching from nifty api: {str(e)}")

def symbol_name_verification(user_input):
    try:
        # url = "https://webapi.niftytrader.in/webapi/symbol/psymbol-list"
        # response = requests.get(url, timeout=5)
        response=api_data
        print("symbol_name_verification",response)

        result_array=[]
        if response.status_code == 200:
            data=response.json()
            for i in data['resultData']:
                    symbol_name=i['symbol_name']
                    result_array.append(symbol_name)

        if user_input not in result_array:
            return False
        return True  

    except Exception as e:
        print(f"An error occurred: {e}")



@app.route('/python/chat',methods=['POST'])
def chatbot():
    api_response()
    """Runs the chatbot to return stock symbols for a given company name using Gemini."""
    # Initialize the Gemini model with your API key
    llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", google_api_key=os.environ["GOOGLE_API_KEY"])

    print("Hello! Tell me the symbol you want to work on")
    
    # user_input = input("You: ")
    data = request.get_json()
    
    if not data or 'symbol' not in data or 'msg' not in data:
        return jsonify({"msg": "No symbol or msg field found in request"}), 400


    user_input = data['symbol']
        
    if user_input.lower() in ["exit", "quit"]:
        print("Goodbye!")
        return jsonify({"msg": "Goodbye!"}), 200

    is_symbol=symbol_name_verification(user_input)

    if not is_symbol:
        print("Please enter a valid symbol name")
        return jsonify({"msg": "Please enter a valid symbol name"}), 400
    

    symbol_name = user_input+'.NS'

    
    # Call the function with the user's input
    result_data = search_symbol_in_tables(symbol_name)
   
    additional_data = livedata(symbol_name)

    if result_data:
        result_data = json.loads(result_data) 
        
    if additional_data:
        result_data['current_live_data_of_today'] = additional_data

    time.sleep(2)
        
    # while True:
    user_question_for_analysis = data['msg']

    if user_question_for_analysis.lower() in ['exit', 'quit']:
        print("Exiting the program.")
        return jsonify({"msg": "Exiting the program"}), 400
        # break

    final_response = generate_analysis_with_gemini(user_question_for_analysis, result_data, llm)
    final_response=re.sub(r'[\*\n]+', ' ', final_response)
    final_response = re.sub(r'\s+', ' ', final_response)
    print(final_response)
    return jsonify({"msg": "success","data":final_response}), 200


@app.route('/python')
def index():
    return "Welcome to the Flask POST API!"



if __name__ == "__main__":
    app.run(host='0.0.0.0', port=305)
    # chatbot()
    # symbol_name_verification()

