from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
from tensorflow.keras.models import load_model
import os
import requests
from dotenv import load_dotenv
import time
from typing import Dict
import csv
import logging
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.utils import to_categorical
import matplotlib.pyplot as plt
import pandas as pd
from sklearn.model_selection import train_test_split
import tensorflow.keras as keras
from tensorflow.keras.optimizers import Adam
from sklearn.metrics import confusion_matrix, precision_recall_fscore_support




# Load environment variables
load_dotenv()
HF_API_TOKEN = os.getenv("HF_API_TOKEN")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyCOk7MFwGHQHY8u6uCqD5wX684p-WB7F9w")

# Setup dynamic paths relative to this script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, 'model.h5')
LABELS_PATH = os.path.join(BASE_DIR, 'unique_labels.npy')
SENSOR_CSV_PATH = os.path.join(BASE_DIR, 'sensor.csv')

# Load the pre-trained gesture model (trained on 9 features per frame)
try:
    model = load_model(MODEL_PATH)
    unique_labels = np.load(LABELS_PATH, allow_pickle=True)
    print(f'[INFO] Model loaded from {MODEL_PATH}')
    print(f'[INFO] Labels: {unique_labels}')
except Exception as e:
    print(f'[ERROR] Failed to load model: {e}')
    model = None
    unique_labels = []

# Constants
SEQUENCE_LENGTH = 100  # Length of sequences for prediction
FEATURES_PER_FRAME = 9  # accel (3) + gravity (3) + angular velocity (3)

# Feature indices in the input data
FEATURE_INDICES = {
    'acceleration': [0, 1, 2],  # x, y, z
    'gravity': [3, 4, 5],      # x, y, z
    'angular_velocity': [6, 7, 8]  # x, y, z
}

app = Flask(__name__)

# Configure CORS
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

class GeminiEnhancer:
    def __init__(self):
        self.api_key = GEMINI_API_KEY
        self.endpoint = "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent"

        self.system_prompt = """
        You are a helpful language assistant. Your job is to improve the clarity, grammar, and tone of short texts.

        Instructions:
        - First, correct any spelling or grammatical issues.
        - Then, if requested, rewrite the sentence using the specified tone.
        - Do not add or remove meaning from the original text.
        - Only respond with the corrected or rewritten sentence, no explanations.
        """.strip()

        self.tone_prompts = {
            "FRIENDLY": "Make this sound extremely friendly and approachable: ",
            "PROFESSIONAL": "Make this sound formal and professional for business communication: ",
            "CASUAL": "Make this sound casual and conversational: ",
            "PERSUASIVE": "Make this more persuasive and compelling: ",
            "ANGRY": "Make this sound angry and frustrated: ",
            "EXCITED": "Make this sound excited and enthusiastic: ",
            "SARCASTIC": "Make this sound sarcastic and ironic: "
        }

    def enhance_text(self, text: str, tone: str = "FRIENDLY") -> Dict:
        if not text.strip():
            return {"error": "Input is empty", "original": text}

        # Normalize the tone input
        tone = tone.upper()
        if tone not in self.tone_prompts:
            tone = "FRIENDLY"

        # # Step 1: Grammar correction
        # grammar_prompt = f"Correct grammar and improve clarity while keeping the original meaning:\n{text}"
        # grammar_result = self._call_gemini(grammar_prompt)
        # if not grammar_result["success"]:
        #     return {"error": grammar_result["error"], "original": text}

        # grammar_corrected = grammar_result["output"]

        # Step 2: Tone adjustment
        tone_instruction = self.tone_prompts.get(tone, self.tone_prompts["FRIENDLY"])
        tone_prompt = f"{tone_instruction}{text}"
        tone_result = self._call_gemini(tone_prompt)
        if not tone_result["success"]:
            return {
                "error": tone_result["error"],
                "original": text,
                "grammar_corrected": text
            }

        return {
            "original": text,
            "tone_adjusted": tone_result["output"],
            "success": True
        }

    def _call_gemini(self, prompt: str) -> Dict:
        try:
            response = requests.post(
                f"{self.endpoint}?key={self.api_key}",
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [
                        {
                            "role": "user",
                            "parts": [{"text": self.system_prompt}]
                        },
                        {
                            "role": "user",
                            "parts": [{"text": prompt}]
                        }
                    ]
                },
                timeout=15
            )

            if response.status_code == 200:
                output = response.json()["candidates"][0]["content"]["parts"][0]["text"]
                return {"success": True, "output": output.strip()}
            else:
                return {
                    "success": False,
                    "error": f"API error {response.status_code}: {response.text}"
                }

        except requests.RequestException as e:
            return {"success": False, "error": str(e)}

# Initialize the enhancer
text_enhancer = GeminiEnhancer()

@app.route('/predict', methods=['POST'])
def predict():
    """Endpoint for gesture prediction (using only 9 features per frame)"""
    try:
        data = request.get_json()
        new_data = data.get('sensor_data', [])

        expected_length = SEQUENCE_LENGTH * FEATURES_PER_FRAME
        if len(new_data) != expected_length:
            return jsonify({
                "error": f"Invalid data format, expected {expected_length} values (100 frames × 9 features), got {len(new_data)}.",
                "details": "Using only acceleration, gravity, and angular velocity features (3 values each)"
            }), 400
        
        # Reshape to (1, SEQUENCE_LENGTH, 9)
        data_buffer = np.array(new_data).reshape((1, SEQUENCE_LENGTH, FEATURES_PER_FRAME))
        
        prediction = model.predict(data_buffer)
        predicted_class = np.argmax(prediction, axis=1)
        result = unique_labels[predicted_class[0]]
        
        # Add confidence score
        confidence = float(prediction[0][predicted_class[0]])
        
        # Simply return the prediction result
        return jsonify({
            "prediction": result,
            "confidence": confidence
        })

    except Exception as e:
        import traceback
        error_details = {
            "error": str(e),
            "traceback": traceback.format_exc(),
            "input_length": len(new_data) if 'new_data' in locals() else None,
            "expected_length": SEQUENCE_LENGTH * FEATURES_PER_FRAME
        }
        print("Error details:", error_details)  # Print to server console
        return jsonify(error_details), 500

@app.route('/enhance-text', methods=['POST'])
def enhance_text():
    """Enhanced text processing with grammar correction and tone adjustment"""
    data = request.get_json()
    text = data.get('text', '')
    tone = data.get('tone', 'FRIENDLY').upper()
    
    if not text:
        return jsonify({"error": "No text provided"}), 400
    
    try:
        result = text_enhancer.enhance_text(text, tone)
        
        if result.get("error"):
            # Fallback gracefully by returning original text, avoiding a 500 crash in UI
            return jsonify({
                "original": text,
                "tone_adjusted": text,
                "grammar_corrected": text,
                "success": True,
                "api_error": result["error"]
            })
            
        return jsonify({
            "original": result["original"],
            "tone_adjusted": result["tone_adjusted"],
            "grammar_corrected": text,
            "success": True
        })
    except Exception as e:
        # Fallback gracefully on exception
        return jsonify({
            "original": text,
            "tone_adjusted": text,
            "grammar_corrected": text,
            "success": True,
            "exception_error": str(e)
        })

@app.route('/row-count', methods=['GET'])
def get_row_count():
    """Get the number of rows in the sensor.csv file"""
    try:
        with open(SENSOR_CSV_PATH, 'r') as file:
            # Subtract 1 to exclude the header row
            row_count = sum(1 for _ in file) - 1
            return jsonify({"row_count": row_count})
    except FileNotFoundError:
        return jsonify({"row_count": 0})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/save_csv', methods=['POST'])
def save_csv():
    """Save recorded data to sensor.csv"""
    try:
        data = request.get_json()
        rows = data.get('csv_data', [])
        
        if not rows:
            return jsonify({"error": "No data provided"}), 400

        filename = SENSOR_CSV_PATH
            
        # Append the data
        with open(filename, mode='a', newline='') as csvfile:
            for row in rows:
                # Split the row string into values and write directly
                csvfile.write(row + '\n')
            logging.info(f"Recorded {len(rows)} rows of data.")
            
        return jsonify({
            "message": f"Successfully saved {len(rows)} rows of data",
            "rows_saved": len(rows)
        })
        
    except Exception as e:
        logging.error(f"Error saving CSV data: {str(e)}")
        return jsonify({"error": f"Failed to save data: {str(e)}"}), 500

@app.route('/delete_rows', methods=['POST'])
def delete_rows():
    """Delete rows from sensor.csv by ID or label"""
    try:
        data = request.get_json()
        delete_type = data.get('type')
        delete_value = data.get('value')
        
        if not delete_type or not delete_value:
            return jsonify({"error": "Delete type and value must be provided"}), 400
            
        if delete_type not in ['id', 'label']:
            return jsonify({"error": "Invalid delete type. Must be 'id' or 'label'"}), 400
            
        # Read all rows
        rows = []
        with open(SENSOR_CSV_PATH, 'r') as file:
            reader = csv.reader(file)
            header = next(reader)  # Get header
            
            # Get the index for comparison based on type
            if delete_type == 'id':
                compare_index = 0  # ID is first column
            else:  # label
                compare_index = -1  # Character/Label is last column
                
            # Filter rows that don't match the delete value
            rows = [row for row in reader if row[compare_index] != str(delete_value)]
        
        # Calculate how many rows were deleted
        deleted_count = 0
        with open(SENSOR_CSV_PATH, 'r') as file:
            total_rows = sum(1 for _ in file) - 1  # -1 for header
            deleted_count = total_rows - len(rows)
        
        # Write back all rows except those matching the delete criteria
        with open(SENSOR_CSV_PATH, 'w', newline='') as file:
            writer = csv.writer(file)
            writer.writerow(header)
            writer.writerows(rows)
            
        return jsonify({
            "message": f"Successfully deleted {deleted_count} rows with {delete_type}: {delete_value}",
            "deleted_count": deleted_count
        })
        
    except Exception as e:
        logging.error(f"Error deleting rows: {str(e)}")
        return jsonify({"error": f"Failed to delete rows: {str(e)}"}), 500


@app.route('/train-model', methods=['POST'])
def train_model():
    try:
        # Read hyperparameters
        params = request.get_json()
        epochs = int(params.get('epochs', 8))
        batch_size = int(params.get('batch_size', 32))
        learning_rate = float(params.get('learning_rate', 0.001))

        # Load dataset
        data = pd.read_csv(SENSOR_CSV_PATH)

        feature_columns = [
            'Acceleration_x', 'Acceleration_y', 'Acceleration_z',
            'Gravity_x', 'Gravity_y', 'Gravity_z',
            'Angular Velocity_x', 'Angular Velocity_y', 'Angular Velocity_z'
        ]
        sequence_length = 100
        segments = []

        # Segment data by ID and sequence length
        for id_, group in data.groupby('ID'):
            label = group['Character'].iloc[0]
            samples = group[feature_columns].values
            for start in range(0, len(samples) - sequence_length + 1):
                segment = samples[start:start + sequence_length]
                segments.append((segment, label))

        segment_df = pd.DataFrame(segments, columns=['Segment', 'Label'])
        X = np.array(segment_df['Segment'].tolist())
        y = np.array(segment_df['Label'].tolist())

        y_encoded, unique_labels = pd.factorize(y)
        y_categorical = to_categorical(y_encoded)

        # Split dataset
        X_train, X_test, y_train, y_test = train_test_split(
            X, y_categorical, test_size=0.2, random_state=42)

        # Build LSTM model
        model = Sequential()
        model.add(LSTM(64, return_sequences=True, input_shape=(sequence_length, len(feature_columns))))
        model.add(Dropout(0.2))
        model.add(LSTM(64))
        model.add(Dropout(0.2))
        model.add(Dense(len(unique_labels), activation='softmax'))

        model.compile(
            loss='categorical_crossentropy',
            optimizer=Adam(learning_rate=learning_rate),
            metrics=['accuracy']
        )

        # Train model
        history = model.fit(
            X_train, y_train,
            epochs=epochs,
            batch_size=batch_size,
            validation_data=(X_test, y_test),
            verbose=1
        )

        # Evaluate on test set
        loss, accuracy = model.evaluate(X_test, y_test, verbose=0)

        # Predict classes for confusion matrix and PRF metrics
        y_pred_probs = model.predict(X_test)
        y_pred = np.argmax(y_pred_probs, axis=1)
        y_true = np.argmax(y_test, axis=1)

        # Confusion matrix
        cm = confusion_matrix(y_true, y_pred)
        cm_list = cm.tolist()

        # Precision, Recall, F1 per class
        precision, recall, f1_score, _ = precision_recall_fscore_support(
            y_true, y_pred, labels=range(len(unique_labels)), zero_division=0)

        prf_per_class = {}
        for i, label in enumerate(unique_labels):
            prf_per_class[label] = {
                'precision': float(precision[i]),
                'recall': float(recall[i]),
                'f1_score': float(f1_score[i])
            }

        # Save model and labels
        model.save(MODEL_PATH)
        np.save(LABELS_PATH, unique_labels)

        # Compose response
        metrics = {
            'status': 'completed',
            'epochs': len(history.history['loss']),
            'loss': history.history['loss'],
            'val_loss': history.history['val_loss'],
            'accuracy': history.history['accuracy'],
            'val_accuracy': history.history['val_accuracy'],
            'final_test_loss': float(loss),
            'final_test_accuracy': float(accuracy),
            'confusion_matrix': cm_list,
            'class_labels': list(unique_labels),
            'prf_per_class': prf_per_class,
            'final_metrics': {
                'Final Test Loss': float(loss),
                'Final Test Accuracy': float(accuracy)
            }
        }

        return jsonify(metrics)

    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)