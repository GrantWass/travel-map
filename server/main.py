from app import create_app
from config import PORT

app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=PORT)
