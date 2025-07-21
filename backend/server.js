const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
require('dotenv').config();
const axios = require('axios'); // Keep axios if you use it for other external calls

const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Define Mongoose schema and model
const ThoughtSchema = new mongoose.Schema({
  text: String,
  cleaned: String,
  emotion: String,
  tasks: [String],
  topics: [String],
  date: { type: Date, default: Date.now }
});
const Thought = mongoose.model('Thought', ThoughtSchema);

// Process thought function using Gemini AI
async function processThought(text) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const [cleanedRes, emotionRes, taskRes, topicRes] = await Promise.all([
      model.generateContent([`Clean this thought and rephrase positively: "${text}"`]),
      model.generateContent([`Detect the emotion of this sentence: "${text}". Respond with a single word.`]),
      model.generateContent([`Break down this thought into 3 simple subtasks: "${text}"`]),
      model.generateContent([`Extract 2-3 main topics from this sentence: "${text}"`])
    ]);

    const cleaned = (await cleanedRes.response).text().trim();
    const emotion = (await emotionRes.response).text().trim();
    const tasksRaw = (await taskRes.response).text().trim().split(/\n|\*/).filter(line => line.trim());
    const topicsRaw = (await topicRes.response).text().trim().split(/,|\n|\*/).map(t => t.trim()).filter(Boolean);

    return { cleaned, emotion, tasks: tasksRaw, topics: topicsRaw };
  } catch (error) {
    console.error("❌ Gemini API error in processThought:", error.message || error);
    return {
      cleaned: "Sorry, I couldn't process this thought at the moment.",
      emotion: "unknown",
      tasks: [],
      topics: []
    };
  }
}

// POST endpoint - process and store thought
app.post('/api/clean', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "No text provided." });

  const { cleaned, emotion, tasks, topics } = await processThought(text);
  const newThought = new Thought({ text, cleaned, emotion, tasks, topics });
  await newThought.save();

  res.json(newThought);
});

// GET endpoint - get all processed thoughts
app.get('/api/thoughts', async (req, res) => {
  const thoughts = await Thought.find().sort({ date: -1 });
  res.json(thoughts);
});

// DELETE endpoint - delete a thought by ID
app.delete('/api/thoughts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Thought.deleteOne({ _id: id });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Thought not found." });
    }

    res.json({ message: "Thought deleted successfully." });
  } catch (err) {
    console.error("❌ Delete error:", err.message || err);
    res.status(500).json({ error: "Failed to delete thought." });
  }
});

// POST endpoint - RedFlagAI emotion + suggestion + pulse
app.post('/api/analyze-emotion', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "No text provided." });

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Ensure the emotion response is a single word
    const emotionRes = await model.generateContent(`Detect the primary emotion in this thought: "${text}". Respond with only one word (e.g., Happy, Sad, Angry, Anxious, Calm, Confused, Overwhelmed).`);
    const suggestionRes = await model.generateContent(`Suggest one concise helpful piece of advice for someone who feels: "${text}". Keep it under 20 words.`);

    const emotion = (await emotionRes.response).text().trim();
    const suggestion = (await suggestionRes.response).text().trim();

    let pulse = 85;
    const lowEmotions = ["sad", "angry", "hopeless", "depressed", "anxious", "overwhelmed", "confused"]; // Added more low emotions
    if (lowEmotions.includes(emotion.toLowerCase())) {
      pulse = Math.floor(Math.random() * 30) + 40; // Pulse between 40-69
    } else {
      pulse = Math.floor(Math.random() * 20) + 70; // Pulse between 70-89
    }

    res.json({ emotion, pulse, suggestion });
  } catch (error) {
    console.error("❌ Emotion analysis error:", error.message || error);
    res.status(500).json({ error: "Emotion analysis failed." });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
