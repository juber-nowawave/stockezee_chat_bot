from flask import Flask, request, jsonify, render_template
import pandas as pd
import psycopg2
import os

app = Flask(__name__)

def connect_db():
    """Establish connection to PostgreSQL database."""
    return psycopg2.connect(
        dbname="finhub",
        user="postgres",
        password="root",
        host="localhost",
        port="5432"
    )

def excel_to_postgres(file_path):
    # Extract table name from file name
    table_name = os.path.splitext(os.path.basename(file_path))[0]

    # Read Excel file
    df = pd.read_excel(file_path)

    # Connect to PostgreSQL
    conn = connect_db()
    cur = conn.cursor()

    # Ensure column names are safe for SQL (handle numeric and special characters)
    columns = ", ".join([f'"{col}" TEXT' for col in df.columns])
    create_table_query = f"""
    CREATE TABLE IF NOT EXISTS "{table_name}" (
        {columns}
    )"""
    cur.execute(create_table_query)

    # Insert data into table
    for _, row in df.iterrows():
        values = tuple(row.astype(str))
        placeholders = ', '.join(['%s'] * len(values))
        insert_query = f'INSERT INTO "{table_name}" VALUES ({placeholders})'
        cur.execute(insert_query, values)

    # Commit changes and close connection
    conn.commit()
    cur.close()
    conn.close()

@app.route('/', methods=['GET', 'POST'])
def upload_file():
    if request.method == 'POST':
        if 'file' not in request.files:
            return render_template('index.html', message="No file part")

        file = request.files['file']

        if file.filename == '':
            return render_template('index.html', message="No selected file")

        file_path = f"uploads/{file.filename}"

        os.makedirs("uploads", exist_ok=True)
        file.save(file_path)

        try:
            excel_to_postgres(file_path)
            message = f"File '{file.filename}' successfully uploaded and data inserted."
        except Exception as e:
            message = f"Error: {str(e)}"
        finally:
            os.remove(file_path)

        return render_template('index.html', message=message)

    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True)
