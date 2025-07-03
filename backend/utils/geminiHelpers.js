// utils/geminiHelpers.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function askGemini(prompt) {
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response.text();
    return response.trim();
  } catch (err) {
    console.error("❌ Gemini error:", err.message || err);
    return "Error generating content.";
  }
}

async function cleanThought(text) {
  return await askGemini(`Clean and rephrase this thought positively: "${text}"`);
}

async function detectEmotion(text) {
  return await askGemini(`Detect the core emotion in this sentence: "${text}". Respond in one word only.`);
}

async function suggestTipBasedOnThought(text) {
  return await askGemini(`Give one helpful suggestion to someone feeling like this: "${text}". Keep it under 20 words.`);
}

async function extractTasks(text) {
  const res = await askGemini(`Break this down into 3 simple subtasks:\n"${text}"`);
  return res.split(/\n|\*/).filter(line => line.trim());
}

async function extractTopics(text) {
  const res = await askGemini(`Extract 2-3 main topics from this:\n"${text}"`);
  return res.split(/,|\n|\*/).map(t => t.trim()).filter(Boolean);
}

async function summarizeDayJournal(entry) {
  return await askGemini(`Summarize this daily reflection in one uplifting sentence:\n"${entry}"`);
}

module.exports = {
  cleanThought,
  detectEmotion,
  suggestTipBasedOnThought,
  extractTasks,
  extractTopics,
  summarizeDayJournal
};
