const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const { compareAST } = require("./engines/ast");
const { compareFingerprints } = require("./engines/fingerprint");
const { compareStylometry } = require("./engines/stylometry");

admin.initializeApp();

if (!process.env.GEMINI_API_KEY) {
    console.error("FATAL: GEMINI_API_KEY environment variable is not set.");
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.analyzeCode = onCall({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'The user must be authenticated.');
    }

    const { code, filename, options } = request.data;

    if (!code || code.length > 500000) {
        throw new HttpsError('invalid-argument', 'Code is too large or empty.');
    }

    try {
        // 1. Fetch Previous Scans for comparison
        const previousScansSnapshot = await admin.firestore()
            .collection("scans")
            .orderBy("timestamp", "desc")
            .limit(50)
            .get();

        let maxStructuralSimilarity = 0;
        let maxFingerprintSimilarity = 0;
        let matchedFile = "Original";

        // 2. Compare against internal database
        previousScansSnapshot.forEach(doc => {
            const prev = doc.data();
            if (prev.code && prev.userId !== request.auth.uid) {
                const astScore = compareAST(code, prev.code);
                const printScore = compareFingerprints(code, prev.code);

                if (astScore > maxStructuralSimilarity) maxStructuralSimilarity = astScore;
                if (printScore > maxFingerprintSimilarity) maxFingerprintSimilarity = printScore;
                if (astScore > 70 || printScore > 70) matchedFile = prev.fileName || "Internal Database";
            }
        });

        // 3. AI Analysis
        const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" });
        const stylometryScore = compareStylometry(code, code);
        const prompt = `
        You are a code forensic expert. Analyze this code (${filename}) for plagiarism and AI generation.
        We already found: Structural Similarity: ${maxStructuralSimilarity}%, Fingerprint Similarity: ${maxFingerprintSimilarity}%.
        Matched Source: ${matchedFile}.
        
        ANALYSIS REQUIREMENTS:
        - Cross-Language Detection: Identify if this logic mirrors algorithms in other languages (e.g. Python vs Java).
        - Program Dependency Graph (PDG): Analyze data and control dependencies to detect deep logical clones.
        - Algorithm Recognition: Detect specific patterns like DFS, BFS, or DP.
        
        CODE:
        '''${code}'''
        
        Strictly return raw JSON data (no markdown, no code fences):
        {
            "plagiarism_score": (overall combined score 0-100),
            "ai_score": (AI generation confidence 0-100),
            "semantic_similarity": (0-100 score for logical similarity),
            "stylometry_score": ${stylometryScore},
            "algorithm_type": "string",
            "clone_type": "string",
            "cross_language_match": (boolean),
            "pdg_similarity": (0-100 score),
            "explanation": (concise summary string)
        }
        `;

        const result = await model.generateContent(prompt);
        const text = (await result.response).text();
        const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const aiData = JSON.parse(cleanJson);

        const responseData = {
            ...aiData,
            structural_score: maxStructuralSimilarity,
            fingerprint_score: maxFingerprintSimilarity,
            matched_source: matchedFile,
            timestamp: new Date().toISOString()
        };

        // 4. Save to history
        await admin.firestore().collection("scans").add({
            userId: request.auth.uid,
            fileName: filename || "unknown.js",
            code: code,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            results: responseData
        });

        return responseData;

    } catch (error) {
        console.error("Analysis Failed:", error);
        throw new HttpsError('internal', 'Analysis failed due to server error: ' + error.message);
    }
});

// =====================================
// PAPER PLAGIARISM ENDPOINT
// =====================================
exports.analyzePaper = onCall({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'The user must be authenticated.');
    }

    const { text, filename } = request.data;

    if (!text || text.length > 1000000) { // allowed up to 1MB of text for papers
        throw new HttpsError('invalid-argument', 'Document text is too large or empty.');
    }

    try {
        const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash", generationConfig: { temperature: 0.1 } });
        
        // Ensure we fit within context limits for very large papers
        const safeText = text.length > 250000 ? text.substring(0, 250000) + "...[truncated]" : text;

        const prompt = `
        You are an expert academic forensic analyst. Analyze this document (${filename}) for plagiarism, duplication against internet databases, and AI generation markers.
        Look for sudden tone shifts, hallmark AI phrasing (e.g. "delve", "testament to", "crucial"), and known internet sources.
        
        DOCUMENT TEXT:
        '''${safeText}'''
        
        Strictly return raw JSON data (no markdown, no code fences):
        {
            "plagiarism_score": (overall confidence of plagiarism 0-100),
            "ai_score": (overall confidence of AI generation 0-100),
            "semantic_similarity": (0-100, how closely this tracks known public essays/articles),
            "matched_source": "Name of primary plagiarized internet source or database, else 'Original'",
            "source_url": "HTTPS URL of the matched source if applicable, else 'none'",
            "explanation": "Brief 2-3 sentence explanation of your findings (why you flagged it for AI or plagiarism)."
        }
        `;

        const result = await model.generateContent(prompt);
        let responseText = (await result.response).text();
        const cleanJson = responseText.replace(/^```json[\s\S]*?(\{)/m, '$1').replace(/```$/g, '').trim();
        const aiData = JSON.parse(cleanJson);

        const responseData = {
            ...aiData,
            structural_score: 0,
            fingerprint_score: 0,
            stylometry_score: 0,
            pdg_similarity: 0,
            cross_language_match: false,
            algorithm_type: "Research Paper",
            clone_type: "N/A",
            matched_code: "",
            timestamp: new Date().toISOString()
        };

        // Save to history
        await admin.firestore().collection("scans").add({
            userId: request.auth.uid,
            fileName: filename || "document.txt",
            code: text, // using the 'code' field to store the document string to maintain dashboard history compatibility
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            results: responseData,
            scanType: "paper"
        });

        return responseData;

    } catch (error) {
        console.error("Paper Analysis Failed:", error);
        throw new HttpsError('internal', 'Analysis failed due to server error: ' + error.message);
    }
});

// =====================================
// PUBLIC REST API ENDPOINT
// =====================================
exports.scan = onRequest({ cors: true }, async (req, res) => {
    // 1. Authenticate API Key
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized. Missing or invalid Bearer token." });
    }
    
    const apiKey = authHeader.split("Bearer ")[1].trim();
    if (!apiKey) {
        return res.status(401).json({ error: "Unauthorized. Empty API Key." });
    }

    try {
        // Query users collection to find matching API Key
        const usersSnapshot = await admin.firestore().collection("users").where("apiKey", "==", apiKey).limit(1).get();
        if (usersSnapshot.empty) {
            return res.status(401).json({ error: "Unauthorized. Invalid API Key." });
        }
        
        const userDoc = usersSnapshot.docs[0];
        const userId = userDoc.id;

        // 2. Validate Payload
        const { code, filename } = req.body;
        if (!code || typeof code !== "string" || code.trim().length === 0) {
            return res.status(400).json({ error: "Bad Request. Missing or empty 'code' field." });
        }
        if (code.length > 500000) {
            return res.status(400).json({ error: "Payload Too Large. Code exceeds maximum length." });
        }

        const safeFilename = filename || "api_upload.js";

        // 3. Backend Scan Logic 
        // 3a. Search previous scans
        const previousScansSnapshot = await admin.firestore()
            .collection("scans")
            .orderBy("timestamp", "desc")
            .limit(50)
            .get();

        let maxStructuralSimilarity = 0;
        let maxFingerprintSimilarity = 0;
        let matchedFile = "Original";

        previousScansSnapshot.forEach(doc => {
            const prev = doc.data();
            if (prev.code && prev.userId !== userId) {
                const astScore = compareAST(code, prev.code);
                const printScore = compareFingerprints(code, prev.code);

                if (astScore > maxStructuralSimilarity) maxStructuralSimilarity = astScore;
                if (printScore > maxFingerprintSimilarity) maxFingerprintSimilarity = printScore;
                if (astScore > 70 || printScore > 70) matchedFile = prev.fileName || "Internal Database";
            }
        });

        // 3b. AI Analysis
        const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" });
        const stylometryScore = compareStylometry(code, code);
        const prompt = `
        You are a code forensic expert. Analyze this code (${safeFilename}) for plagiarism and AI generation.
        We already found: Structural Similarity: ${maxStructuralSimilarity}%, Fingerprint Similarity: ${maxFingerprintSimilarity}%.
        Matched Source: ${matchedFile}.
        
        Strictly return raw JSON data (no markdown, no code fences):
        {
            "plagiarism_score": (0-100),
            "ai_score": (0-100),
            "semantic_similarity": (0-100),
            "stylometry_score": ${stylometryScore},
            "algorithm_type": "string",
            "clone_type": "string",
            "cross_language_match": (boolean),
            "pdg_similarity": (0-100),
            "explanation": "string"
        }
        `;

        const result = await model.generateContent(prompt);
        let text = (await result.response).text();
        const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const aiData = JSON.parse(cleanJson);

        const responseData = {
            ...aiData,
            structural_score: maxStructuralSimilarity,
            fingerprint_score: maxFingerprintSimilarity,
            matched_source: matchedFile,
            timestamp: new Date().toISOString()
        };

        // 4. Record Scan to User History
        await admin.firestore().collection("scans").add({
            userId: userId,
            fileName: safeFilename,
            code: code,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            results: responseData,
            source: "API"
        });

        // 5. Return JSON payload
        return res.status(200).json(responseData);

    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ error: "Internal Server Error during analysis." });
    }
});