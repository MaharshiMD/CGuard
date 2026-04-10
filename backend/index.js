const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

const { compareAST } = require("./engines/ast");
const { compareFingerprints } = require("./engines/fingerprint");
const { compareStylometry } = require("./engines/stylometry");

admin.initializeApp();

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

        const stylometryScore = compareStylometry(code, code);
        const responseData = {
            plagiarism_score: Math.round(Math.min(100, (maxStructuralSimilarity * 0.5 + maxFingerprintSimilarity * 0.3 + stylometryScore * 0.2) * 100)),
            ai_score: 0,
            semantic_similarity: Math.round(Math.min(100, (maxStructuralSimilarity * 0.4 + maxFingerprintSimilarity * 0.4 + stylometryScore * 0.2) * 100)),
            stylometry_score: Math.round(stylometryScore * 100),
            algorithm_type: "Internal Code Scan",
            clone_type: maxStructuralSimilarity > 0.7 ? "Type-2 Renamed" : "Original",
            cross_language_match: false,
            pdg_similarity: 0,
            explanation: "Analysis completed by internal CodeGuard heuristics based on structural and fingerprint similarity against stored scans.",
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
        const cleaned = text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
        const words = (cleaned.toLowerCase().match(/\b[a-z0-9']+\b/g) || []).map(w => w.replace(/'/g, ''));
        const totalWords = words.length;
        const uniqueWords = new Set(words).size;
        const uniqueWordRatio = totalWords ? uniqueWords / totalWords : 1;
        const repeatScore = 1 - uniqueWordRatio;
        const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim());
        const avgSentenceLength = sentences.length ? totalWords / sentences.length : totalWords;
        const lengthScore = Math.min(1, Math.max(0, (avgSentenceLength - 15) / 20));
        const lengthWeight = Math.min(1, totalWords / 500);

        const plagiarism_score = Math.round(Math.min(70, repeatScore * 40 + lengthScore * 20 + lengthWeight * 10));
        const ai_score = Math.round(Math.min(50, repeatScore * 30 + lengthScore * 15));
        const semantic_similarity = Math.round(Math.min(60, repeatScore * 30 + lengthScore * 20));
        const stylometry_score = Math.round(Math.min(55, lengthScore * 35 + repeatScore * 20));

        const responseData = {
            plagiarism_score,
            ai_score,
            semantic_similarity,
            stylometry_score,
            structural_score: 0,
            fingerprint_score: 0,
            pdg_similarity: 0,
            cross_language_match: false,
            algorithm_type: "Research Paper",
            clone_type: "N/A",
            matched_source: "Internal Analysis",
            source_url: "#",
            explanation: `Document analysis completed by internal heuristic metrics; external AI is not used.`,
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

        const stylometryScore = compareStylometry(code, code);
        const responseData = {
            plagiarism_score: Math.round(Math.min(100, (maxStructuralSimilarity * 0.5 + maxFingerprintSimilarity * 0.3 + stylometryScore * 0.2) * 100)),
            ai_score: 0,
            semantic_similarity: Math.round(Math.min(100, (maxStructuralSimilarity * 0.4 + maxFingerprintSimilarity * 0.4 + stylometryScore * 0.2) * 100)),
            stylometry_score: Math.round(stylometryScore * 100),
            algorithm_type: "Internal Code Scan",
            clone_type: maxStructuralSimilarity > 0.7 ? "Type-2 Renamed" : "Original",
            cross_language_match: false,
            pdg_similarity: 0,
            explanation: "Analysis completed by internal CodeGuard heuristics based on structural and fingerprint similarity against stored scans.",
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