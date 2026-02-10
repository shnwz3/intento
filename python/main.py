"""
Intento Python AI Service
FastAPI HTTP server for AI training, prompt optimization, and data cleaning.
Runs as a companion service alongside the Electron app.

Usage:
  cd python
  pip install -r requirements.txt
  python main.py
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import json
from services.prompt_optimizer import PromptOptimizer
from services.data_cleaner import DataCleaner

app = FastAPI(title="Intento AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

optimizer = PromptOptimizer()
cleaner = DataCleaner()

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "ready", "service": "intento-ai"}

@app.post("/optimize-prompt")
async def optimize_prompt(request: dict):
    """Optimize a system prompt based on feedback history"""
    prompt = request.get("prompt", "")
    feedback = request.get("feedback", [])
    
    optimized = optimizer.optimize(prompt, feedback)
    return {"success": True, "prompt": optimized}

@app.post("/clean-data")
async def clean_data(request: dict):
    """Clean and preprocess AI response data"""
    responses = request.get("responses", [])
    cleaned = cleaner.clean(responses)
    return {"success": True, "cleaned": cleaned}

@app.post("/analyze-quality")
async def analyze_quality(request: dict):
    """Analyze quality of AI responses for training feedback"""
    responses = request.get("responses", [])
    analysis = cleaner.analyze_quality(responses)
    return {"success": True, "analysis": analysis}

if __name__ == "__main__":
    print("🐍 Intento AI Service starting on port 5000...")
    uvicorn.run(app, host="127.0.0.1", port=5000, log_level="info")
