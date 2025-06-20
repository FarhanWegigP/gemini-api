const express = require('express');
const dotenv = require('dotenv');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mammoth = require('mammoth');

dotenv.config();

const app = express();
app.use(express.json());

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Configure file uploads
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
const upload = multer({ dest: uploadDir });

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Gemini API server is running at http://localhost:${PORT}`);
});

// Generate from text prompt
app.post('/generate-text', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required.' });
    }
    try {
        const result = await model.generateContent(prompt);
        const response = result.response;
        const outputText = await response.text();
        res.json({ output: outputText });
    } catch (error) {
        console.error('Error generating text:', error);
        res.status(500).json({ error: 'Failed to generate text', details: error.message });
    }
});

function fileToGenerativePart(filePath, mimeType) {
    return {
        inlineData: {
            data: fs.readFileSync(filePath).toString('base64'),
            mimeType,
        },
    };
}

// Generate from image file
app.post('/generate-from-image', upload.single('image'), async (req, res) => {
    const prompt = req.body.prompt || 'Describe the image';
    if (!req.file) {
        return res.status(400).json({ error: 'No image file uploaded.' });
    }
    try {
        const imagePart = fileToGenerativePart(req.file.path, req.file.mimetype);
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const outputText = await response.text();
        res.json({ output: outputText });
    } catch (error) {
        console.error('Error generating from image:', error);
        res.status(500).json({ error: 'Failed to generate from image', details: error.message });
    } finally {
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting temp file:', err);
            });
        }
    }
});

// Generate from document file (.docx)
app.post('/generate-from-document', upload.single('document'), async (req, res) => {
    const prompt = req.body.prompt || 'Analyze this document:';
    if (!req.file) {
        return res.status(400).json({ error: 'No document file uploaded.' });
    }
    const filePath = req.file.path;
    try {
        const { value: extractedText } = await mammoth.extractRawText({ path: filePath });
        const fullPrompt = `${prompt}\n\n---\n\n${extractedText}`;
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const outputText = await response.text();
        res.json({ output: outputText });
    } catch (error) {
        console.error('Error generating from document:', error);
        res.status(500).json({ error: 'Failed to generate from document', details: error.message });
    } finally {
        if (req.file) {
            fs.unlink(filePath, (err) => {
                if (err) console.error('Error deleting temp file:', err);
            });
        }
    }
});

// Generate from audio file
app.post('/generate-from-audio', upload.single('audio'), async (req, res) => {
    const prompt = req.body.prompt || 'Transcribe this audio:';
    if (!req.file) {
        return res.status(400).json({ error: 'No audio file uploaded.' });
    }
    try {
        const audioPart = fileToGenerativePart(req.file.path, req.file.mimetype);
        const result = await model.generateContent([prompt, audioPart]);
        const response = await result.response;
        const outputText = await response.text();
        res.json({ output: outputText });
    } catch (error) {
        console.error('Error generating from audio:', error);
        res.status(500).json({ error: 'Failed to generate from audio', details: error.message });
    } finally {
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting temp file:', err);
            });
        }
    }
});
