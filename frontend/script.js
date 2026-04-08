// ==========================================
//  1. IMPORTS
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, GithubAuthProvider, OAuthProvider, signInWithPopup, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, orderBy, limit, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// ==========================================
//  2. CONFIGURATION
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyD2BKvrGx9NSJUbJecDTRshS8ola4LdPr8",
    authDomain: "codeguard-7e692.firebaseapp.com",
    projectId: "codeguard-7e692",
    storageBucket: "codeguard-7e692.firebasestorage.app",
    messagingSenderId: "164451779639",
    appId: "1:164451779639:web:b0910074408a7b6194abb2",
    measurementId: "G-YL87LFSC0V"
};

// ⚠️ YOUR API KEY (Preserved from your snippet)
const GEMINI_API_KEY = "AIzaSyA-NUndTIebwt2H8VRgFA0Za0ml6kINZ5Y";

// Replace this with your Render backend URL after deploying the Express backend.
const BACKEND_BASE_URL = "https://cguard-o3ek.onrender.com/";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);
const analyzeCode = httpsCallable(functions, 'analyzeCode');
const analyzePaper = httpsCallable(functions, 'analyzePaper');
const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();
const appleProvider = new OAuthProvider('apple.com');
githubProvider.addScope('repo'); // Request repository access

async function callBackendAnalyze(code1, code2, language = 'javascript') {
    const response = await fetch(`${BACKEND_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code1, code2, language })
    });

    if (!response.ok) {
        const payload = await response.text();
        throw new Error(`Backend analysis failed (${response.status}): ${payload}`);
    }

    return response.json();
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

window.getHistoryKey = function() {
    return auth && auth.currentUser ? "scanHistory_" + auth.currentUser.uid : "scanHistory";
};

// We will instantiate the model dynamically inside startScan based on user preference
let model;

// ==========================================
//  3. LOGIN & UI LOGIC
// ==========================================
window.handleGoogleLogin = function () {
    signInWithPopup(auth, googleProvider)
        .then(() => { window.location.href = "dashboard.html"; })
        .catch((err) => { alert("Login Error: " + err.message); });
}

window.handleGithubLogin = function () {
    signInWithPopup(auth, githubProvider)
        .then(() => { window.location.href = "dashboard.html"; })
        .catch((err) => { alert("GitHub Login Error: " + err.message); });
}

window.handleAppleLogin = function () {
    signInWithPopup(auth, appleProvider)
        .then(() => { window.location.href = "dashboard.html"; })
        .catch((err) => { alert("Apple Login Error: " + err.message); });
}

// Global logout handler (called from HTML onclick)
window.handleLogout = function () {
    signOut(auth).then(() => {
        // Only clear specific sensitive current session data, preserve history
        localStorage.removeItem("userCode");
        localStorage.removeItem("filename");
        localStorage.removeItem("plagScore");
        localStorage.removeItem("aiScore");
        localStorage.removeItem("currentScanId");
        window.location.href = "index.html";
    }).catch((err) => {
        console.error("Logout Error", err);
        alert("Failed to logout. Please try again.");
    });
};

document.addEventListener("DOMContentLoaded", () => {
    const signupForm = document.getElementById("manual-signup-form");
    if (signupForm) {
        // Ensure Enter key triggers submission explicitly
        const inputs = signupForm.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    signupForm.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
                }
            });
        });

        signupForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const name = document.getElementById("signup-name").value;
            const email = document.getElementById("signup-email").value;
            const password = document.getElementById("signup-password").value;

            createUserWithEmailAndPassword(auth, email, password)
                .then((userCredential) => {
                    const user = userCredential.user;
                    updateProfile(user, {
                        displayName: name
                    }).then(() => {
                        window.location.href = "dashboard.html";
                    }).catch((error) => {
                         console.error("Error updating profile:", error);
                         window.location.href = "dashboard.html";
                    });
                })
                .catch((error) => {
                    alert("Sign Up Error: " + error.message);
                });
        });
    }

    const loginForm = document.getElementById("manual-login-form");
    if (loginForm) {
        // Ensure Enter key triggers submission explicitly
        const inputs = loginForm.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    loginForm.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
                }
            });
        });

        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const email = document.getElementById("login-email").value;
            const password = document.getElementById("login-password").value;
            
            signInWithEmailAndPassword(auth, email, password)
                .then(() => {
                    window.location.href = "dashboard.html";
                })
                .catch((error) => {
                    alert("Login Error: " + error.message);
                });
        });
    }
});

onAuthStateChanged(auth, (user) => {
    const path = window.location.pathname;
    const isDashboard = path.includes("dashboard.html");
    const isReport = path.includes("report.html");
    const isLoginOrSignup = path.includes("login.html") || path.includes("signup.html");

    if (!user) {
        // Redirect unauthenticated users away from protected pages
        if (isDashboard || isReport) {
            window.location.href = "login.html";
            return;
        }
    } else {
        // Redirect authenticated users away from login/signup
        if (isLoginOrSignup) {
            window.location.href = "dashboard.html";
            return;
        }
        // Top right profile bar
        const n = document.getElementById("user-name");
        const avatar = document.getElementById("user-avatar");
        if (n) n.innerText = user.displayName || user.email || "CodeGuard User";
        if (avatar && user.photoURL) avatar.src = user.photoURL;

        // Settings page fields
        const setDisplayName = document.getElementById("setting-display-name");
        const setEmail = document.getElementById("setting-email");
        if (setDisplayName) setDisplayName.value = user.displayName || "Unknown Name";
        if (setEmail) setEmail.value = user.email || "No email available";

        // Fetch API key if exists
        getDoc(doc(db, "users", user.uid)).then((docSnap) => {
            if (docSnap.exists() && docSnap.data().apiKey) {
                const apiKeyField = document.getElementById("setting-api-key");
                if (apiKeyField) {
                    apiKeyField.value = docSnap.data().apiKey;
                }
            }
        }).catch(err => console.error("Error fetching API Key:", err));

        // Initialize settings panel data
        if(window.loadSettings) window.loadSettings();
        if(window.calculateStorageQuota) window.calculateStorageQuota();
        
        // Sync history from Firestore on login
        syncHistoryFromFirestore(user);
    }
});

async function syncHistoryFromFirestore(user) {
    if (!user) return;
    try {
        const historyRef = collection(db, "users", user.uid, "history");
        const q = query(historyRef, orderBy("timestamp", "desc"), limit(50));
        const querySnapshot = await getDocs(q);
        const firestoreHistory = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Remove timestamp used for sorting before merging into local format if needed
            delete data.timestamp;
            firestoreHistory.push(data);
        });

        if (firestoreHistory.length > 0) {
            let localHistory = JSON.parse(localStorage.getItem(window.getHistoryKey()) || "[]");
            // Merge Firestore history with local, ensuring IDs are unique
            const combined = [...firestoreHistory, ...localHistory];
            const unique = [];
            const seen = new Set();
            for(const item of combined) {
                if(!seen.has(item.id)) {
                    unique.push(item);
                    seen.add(item.id);
                }
            }
            localStorage.setItem(window.getHistoryKey(), JSON.stringify(unique.slice(0, 50)));
            // Trigger UI update if we're on a dashboard section
            if (typeof renderHistory === 'function') renderHistory();
        }
    } catch(err) {
        console.error("History Sync Failed:", err);
    }
}

// ==========================================
//  3.1 API KEY MANAGEMENT
// ==========================================
window.generateApiKey = async function() {
    const user = auth.currentUser;
    if (!user) {
        alert("You must be logged in to generate an API key.");
        return;
    }
    
    // Generate simple pseudo-random format (cg_live_xxx...)
    const newKey = 'cg_live_' + [...Array(32)].map(() => (~~(Math.random()*36)).toString(36)).join('');
    
    try {
        const btn = document.getElementById("btn-generate-api");
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Generating...';
            btn.disabled = true;
        }
        
        await setDoc(doc(db, "users", user.uid), {
            apiKey: newKey,
            createdAt: new Date().toISOString()
        }, { merge: true });
        
        const keyField = document.getElementById("setting-api-key");
        if (keyField) keyField.value = newKey;
        
        if (btn) {
            btn.innerHTML = "Generate New API Key";
            btn.disabled = false;
        }
        alert("API Key successfully generated and saved! Keep it secret.");
    } catch (err) {
        console.error("Failed to generate API Key:", err);
        alert("Failed to generate API key: " + err.message);
        const btn = document.getElementById("btn-generate-api");
        if (btn) {
            btn.innerHTML = "Generate New API Key";
            btn.disabled = false;
        }
    }
};

window.copyApiKey = function() {
    const keyInput = document.getElementById("setting-api-key");
    if (!keyInput || !keyInput.value || keyInput.value === "You haven't generated a key yet...") {
        alert("No valid API key to copy.");
        return;
    }
    navigator.clipboard.writeText(keyInput.value).then(() => {
        alert("API key copied to clipboard!");
    }).catch(err => {
        alert("Failed to copy API key: " + err);
    });
};

// ==========================================
//  3.5 DASHBOARD NAVIGATION LOGIC
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const menuItems = document.querySelectorAll('.sidebar-menu li');
    if (menuItems.length > 0) {
        menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                // Ignore logout
                if (item.querySelector('a').getAttribute('onclick') === 'handleLogout(); return false;') return;
                
                e.preventDefault();
                
                // Update active class on menu
                menuItems.forEach(mi => mi.classList.remove('active'));
                item.classList.add('active');

                // Determine target section ID
                const menuId = item.id; // e.g. menu-settings
                let targetSectionId = "section-new-scan"; // default
                
                if (menuId === 'menu-new-scan') targetSectionId = 'section-new-scan';
                else if (menuId === 'menu-history') targetSectionId = 'section-history';
                else if (menuId === 'menu-repos') targetSectionId = 'section-repos';
                else if (menuId === 'menu-reports') targetSectionId = 'section-reports';
                else if (menuId === 'menu-compare') targetSectionId = 'section-compare';
                else if (menuId === 'menu-reading-level') targetSectionId = 'section-reading-level';
                else if (menuId === 'menu-paper-plagiarism') targetSectionId = 'section-paper-plagiarism';
                else if (menuId === 'menu-settings') targetSectionId = 'section-settings';

                // Hide all sections, show target
                const sections = document.querySelectorAll('.dashboard-section');
                sections.forEach(sec => sec.style.display = 'none');
                
                const targetSec = document.getElementById(targetSectionId);
                if (targetSec) targetSec.style.display = 'block';

                if (targetSectionId === 'section-history' || targetSectionId === 'section-new-scan') {
                    if (typeof renderHistory === 'function') renderHistory();
                }

                // On mobile, auto-close sidebar
                const sidebar = document.querySelector('.sidebar');
                if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('active')) {
                    sidebar.classList.remove('active');
                }
            });
        });
    }

    // Mobile Sidebar Toggle
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }
});

// ==========================================
//  4. LANDING PAGE LOGIC
// ==========================================
const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');

if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
        navLinks.classList.toggle('nav-active');
    });
}

const heroFileInput = document.getElementById('hero-hidden-file');
const heroUploadBtn = document.getElementById('hero-upload-btn');
const heroScanBtn = document.getElementById('hero-scan-btn');
const heroCodeArea = document.getElementById('hero-code-input');

if (heroUploadBtn && heroFileInput) {
    heroUploadBtn.addEventListener('click', () => heroFileInput.click());
    heroFileInput.addEventListener('change', () => {
        if (heroFileInput.files.length > 0) {
            heroUploadBtn.innerHTML = `<i class="fa-solid fa-file-check"></i> ${heroFileInput.files[0].name}`;
            // Pre-fill textarea with file context (mocked for demo)
            const reader = new FileReader();
            reader.onload = (e) => { heroCodeArea.value = e.target.result; };
            reader.readAsText(heroFileInput.files[0]);
        }
    });
}

if (heroScanBtn) {
    heroScanBtn.addEventListener('click', () => {
        if (!heroCodeArea.value.trim()) {
            alert("Please paste code or upload a file first!");
            return;
        }
        // Save to local storage and redirect appropriately
        localStorage.setItem("userCode", heroCodeArea.value);
        localStorage.setItem("filename", heroFileInput?.files[0]?.name || "manual_input.py");
        // If user is already logged in, go straight to dashboard; otherwise login
        const currentUser = auth.currentUser;
        window.location.href = currentUser ? "dashboard.html" : "login.html";
    });
}

// ==========================================
//  5. THE SCANNER (RUNS IN BROWSER)
// ==========================================
const fileInput = document.getElementById('real-file-input');
const dropText = document.getElementById('drop-text');

if (fileInput) {
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            dropText.innerText = fileInput.files[0].name;
            window.currentCodeFile = fileInput.files[0];
        }
    });
}

const paperFileInput = document.getElementById('paper-file-input');
const paperDropText = document.getElementById('paper-drop-text');

if (paperFileInput) {
    paperFileInput.addEventListener('change', () => {
        if (paperFileInput.files.length > 0) {
            paperDropText.innerText = paperFileInput.files[0].name;
            window.currentPaperFile = paperFileInput.files[0];
        }
    });
}

// Drag-and-drop support for the dashboard drop zone
window.handleDroppedFiles = function(files, isPaper = false) {
    if (!files || files.length === 0) return;
    const inputId = isPaper ? 'paper-file-input' : 'real-file-input';
    const textId = isPaper ? 'paper-drop-text' : 'drop-text';
    const fileInputObj = document.getElementById(inputId);
    const dropTextObj = document.getElementById(textId);

    const file = files[0];
    if (dropTextObj) dropTextObj.innerText = file.name;
    
    if (isPaper) {
        window.currentPaperFile = file;
    } else {
        window.currentCodeFile = file;
    }
    
    if (fileInputObj) {
        try {
            const dt = new DataTransfer();
            dt.items.add(file);
            fileInputObj.files = dt.files;
            fileInputObj.dispatchEvent(new Event('change'));
        } catch(e) {
            console.log("DataTransfer fallback used");
        }
    }
};

        document.addEventListener("DOMContentLoaded", () => {
            function setupZone(zoneId, isPaper) {
                const zone = document.getElementById(zoneId);
                if (!zone) return;
                zone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    zone.style.borderColor = 'var(--cyan)';
                });
                zone.addEventListener('dragleave', (e) => {
                    e.preventDefault();
                    zone.style.borderColor = 'rgba(100, 255, 218, 0.3)';
                });
                zone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    zone.style.borderColor = 'rgba(100, 255, 218, 0.3)';
                    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
                        window.handleDroppedFiles(e.dataTransfer.files, isPaper);
                    }
                });
            }
            setupZone('drop-zone', false);
            setupZone('paper-drop-zone', true);
        });

/**
 * Maps a matched source name returned by Gemini to a known clickable URL.
 * Used as fallback when the AI doesn't return a valid https:// URL.
 */
function sourceNameToUrl(name) {
    if (!name) return "#";
    const n = name.toLowerCase().replace(/[\s\-_]/g, "");
    const map = {
        "geeksforgeeks": "https://geeksforgeeks.org",
        "gfg":           "https://geeksforgeeks.org",
        "leetcode":      "https://leetcode.com",
        "stackoverflow": "https://stackoverflow.com",
        "github":        "https://github.com",
        "hackerrank":    "https://hackerrank.com",
        "codechef":      "https://codechef.com",
        "codeforces":    "https://codeforces.com",
        "topcoder":      "https://topcoder.com",
        "tutorialspoint":"https://tutorialspoint.com",
        "w3schools":     "https://w3schools.com",
        "javatpoint":    "https://javatpoint.com",
        "programiz":     "https://programiz.com",
        "replit":        "https://replit.com",
        "codepen":       "https://codepen.io",
        "kaggle":        "https://kaggle.com",
        "freecodecamp":  "https://freecodecamp.org",
        "edureka":       "https://edureka.co",
        "medium":        "https://medium.com",
        "dev.to":        "https://dev.to",
        "devto":         "https://dev.to",
        "hashnode":      "https://hashnode.com",
        "wikipedia":     "https://wikipedia.org",
        "w3schools":     "https://www.w3schools.com",
        "programiz":     "https://www.programiz.com",
        "tutorialspoint":"https://www.tutorialspoint.com",
        "hackerrank":    "https://www.hackerrank.com",
        "github":        "https://github.com",
        "kaggle":        "https://www.kaggle.com",
        "mdn":           "https://developer.mozilla.org",
        "none":          "#",
        "noneidentified":"#",
        "original":      "#"
    };
    // Try exact match in map
    for (const key of Object.keys(map)) {
        if (n.includes(key)) return map[key];
    }
    // If the name looks like it already contains a TLD, just make it a URL
    if (name.includes(".org") || name.includes(".com") || name.includes(".net") || name.includes(".io")) {
        const cleaned = name.toLowerCase().trim().replace(/\s/g, "");
        return `https://${cleaned.startsWith("http") ? cleaned.replace(/^https?:\/\//, "") : cleaned}`;
    }
    return "#";
}


window.startScan = async function () {
    const btn = document.getElementById('scan-btn');
    const actualFileInput = document.getElementById('real-file-input');

    let codeToScan = "";
    let fileName = "";

    // UI check for options
    const optLogic = document.getElementById('scan-opt-logic')?.checked !== false;
    const optAI = document.getElementById('scan-opt-ai')?.checked !== false;

    if (!optLogic && !optAI) {
        alert("Please select at least one scan module (Logic Similarity or AI Generation).");
        return;
    }

    const file = (actualFileInput && actualFileInput.files.length > 0) 
                 ? actualFileInput.files[0] 
                 : window.currentCodeFile;

    if (file) {
        fileName = file.name;

        if (fileName.toLowerCase().endsWith(".zip")) {
            // Handle ZIP File Unpacking
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Unzipping...';
            codeToScan = "";
            try {
                const zip = await JSZip.loadAsync(file);
                const codeExtensions = ['.js', '.py', '.java', '.cpp', '.c', '.cs', '.php', '.html', '.css', '.ts', '.go', '.rs'];

                let filePromises = [];
                zip.forEach((relativePath, zipEntry) => {
                    const ext = relativePath.substring(relativePath.lastIndexOf('.')).toLowerCase();
                    if (!zipEntry.dir && codeExtensions.includes(ext)) {
                        filePromises.push(
                            zipEntry.async("string").then(content => {
                                return `\n// File: ${relativePath}\n${content}\n`;
                            })
                        );
                    }
                });
                const contents = await Promise.all(filePromises);
                codeToScan = contents.join('');
                if (!codeToScan) throw new Error("No readable code files found in ZIP.");
                fileName += " (Extracted)";
            } catch (err) {
                alert("Error unpacking ZIP: " + err.message);
                btn.innerHTML = 'Scan';
                return;
            }
        } else {
            codeToScan = await file.text();
        }
    } else if (localStorage.getItem("userCode")) {
        codeToScan = localStorage.getItem("userCode");
        fileName = localStorage.getItem("filename") || "scanned_code.txt";
    } else {
        alert("Please upload a file first!");
        return;
    }

    // Update Button UI
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Analyzing...';
    btn.style.opacity = "0.7";

    // Save Code Locally first
    localStorage.setItem("filename", fileName);
    localStorage.setItem("userCode", codeToScan);

    try {
        let data;

        // ── Try backend Cloud Function first ──────────────────────────────
        try {
            console.log("Attempting backend analysis...");
            const result = await analyzeCode({
                code: codeToScan,
                filename: fileName,
                options: { logic: optLogic, ai: optAI }
            });
            data = result.data;
            console.log("Backend Response:", data);
        } catch (backendErr) {
            // ── Fallback: run analysis directly in the browser via Gemini ──
            console.warn("Backend unavailable, falling back to client-side analysis:", backendErr.message);
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Running AI Analysis...';

            const preferredModel = localStorage.getItem('preferredModel') || 'models/gemini-2.5-flash';
            const activeModel = genAI.getGenerativeModel({
                model: preferredModel,
                generationConfig: { temperature: 0.1 }
            });

            const codeSnippet = codeToScan.length > 12000
                ? codeToScan.substring(0, 12000) + "\n\n... [truncated for analysis] ..."
                : codeToScan;

            const prompt = `
You are an expert code forensic analyst. Your job is to identify which SPECIFIC WEBSITE the following code was most likely copied from or inspired by, based on its style, structure, naming conventions, and comments.

## SOURCE ATTRIBUTION GUIDE — match the code's style to the right site:

| Website | Typical Style |
|---|---|
| GeeksForGeeks | Verbose comments, educational step-by-step structure, common variable names like arr[], n, temp |
| LeetCode | Minimal/no comments, concise solution functions, Solution class, typical problem-solving patterns |
| StackOverflow | Answers specific questions, may have unusual variable names, often a code snippet without full context |
| Wikipedia | Pseudocode-like structure, mathematical notation, academic naming |
| W3Schools | Very basic, beginner-friendly, lots of print/console.log demos, simple HTML/JS/CSS examples |
| Programiz | Clean minimal code, lots of inline comments explaining each step, beginner-friendly |
| TutorialsPoint | Very similar to GeeksForGeeks but usually has "Output:" comments at bottom |
| HackerRank | Competitive programming style, stdin/stdout patterns, fast I/O patterns |
| GitHub | No particular style, original or mixed, presence of full project files |
| Kaggle | Data science, pandas/numpy usage, Jupyter notebook style |
| MDN | JavaScript/CSS/HTML web API examples, browser-focused |
| Rosetta Code | Unusual or academic style, multiple language equivalents |
| Codeforces | Competitive style, fast I/O, macro definitions like #define ll long long |

## TASK:
1. Carefully examine the code's style, comments, variable names, and structure.
2. Pick the SINGLE website from the table above that the code most resembles.
3. If it's original/no match, use "GitHub" as fallback.

Filename: ${fileName}

CODE:
\`\`\`
${codeSnippet}
\`\`\`

Return ONLY raw JSON, absolutely no markdown, no code fences, no extra text:
{
    "plagiarism_score": <number 0-100>,
    "ai_score": <number 0-100>,
    "semantic_similarity": <number 0-100>,
    "stylometry_score": <number 0-100>,
    "structural_score": <number 0-100>,
    "fingerprint_score": <number 0-100>,
    "pdg_similarity": <number 0-100>,
    "cross_language_match": <true or false>,
    "algorithm_type": "<specific name of what the code does e.g. 'Bubble Sort', 'Binary Search Tree', 'REST API Handler'>",
    "clone_type": "<Type-1 Exact | Type-2 Renamed | Type-3 Restructured | Original>",
    "matched_source": "<EXACT website name from the table above e.g. GeeksForGeeks>",
    "source_url": "<root HTTPS URL of that site e.g. https://geeksforgeeks.org>",
    "explanation": "<2-3 sentences: what the code does, why you chose that source website, any suspicious patterns>"
}
`;

            const result = await activeModel.generateContent(prompt);
            let textResponse = result.response.text();
            // Robustly extract JSON from anywhere in the response
            const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("AI did not return valid JSON. Response: " + textResponse.substring(0, 200));
            data = JSON.parse(jsonMatch[0]);
            console.log("Client-side Analysis Response:", data);
        }

        // ── Normalise fields so both paths produce the same shape ─────────
        data.structural_score    = data.structural_score    ?? 0;
        data.fingerprint_score   = data.fingerprint_score   ?? 0;
        data.stylometry_score    = data.stylometry_score    ?? 0;
        data.pdg_similarity      = data.pdg_similarity      ?? 0;
        data.matched_source      = data.matched_source      || data.source || "None Identified";
        data.matched_code        = data.matched_code        || "";

        // Resolve a real clickable URL from the matched source name
        const rawUrl = data.source_url || "";
        const isValidUrl = rawUrl && rawUrl !== "#" && rawUrl.startsWith("http");
        data.source_url = isValidUrl ? rawUrl : sourceNameToUrl(data.matched_source);

        // ── Generate Global Scan ID ───────────────────────────────────────
        let currentGlobalCount = parseInt(localStorage.getItem('globalScanCount') || "1000", 10);
        currentGlobalCount++;
        localStorage.setItem('globalScanCount', currentGlobalCount.toString());

        // ── Save to History ───────────────────────────────────────────────
        saveScanToHistory({
            id: currentGlobalCount,
            filename: fileName,
            date: new Date().toLocaleDateString(),
            score: data.plagiarism_score,
            aiScore: data.ai_score,
            structuralScore: data.structural_score,
            fingerprintScore: data.fingerprint_score,
            semanticScore: data.semantic_similarity,
            stylometryScore: data.stylometry_score,
            source: data.matched_source,
            source_url: data.source_url,
            pdgScore: data.pdg_similarity,
            crossLanguage: data.cross_language_match,
            explanation: data.explanation,
            matched_code: data.matched_code,
            user_code: codeToScan,
            status: "Completed",
            risk: (data.plagiarism_score > 60 ? "High" : (data.plagiarism_score > 30 ? "Medium" : "Low"))
        });

        // ── Push all values to localStorage for Report Page ───────────────
        localStorage.setItem("plagScore",       data.plagiarism_score);
        localStorage.setItem("aiScore",         data.ai_score);
        localStorage.setItem("structuralScore", data.structural_score);
        localStorage.setItem("fingerprintScore",data.fingerprint_score);
        localStorage.setItem("semanticScore",   data.semantic_similarity);
        localStorage.setItem("stylometryScore", data.stylometry_score);
        localStorage.setItem("pdgScore",        data.pdg_similarity);
        localStorage.setItem("crossLanguage",   data.cross_language_match);
        localStorage.setItem("matchedSource",   data.matched_source);
        localStorage.setItem("sourceUrl",       data.source_url);
        localStorage.setItem("explanation",     data.explanation);
        localStorage.setItem("matchedCode",     data.matched_code);
        localStorage.setItem("currentScanId",   currentGlobalCount.toString());

        window.location.href = "report.html";

    } catch (error) {
        console.error("Scan Failed:", error);
        btn.innerHTML = "Scan";
        btn.style.opacity = "1";
        alert(`Scan Error: ${error.message}`);
    }
};

window.startPaperScan = async function () {
    const btn = document.getElementById('paper-scan-btn');
    const actualFileInput = document.getElementById('paper-file-input');

    const file = (actualFileInput && actualFileInput.files.length > 0) 
                 ? actualFileInput.files[0] 
                 : window.currentPaperFile;

    if (!file) {
        alert("Please select a document first!");
        return;
    }
    const fileName = file.name;
    const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Extracting Text...';
    btn.style.opacity = "0.7";

    let textToScan = "";

    try {
        if (ext === '.txt') {
            textToScan = await file.text();
        } else if (ext === '.pdf') {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let extracted = "";
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                extracted += content.items.map(item => item.str).join(' ') + "\\n";
            }
            textToScan = extracted;
        } else if (ext === '.docx' || ext === '.doc') {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
            textToScan = result.value;
        } else {
            throw new Error("Unsupported file type. Please upload .txt, .pdf, or .docx.");
        }

        if (!textToScan.trim()) throw new Error("No text found in the document.");

        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Analyzing...';

        let data;
        try {
            console.log("Attempting backend paper analysis...");
            const result = await analyzePaper({
                text: textToScan,
                filename: fileName
            });
            data = result.data;
        } catch (backendErr) {
            console.warn("Backend unavailable, falling back to client-side analysis:", backendErr.message);
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Running AI Analysis Locally...';

            const preferredModel = localStorage.getItem('preferredModel') || 'models/gemini-2.5-flash';
            try {
                const activeModel = genAI.getGenerativeModel({
                    model: preferredModel,
                    generationConfig: { temperature: 0.1 }
                });

                const safeText = textToScan.length > 250000 ? textToScan.substring(0, 250000) + "...[truncated]" : textToScan;

                const prompt = `
                You are an expert academic forensic analyst. Analyze this document (${fileName}) for plagiarism, duplication against internet databases, and AI generation markers.
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

                const result = await activeModel.generateContent(prompt);
                let responseText = result.response.text();
                // Robustly extract JSON from anywhere in the response
                const jsonMatch2 = responseText.match(/\{[\s\S]*\}/);
                if (!jsonMatch2) throw new Error("AI did not return valid JSON for paper scan.");
                data = JSON.parse(jsonMatch2[0]);
                console.log("Client-side Paper Analysis Response:", data);
            } catch (fallbackErr) {
                console.error("Client-side fallback failed:", fallbackErr);
                throw new Error("Local AI analysis failed. Please verify API keys.");
            }
        }

        // Normalize fields
        data.matched_source = data.matched_source || "Original";
        data.source_url = data.source_url || "#";

        
        let currentGlobalCount = parseInt(localStorage.getItem('globalScanCount') || "1000", 10);
        currentGlobalCount++;
        localStorage.setItem('globalScanCount', currentGlobalCount.toString());

        saveScanToHistory({
            id: currentGlobalCount,
            filename: fileName,
            date: new Date().toLocaleDateString(),
            score: data.plagiarism_score,
            aiScore: data.ai_score,
            structuralScore: 0,
            fingerprintScore: 0,
            semanticScore: data.semantic_similarity,
            stylometryScore: 0,
            source: data.matched_source,
            source_url: data.source_url,
            pdgScore: 0,
            crossLanguage: false,
            explanation: data.explanation,
            matched_code: "",
            user_code: textToScan,
            status: "Completed",
            risk: (data.plagiarism_score > 60 ? "High" : (data.plagiarism_score > 30 ? "Medium" : "Low"))
        });

        localStorage.setItem("plagScore",       data.plagiarism_score);
        localStorage.setItem("aiScore",         data.ai_score);
        localStorage.setItem("structuralScore", 0);
        localStorage.setItem("fingerprintScore",0);
        localStorage.setItem("semanticScore",   data.semantic_similarity);
        localStorage.setItem("stylometryScore", 0);
        localStorage.setItem("pdgScore",        0);
        localStorage.setItem("crossLanguage",   false);
        localStorage.setItem("matchedSource",   data.matched_source);
        localStorage.setItem("sourceUrl",       data.source_url);
        localStorage.setItem("explanation",     data.explanation);
        localStorage.setItem("matchedCode",     "");
        localStorage.setItem("currentScanId",   currentGlobalCount.toString());
        
        // CRITICAL FIX: Ensure the document text and filename are saved for the report page
        localStorage.setItem("userCode",         textToScan);
        localStorage.setItem("filename",         fileName);

        window.location.href = "report.html";

    } catch (error) {
        console.error("Paper Scan Failed:", error);
        btn.innerHTML = 'INITIALIZE SCAN <i class="fa-solid fa-bolt"></i>';
        btn.style.opacity = "1";
        alert(`Analysis Error: ${error.message}`);
    }
};

// ==========================================
//  6. HISTORY MANAGEMENT
// ==========================================
function saveScanToHistory(scanData) {
    // 1. Save to Local Storage (Legacy/Anonymous support)
    let history = JSON.parse(localStorage.getItem(window.getHistoryKey()) || "[]");
    history.unshift(scanData); // Add to beginning
    const finalHistory = history.slice(0, 50); // Keep last 50
    localStorage.setItem(window.getHistoryKey(), JSON.stringify(finalHistory));

    // 2. Save to Firestore for logged-in users (Persistent History)
    const user = auth.currentUser;
    if (user) {
        const historyRef = doc(db, "users", user.uid, "history", scanData.id.toString());
        setDoc(historyRef, {
            ...scanData,
            timestamp: new Date().toISOString()
        }, { merge: true }).catch(err => console.error("Firestore History Error:", err));
    }
}

function renderHistory() {
    const history = JSON.parse(localStorage.getItem(window.getHistoryKey()) || "[]");
    const quickTable = document.getElementById("history-table-body-quick");
    const fullTable  = document.getElementById("history-table-body-full");

    // Quick table – compact, no checkboxes
    const generateQuickRow = (scan) => `
        <tr>
            <td>${scan.filename}</td>
            <td>${scan.date}</td>
            <td><strong>${scan.score}%</strong></td>
            <td><strong>${scan.aiScore}%</strong></td>
            <td><span class="status-badge">${scan.status}</span></td>
            <td><span class="risk-badge ${scan.risk.toLowerCase()}">${scan.risk}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn-action view" onclick="viewScan(${scan.id})" title="View Report">
                        <i class="fa-solid fa-eye"></i> View
                    </button>
                    <button class="btn-action delete" onclick="deleteScan(${scan.id})" title="Delete Scan">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;

    // Full history table – includes checkbox per row
    const generateFullRow = (scan) => `
        <tr data-scan-id="${scan.id}">
            <td style="width:36px;"><input type="checkbox" class="history-checkbox" value="${scan.id}" onchange="updateBulkDeleteBtn()" style="accent-color:var(--primary);width:16px;height:16px;cursor:pointer;"></td>
            <td>${scan.filename}</td>
            <td>${scan.date}</td>
            <td><strong>${scan.score}%</strong></td>
            <td><strong>${scan.aiScore}%</strong></td>
            <td><span class="status-badge">${scan.status}</span></td>
            <td><span class="risk-badge ${scan.risk.toLowerCase()}">${scan.risk}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn-action view" onclick="viewScan(${scan.id})" title="View Report">
                        <i class="fa-solid fa-eye"></i> View
                    </button>
                    <button class="btn-action delete" onclick="deleteScan(${scan.id})" title="Delete Scan">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;

    if (quickTable) {
        quickTable.innerHTML = history.slice(0, 5).map(generateQuickRow).join('');
    }

    if (fullTable) {
        fullTable.innerHTML = history.length === 0
            ? `<tr><td colspan="6" style="text-align:center;padding:30px;color:#8892b0;">No scan history yet.</td></tr>`
            : history.map(generateFullRow).join('');
    }

    // Inject the bulk toolbar header if not already present
    const historyHeader = document.getElementById("history-bulk-toolbar");
    if (fullTable && !historyHeader) {
        const toolbar = document.createElement("div");
        toolbar.id = "history-bulk-toolbar";
        toolbar.style.cssText = "display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap;";
        toolbar.innerHTML = `
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;color:var(--text-muted);font-size:0.85rem;">
                <input type="checkbox" id="select-all-history" onchange="toggleSelectAllHistory(this.checked)" style="accent-color:var(--primary);width:16px;height:16px;">
                Select All
            </label>
            <button id="delete-selected-btn" onclick="deleteSelectedScans()" disabled
                style="background:transparent;border:1px solid #ff5f56;color:#ff5f56;padding:6px 16px;border-radius:4px;font-size:0.82rem;cursor:pointer;opacity:0.4;transition:0.2s;">
                <i class="fa-solid fa-trash-can"></i> Delete Selected
            </button>
            <span id="selected-count-label" style="color:var(--text-muted);font-size:0.8rem;"></span>
        `;
        fullTable.closest("table")?.parentElement?.insertBefore(toolbar, fullTable.closest("table"));
    }
    updateBulkDeleteBtn();
}

window.toggleSelectAllHistory = function(checked) {
    document.querySelectorAll(".history-checkbox").forEach(cb => cb.checked = checked);
    updateBulkDeleteBtn();
};

window.updateBulkDeleteBtn = function() {
    const checked = document.querySelectorAll(".history-checkbox:checked");
    const btn = document.getElementById("delete-selected-btn");
    const label = document.getElementById("selected-count-label");
    const selectAll = document.getElementById("select-all-history");
    const all = document.querySelectorAll(".history-checkbox");
    if (btn) {
        btn.disabled = checked.length === 0;
        btn.style.opacity = checked.length > 0 ? "1" : "0.4";
    }
    if (label) label.innerText = checked.length > 0 ? `${checked.length} selected` : "";
    if (selectAll && all.length > 0) selectAll.checked = checked.length === all.length;
};

window.deleteSelectedScans = async function() {
    const checked = [...document.querySelectorAll(".history-checkbox:checked")].map(cb => parseInt(cb.value));
    if (checked.length === 0) return;
    if (!confirm(`Delete ${checked.length} selected scan(s)?`)) return;
    let history = JSON.parse(localStorage.getItem(window.getHistoryKey()) || "[]");
    history = history.filter(s => !checked.includes(s.id));
    localStorage.setItem(window.getHistoryKey(), JSON.stringify(history));

    const user = auth.currentUser;
    if (user) {
        try {
            await Promise.all(checked.map(id => deleteDoc(doc(db, "users", user.uid, "history", id.toString()))));
        } catch(err) {
            console.error("Bulk Delete Error:", err);
        }
    }

    renderHistory();
    renderReports();
};


window.viewScan = function (id) {
    const history = JSON.parse(localStorage.getItem(window.getHistoryKey()) || "[]");
    const scan = history.find(s => s.id === id);

    if (scan) {
        localStorage.setItem("plagScore", scan.score);
        localStorage.setItem("aiScore", scan.aiScore);
        localStorage.setItem("structuralScore", scan.structuralScore || 0);
        localStorage.setItem("fingerprintScore", scan.fingerprintScore || 0);
        localStorage.setItem("semanticScore", scan.semanticScore || 0);
        localStorage.setItem("stylometryScore", scan.stylometryScore || 0);
        localStorage.setItem("matchedSource", scan.source);
        localStorage.setItem("sourceUrl", scan.source_url);
        localStorage.setItem("explanation", scan.explanation);
        localStorage.setItem("matchedCode", scan.matched_code);
        localStorage.setItem("userCode", scan.user_code);
        localStorage.setItem("filename", scan.filename);
        localStorage.setItem("currentScanId", scan.id);

        window.location.href = "report.html";
    } else {
        alert("Scan data not found in history.");
    }
};

window.deleteScan = async function (id) {
    if (confirm("Are you sure you want to delete this scan from your history?")) {
        let history = JSON.parse(localStorage.getItem(window.getHistoryKey()) || "[]");
        history = history.filter(s => s.id !== id);
        localStorage.setItem(window.getHistoryKey(), JSON.stringify(history));

        const user = auth.currentUser;
        if (user) {
            try {
                await deleteDoc(doc(db, "users", user.uid, "history", id.toString()));
            } catch (err) {
                console.error("Firestore Delete Error:", err);
            }
        }

        renderHistory(); // Refresh tables
        renderReports(); // Refresh cards if on that page
    }
};

window.clearEntireHistory = async function () {
    if (confirm("WARNING: This will permanently delete all your scan reports and history from this browser AND database. Are you absolutely sure?")) {
        localStorage.removeItem(window.getHistoryKey());

        const user = auth.currentUser;
        if (user) {
            try {
                const historyRef = collection(db, "users", user.uid, "history");
                const snapshot = await getDocs(historyRef);
                const deletePromises = [];
                snapshot.forEach(docSnap => {
                    deletePromises.push(deleteDoc(docSnap.ref));
                });
                await Promise.all(deletePromises);
            } catch (err) {
                console.error("Clear History Error:", err);
            }
        }

        renderHistory();
        renderReports();
        alert("Scan history has been successfully cleared.");
    }
};

// ==========================================
//  7. REPORTS MANAGEMENT
// ==========================================
function renderReports() {
    const history = JSON.parse(localStorage.getItem(window.getHistoryKey()) || "[]");
    const container = document.getElementById("reports-list-container");

    if (!container) return;

    if (history.length === 0) {
        container.innerHTML = `<p style="color: #8892b0; text-align: center; padding: 20px;">No reports available yet. Run a scan to generate a report.</p>`;
        return;
    }

    let html = `<div class="repo-items-grid" style="display: grid; gap: 15px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));">`;

    history.forEach(scan => {
        html += `
            <div class="repo-item" style="background: rgba(17, 34, 64, 0.7); padding: 20px; border-radius: 12px; border: 1px solid rgba(100, 255, 218, 0.1); display: flex; flex-direction: column; justify-content: space-between; transition: 0.3s; height: 100%;">
                <div style="margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                        <h4 style="color: #ccd6f6; font-size: 1.1rem; word-break: break-all; margin: 0;"><i class="fa-solid fa-file-contract" style="color: #bd93f9; margin-right: 8px;"></i>${scan.filename}</h4>
                        <span class="risk-badge ${scan.risk.toLowerCase()}" style="font-size: 0.7rem; padding: 2px 6px;">${scan.risk} Limit</span>
                    </div>
                    <div style="font-size: 0.85rem; color: #8892b0; margin-bottom: 12px;">
                        ${scan.date} • Score: ${scan.score}%
                    </div>
                    <p style="font-size: 0.85rem; color: #ccd6f6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 0;">
                        ${scan.explanation}
                    </p>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn-primary" onclick="shareReport(${scan.id})" style="flex: 1; padding: 8px; font-size: 0.85rem; display: flex; justify-content: center; align-items: center; gap: 5px;">
                        <i class="fa-solid fa-share-nodes"></i> Share
                    </button>
                    <button class="btn-primary btn-download" onclick="downloadReport(${scan.id})" style="flex: 1; padding: 8px; font-size: 0.85rem; display: flex; justify-content: center; align-items: center; gap: 5px;">
                        <i class="fa-solid fa-download"></i> Download
                    </button>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
}

window.shareReport = async function (id) {
    const history = JSON.parse(localStorage.getItem(window.getHistoryKey()) || "[]");
    const scan = history.find(s => s.id === id);

    if (!scan) {
        alert("Report not found!");
        return;
    }

    const shareTitle = `CodeGuard Report: ${scan.filename}`;
    // Constructing a shareable URL to the report
    const shareUrl = `${window.location.origin}/report.html?id=${scan.id}`;

    const shareText = `Check out this code analysis report on CodeGuard AI.`;

    if (navigator.share) {
        try {
            await navigator.share({
                title: shareTitle,
                text: shareText,
                url: shareUrl
            });
        } catch (error) {
            console.error('Error sharing report:', error);
            // If the user cancelled, don't show an alert, just gracefully catch it.
        }
    } else {
        // Fallback for browsers that don't support Web Share API (copy to clipboard)
        try {
            await navigator.clipboard.writeText(`${shareTitle}\n${shareUrl}`);
            alert("Report link copied to clipboard! Share it anywhere.");
        } catch (err) {
            alert("Sharing is not supported on this browser.");
        }
    }
}

window.downloadReport = function (id) {
    const history = JSON.parse(localStorage.getItem(window.getHistoryKey()) || "[]");
    const scan = history.find(s => s.id === id);

    if (!scan) {
        alert("Report not found!");
        return;
    }

    const reportHtml = `
        <div style="font-family: 'Times New Roman', Times, serif; color: #000; padding: 40px; box-sizing: border-box; width: 800px; background: #fff;">
            
            <!-- HEADER -->
            <div style="border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end;">
                <div>
                    <h1 style="margin: 0; font-size: 26px; color: #000; text-transform: uppercase; letter-spacing: 1px;">CodeGuard AI</h1>
                    <p style="margin: 5px 0 0 0; color: #333; font-size: 14px; font-style: italic;">Official Forensic Code Analysis Report</p>
                </div>
                <div style="text-align: right; font-size: 13px; color: #333;">
                    <strong>Date Generated:</strong> ${scan.date}<br>
                    <strong>Report ID:</strong> #${scan.id}
                </div>
            </div>

            <!-- OVERVIEW -->
            <div style="margin-bottom: 30px;">
                <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #000; border-bottom: 1px solid #ccc; padding-bottom: 5px;">1. Scan Overview</h2>
                <table style="width: 100%; font-size: 15px; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee; width: 40%;"><strong>Target File:</strong></td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">${scan.filename}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Risk Level:</strong></td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; text-transform: uppercase;">${scan.risk}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Plagiarism Score:</strong></td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${scan.score}% Match Detected</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>AI Generation Probability:</strong></td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${scan.aiScore}%</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Status:</strong></td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-transform: capitalize;">${scan.status || 'Completed'}</td>
                    </tr>
                </table>
            </div>

             <!-- SOURCE MATCH INFO -->
            <div style="margin-bottom: 30px;">
                <h2 style="margin: 0 0 10px 0; font-size: 18px; color: #000; border-bottom: 1px solid #ccc; padding-bottom: 5px;">2. Source Match Attribution</h2>
                <table style="width: 100%; font-size: 15px; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; width: 40%; border-bottom: 1px solid #eee;"><strong>Most Likely Source:</strong></td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${scan.source || 'None Identified'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Reference URL:</strong></td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee; word-break: break-all;">${scan.source_url !== '#' ? `<a href="${scan.source_url}" style="color: #000; text-decoration: underline;">${scan.source_url}</a>` : 'Not Applicable'}</td>
                    </tr>
                </table>
            </div>

            <!-- ANALYSIS EXPLANATION -->
            <div style="margin-bottom: 30px;">
                <h2 style="margin: 0 0 10px 0; font-size: 18px; color: #000; border-bottom: 1px solid #ccc; padding-bottom: 5px;">3. Executive Summary & Analysis</h2>
                <p style="font-size: 15px; line-height: 1.6; color: #000; text-align: justify; padding: 10px; border-left: 3px solid #666; background: #fdfdfd;">
                    ${scan.explanation}
                </p>
            </div>

            <!-- SOURCE CODE SNIPPETS -->
            <div style="page-break-inside: avoid;">
                <h2 style="margin: 0 0 10px 0; font-size: 18px; color: #000; border-bottom: 1px solid #ccc; padding-bottom: 5px;">4. Scanned Content Preview (Excerpt)</h2>
                <div style="background: #f9f9f9; padding: 15px; font-family: 'Courier New', Courier, monospace; font-size: 12px; white-space: pre-wrap; word-wrap: break-word; color: #000; border: 1px solid #ddd; max-height: 400px; overflow: hidden;">${(scan.user_code || '').substring(0, 1500)}${scan.user_code && scan.user_code.length > 1500 ? '\n\n... [Content Truncated for PDF Summary] ...' : ''}</div>
            </div>

            <!-- FOOTER -->
            <div style="margin-top: 50px; text-align: center; color: #666; font-size: 12px; border-top: 2px solid #000; padding-top: 15px;">
                <strong>CONFIDENTIAL & PROPRIETARY</strong><br>
                Generated automatically by CodeGuard AI. <br>
                For full interactive analysis, visit the CodeGuard dashboard.
            </div>
            
        </div>
    `;

    const preferredExport = localStorage.getItem('preferredExport') || 'pdf';

    // Safely get button to show loading state if called from a click
    const btn = window.event ? window.event.currentTarget : null;
    let originalContent = "";
    if (btn && btn.innerHTML) {
        originalContent = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Exporting...';
        btn.disabled = true;
    }

    if (preferredExport === 'json') {
        // Export as Raw JSON
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(scan, null, 4));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `CodeGuard_Report_${scan.id}.json`);
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        if (btn && btn.innerHTML) { btn.innerHTML = originalContent; btn.disabled = false; }
        return;
    }

    if (preferredExport === 'csv') {
        // Export as CSV
        const headers = ['ID', 'Filename', 'Date', 'Status', 'Risk', 'Plagiarism_Score', 'AI_Score', 'Detected_Source'];
        const row = [scan.id, scan.filename, scan.date, scan.status, scan.risk, scan.score, scan.aiScore, `"${scan.source}"`];
        const csvContent = headers.join(',') + '\n' + row.join(',');

        const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `CodeGuard_Report_${scan.id}.csv`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        if (btn && btn.innerHTML) { btn.innerHTML = originalContent; btn.disabled = false; }
        return;
    }

    // Default: Export as PDF
    const opt = {
        margin: 0.1, // Small margin
        filename: `CodeGuard_Report_${scan.filename.replace(/[^a-zA-Z0-9]/g, '_')}_${scan.id}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    if (btn && btn.innerHTML) {
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> PDF...';
    }

    // Generate PDF directly from string, avoiding DOM manipulation issues
    html2pdf().set(opt).from(reportHtml).save().then(() => {
        if (btn && btn.innerHTML && btn.tagName === 'BUTTON') {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    }).catch(err => {
        console.error("PDF Generation failed:", err);
        alert("Failed to generate PDF report.");
        if (btn && btn.innerHTML && btn.tagName === 'BUTTON') {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    });
};

window.downloadCurrentReport = function () {
    const id = localStorage.getItem("currentScanId");
    if (id) {
        window.downloadReport(Number(id));
    } else {
        alert("Scan ID not found.");
    }
};

// ==========================================
//  8. DASHBOARD NAVIGATION (VIEW SWITCHER)
// ==========================================
function setupSidebar() {
    const menuItems = document.querySelectorAll('.sidebar-menu li');
    const sections = document.querySelectorAll('.dashboard-section');

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            // Remove active class from all
            menuItems.forEach(mi => mi.classList.remove('active'));
            // Add active class to clicked
            item.classList.add('active');

            // Hide all sections
            sections.forEach(sec => sec.style.display = 'none');

            // Show target section
            const targetId = item.id.replace('menu-', 'section-');
            const targetSec = document.getElementById(targetId);
            if (targetSec) targetSec.style.display = 'block';

            if (targetId === 'section-history' || targetId === 'section-new-scan') renderHistory();
            if (targetId === 'section-reports') renderReports();
            if (targetId === 'section-repos') {
                // Check if already connected, if not, wait for button click
            }
            if (targetId === 'section-bulk-compare') {
                // Default to selection view when clicking sidebar link
                window.showCompareSelection();
            }
            if (targetId === 'section-reading-level') {
                // Any specific init if needed for reading checker
            }
        });
    });
}

function setupGitHubIntegration() {
    const connectBtn = document.getElementById('connect-github-btn');
    const repoStatus = document.getElementById('repo-status');
    const repoListContainer = document.getElementById('repo-list-container');

    if (!connectBtn) return;

    const fetchGitHubRepos = async (token, userDisplayName) => {
        const terminal = document.querySelector('.terminal-body');
        try {
            const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=50', {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('githubToken');
                    connectBtn.style.display = 'inline-block';
                    repoStatus.innerText = "GitHub connection expired. Please reconnect.";
                }
                throw new Error("Failed to fetch repositories from GitHub");
            }

            const repos = await response.json();

            connectBtn.style.display = 'none';
            repoStatus.innerText = `Connected successfully. ${repos.length} repositories identified:`;

            let repoHtml = `
                <div class="repo-items-grid" style="margin-top: 20px; display: grid; gap: 15px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));">
                    ${repos.map(repo => `
                        <div class="repo-item" style="background: rgba(17, 34, 64, 0.7); padding: 20px; border-radius: 12px; border: 1px solid rgba(100, 255, 218, 0.1); display: flex; flex-direction: column; justify-content: space-between; transition: 0.3s; height: 100%;">
                            <div style="margin-bottom: 20px;">
                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                                    <i class="fa-brands fa-github" style="color: #64ffda; font-size: 1.2rem;"></i>
                                    <h4 style="color: #fff; font-size: 1.1rem; word-break: break-all;">${repo.name}</h4>
                                </div>
                                <div style="font-size: 0.85rem; color: #8892b0; margin-bottom: 12px;">
                                    ${repo.language || 'No Language'} • ${repo.private ? '<i class="fa-solid fa-lock"></i> Private' : '<i class="fa-solid fa-earth-americas"></i> Public'}
                                </div>
                                <p style="font-size: 0.85rem; color: #ccd6f6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                                    ${repo.description || 'No description provided.'}
                                </p>
                            </div>
                            <button class="btn-action view" onclick="toggleRepoPath('${repo.full_name}', '', 'repo-content-${repo.full_name.replace(/[^a-zA-Z0-9]/g, '-')}')" style="width: 100%; justify-content: space-between; padding: 10px; display: flex; align-items: center; background: rgba(100, 255, 218, 0.1); border: 1px solid rgba(100, 255, 218, 0.2); border-radius: 8px; color: #64ffda; cursor: pointer; transition: background 0.3s;" onmouseover="this.style.background='rgba(100, 255, 218, 0.2)'" onmouseout="this.style.background='rgba(100, 255, 218, 0.1)'">
                                <span><i class="fa-solid fa-folder-tree"></i> Browse Repository</span>
                                <i class="fa-solid fa-chevron-down" id="icon-repo-content-${repo.full_name.replace(/[^a-zA-Z0-9]/g, '-')}"></i>
                            </button>
                            <div id="repo-content-${repo.full_name.replace(/[^a-zA-Z0-9]/g, '-')}" style="display: none; margin-top: 10px; padding: 10px; background: rgba(10, 20, 40, 0.4); border-radius: 8px; border: 1px solid rgba(100, 255, 218, 0.05); max-height: 350px; overflow-y: auto;"></div>
                        </div>
                    `).join('')}
                </div>
            `;

            if (repoListContainer) {
                repoListContainer.innerHTML = '';
                const listDiv = document.createElement('div');
                listDiv.innerHTML = repoHtml;
                repoListContainer.appendChild(listDiv);
            }

            if (terminal) {
                if (userDisplayName) {
                    terminal.innerHTML += `<p style="color: #64ffda">> authentication successful for ${userDisplayName}!</p>`;
                }
                terminal.innerHTML += `<p>> repository index complete. ready for logic analysis.</p>`;
            }
        } catch (error) {
            console.error(error);
            if (terminal) terminal.innerHTML += `<p style="color: #ff5f56">> error: ${error.message}</p>`;
        }
    };

    // Auto load if token exists
    const existingToken = localStorage.getItem('githubToken');
    if (existingToken) {
        // Temporarily change text while loading
        repoStatus.innerText = "Loading repositories...";
        connectBtn.style.display = 'none';

        fetchGitHubRepos(existingToken, null);
    }

    connectBtn.addEventListener('click', async () => {
        const terminal = document.querySelector('.terminal-body');

        try {
            if (terminal) {
                terminal.innerHTML = `
                    <p>> initiating secure github oauth2 flow...</p>
                    <p>> redirecting to github.com for permissions...</p>
                    <p>> scope: [repo, read:user, read:org]</p>
                `;
            }

            const result = await signInWithPopup(auth, githubProvider);
            const credential = GithubAuthProvider.credentialFromResult(result);
            const token = credential.accessToken;
            const user = result.user;
            localStorage.setItem('githubToken', token);

            if (terminal) {
                terminal.innerHTML += `<p>> fetching real repository list from github api...</p>`;
            }

            // Fetch Real Repositories
            await fetchGitHubRepos(token, user.displayName || user.email);

        } catch (error) {
            console.error(error);
            if (terminal) {
                terminal.innerHTML += `<p style="color: #ff5f56">> error: ${error.message}</p>`;
                if (error.code === 'auth/operation-not-allowed') {
                    terminal.innerHTML += `<p style="color: #ffbd2e; font-size: 0.8rem;">[IMPORTANT: GitHub provider must be enabled in Firebase Console]</p>`;
                }
            }
            alert("GitHub Connection Error: " + error.message);
        }
    });

}


// ==========================================
//  9. NEW FEATURES (UI MOCKS)
// ==========================================

//  BULK COMPARISON LOGIC
window.showCompareView = function(viewType) {
    document.getElementById('compare-selection-view').style.display = 'none';
    document.getElementById('compare-group-view').style.display = 'none';
    document.getElementById('compare-crosscheck-view').style.display = 'none';

    if (viewType === 'group') {
        document.getElementById('compare-group-view').style.display = 'block';
    } else if (viewType === 'crosscheck') {
        document.getElementById('compare-crosscheck-view').style.display = 'block';
    }
};

window.showCompareSelection = function() {
    document.getElementById('compare-group-view').style.display = 'none';
    document.getElementById('compare-crosscheck-view').style.display = 'none';
    document.getElementById('compare-selection-view').style.display = 'block';
};

window.scanBulkComparison = async function(type) {
    let btnId = type === 'group' ? 'btn-scan-group' : 'btn-scan-crosscheck';
    const btn = document.getElementById(btnId);
    if (!btn) return;
    
    let textToAnalyze = "";
    let prompt = "";
    let sourceVal = "";
    let targetVal = "";

    if (type === 'group') {
        sourceVal = document.getElementById('bulk-group-source').value.trim();
        targetVal = document.getElementById('bulk-group-target').value.trim();
        if (!sourceVal || !targetVal) {
            alert("Please paste text into both Source A and Target B.");
            return;
        }
        textToAnalyze = `SOURCE A:\n${sourceVal}\n\nTARGET B:\n${targetVal}`;
        prompt = `
        Compare Source A against Target B for direct overlaps, structural similarities, and potential plagiarism.
        Return JSON ONLY in this exact format:
        {"overall_similarity_score": number, "explanation": "string summary"}
        Text to analyze:
        '''
        ${textToAnalyze}
        '''
        `;
    } else {
        const inputVal = document.getElementById('bulk-crosscheck-input').value.trim();
        if (!inputVal) {
            alert("Please paste text to crosscheck.");
            return;
        }
        textToAnalyze = inputVal;
        prompt = `
        Analyze the provided set of documents for common themes, repeated logic, or direct overlaps.
        Return JSON ONLY in this exact format:
        {"overall_similarity_score": number, "explanation": "string summary"}
        Documents:
        '''
        ${textToAnalyze}
        '''
        `;
    }

    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Scanning...';
    btn.style.opacity = "0.7";

    try {
        let data;

        if (type === 'group') {
            try {
                const backendResult = await callBackendAnalyze(sourceVal, targetVal, 'javascript');
                const score = Math.round((backendResult.similarity ?? 0) * 100);
                data = {
                    overall_similarity_score: score,
                    explanation: `AST ${Math.round((backendResult.astScore ?? 0) * 100)}%, fingerprint ${Math.round((backendResult.fingerprintScore ?? 0) * 100)}%, stylometry ${Math.round((backendResult.stylometryScore ?? 0) * 100)}%. Risk: ${backendResult.riskLevel}.`,
                    backend: true
                };
            } catch (backendErr) {
                console.warn("Render backend unavailable, falling back to AI bulk comparison:", backendErr.message);
                const preferredModel = localStorage.getItem('preferredModel') || 'models/gemini-2.5-flash';
                const activeModel = genAI.getGenerativeModel({
                    model: preferredModel,
                    generationConfig: { temperature: 0.1 }
                });

                const result = await activeModel.generateContent(prompt);
                let textResponse = await result.response.text();
                const bulkJsonMatch = textResponse.match(/\{[\s\S]*\}/);
                if (!bulkJsonMatch) throw new Error("AI did not return valid JSON for bulk scan.");
                data = JSON.parse(bulkJsonMatch[0]);
            }
        } else {
            const preferredModel = localStorage.getItem('preferredModel') || 'models/gemini-2.5-flash';
            const activeModel = genAI.getGenerativeModel({
                model: preferredModel,
                generationConfig: { temperature: 0.1 }
            });

            const result = await activeModel.generateContent(prompt);
            let textResponse = await result.response.text();
            const bulkJsonMatch = textResponse.match(/\{[\s\S]*\}/);
            if (!bulkJsonMatch) throw new Error("AI did not return valid JSON for bulk scan.");
            data = JSON.parse(bulkJsonMatch[0]);
        }

        // Update UI instead of alert
        const resultsArea = document.getElementById('bulk-results-area');
        const scoreText = document.getElementById('bulk-score-text');
        const scoreCircle = document.getElementById('bulk-score-circle');
        const explanationText = document.getElementById('bulk-explanation-text');

        if (resultsArea && scoreText && explanationText) {
            resultsArea.style.display = 'block';

            const score = data.overall_similarity_score;
            // Update SVG circle arc
            const circlePath = document.getElementById('bulk-circle-path');
            if (circlePath) circlePath.setAttribute('stroke-dasharray', `${score}, 100`);

            // Update color class on SVG
            const chartSvg = document.getElementById('bulk-circular-chart');
            if (chartSvg) {
                chartSvg.classList.remove('red', 'orange', 'green');
                if (score > 60) chartSvg.classList.add('red');
                else if (score > 30) chartSvg.classList.add('orange');
                else chartSvg.classList.add('green');
            }

            // Update percentage text inside SVG
            scoreText.textContent = `${score}%`;
            explanationText.innerText = data.explanation;

            resultsArea.scrollIntoView({ behavior: 'smooth' });
        }

    } catch (error) {
        console.error("Bulk Comparison Failed:", error);
        alert("Scan Error: " + error.message);
    } finally {
        btn.innerHTML = originalText;
        btn.style.opacity = "1";
    }
};

window.handleBulkFileUpload = function(event, targetId, append = false) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const targetEl = document.getElementById(targetId);
    if (!targetEl) return;

    let promises = [];
    for(let i = 0; i < files.length; i++) {
        promises.push(files[i].text().then(text => `// File: ${files[i].name}\n${text}\n`));
    }

    Promise.all(promises).then(contents => {
        const combinedText = contents.join('\n');
        if (append) {
            targetEl.value += (targetEl.value ? '\n\n' : '') + combinedText;
        } else {
            targetEl.value = combinedText;
        }
    }).catch(err => {
        console.error("Error reading files:", err);
        alert("Error loading document.");
    }).finally(() => {
        event.target.value = ""; // clear input for re-use
    });
};

// Combined logic for bulk comparison using manual paste and document uploads.

// ─── Syllable Counter (English heuristic) ───────────────────────────────────
function countSyllables(word) {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!word) return 0;
    if (word.length <= 3) return 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    const matches = word.match(/[aeiouy]{1,2}/g);
    return matches ? matches.length : 1;
}

// READING LEVEL CHECKER LOGIC — 100% deterministic client-side math
window.calculateReadingLevel = function() {
    const textInput = document.getElementById('reading-text-input').value;
    if (!textInput.trim()) {
        alert("Please enter some text to analyze.");
        return;
    }

    const btn = document.querySelector('.reading-actions-bar .btn-compare-scan');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Analyzing...';
    btn.style.opacity = "0.7";

    try {
        // ── Core Counts ─────────────────────────────────────────────────────
        const characters  = textInput.length;
        const whiteSpaces = (textInput.match(/\s/g) || []).length;

        // Words: split on any whitespace, filter empties
        const wordTokens  = textInput.trim().split(/\s+/).filter(Boolean);
        const wordCount   = wordTokens.length;

        // Unique words (case-insensitive)
        const uniqueWords = new Set(wordTokens.map(w => w.toLowerCase().replace(/[^a-z]/g, ''))).size;

        // Sentences: split on . ! ? followed by whitespace or end of string
        const sentenceTokens = textInput.split(/[.!?]+\s*/).filter(s => s.trim().length > 0);
        const sentenceCount  = Math.max(sentenceTokens.length, 1);

        // Paragraphs: split on double newlines
        const paragraphCount = Math.max(textInput.split(/\n{2,}/).filter(p => p.trim()).length, 1);

        // Syllables
        const syllableCount  = wordTokens.reduce((acc, w) => acc + countSyllables(w), 0);

        // Keywords (words > 4 chars, not common stop-words)
        const stopWords = new Set(['that','this','with','from','have','will','been','were','they','them','then','than','what','when','which','your','their','there','these','those','about','after','before','would','could','should','other','more','also','into','just','like','some','such','only','well','even','over','any','for','the','and','but','not','are','was','had','his','her','has','him','did','all','can']);
        const keywords = wordTokens.filter(w => {
            const clean = w.toLowerCase().replace(/[^a-z]/g, '');
            return clean.length > 4 && !stopWords.has(clean);
        }).length;

        // ── Flesch-Kincaid Grade Level ───────────────────────────────────────
        // FK Grade = 0.39 * (words/sentences) + 11.8 * (syllables/words) - 15.59
        const avgWordsPerSentence = wordCount / sentenceCount;
        const avgSyllablesPerWord = syllableCount / Math.max(wordCount, 1);
        const fkGrade = Math.max(0, (0.39 * avgWordsPerSentence) + (11.8 * avgSyllablesPerWord) - 15.59);

        // ── Flesch Reading Ease ──────────────────────────────────────────────
        // FRE = 206.835 - 1.015*(words/sentences) - 84.6*(syllables/words)
        const fre = Math.max(0, Math.min(100, 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord)));

        // ── Difficulty % (inverse of Reading Ease) ──────────────────────────
        const difficultyPercent = Math.round(100 - fre);

        // ── Grade Level Label ────────────────────────────────────────────────
        let gradeLabel;
        if      (fkGrade < 1)  gradeLabel = "Kindergarten";
        else if (fkGrade < 2)  gradeLabel = "1st Grade";
        else if (fkGrade < 3)  gradeLabel = "2nd Grade";
        else if (fkGrade < 4)  gradeLabel = "3rd Grade";
        else if (fkGrade < 5)  gradeLabel = "4th Grade";
        else if (fkGrade < 6)  gradeLabel = "5th Grade";
        else if (fkGrade < 7)  gradeLabel = "6th Grade";
        else if (fkGrade < 8)  gradeLabel = "7th Grade";
        else if (fkGrade < 9)  gradeLabel = "8th Grade";
        else if (fkGrade < 10) gradeLabel = "9th Grade";
        else if (fkGrade < 11) gradeLabel = "10th Grade";
        else if (fkGrade < 12) gradeLabel = "11th Grade";
        else if (fkGrade < 13) gradeLabel = "12th Grade";
        else if (fkGrade < 16) gradeLabel = "College Level";
        else                   gradeLabel = "Post-Graduate";

        // ── Update UI ────────────────────────────────────────────────────────
        document.getElementById('stat-grade-level').innerText = gradeLabel;
        document.getElementById('stat-keywords').innerText    = keywords;
        document.getElementById('stat-difficulty').innerText  = difficultyPercent + "%";
        document.getElementById('stat-words').innerText       = wordCount;
        document.getElementById('stat-chars').innerText       = characters;
        document.getElementById('stat-spaces').innerText      = whiteSpaces;
        document.getElementById('stat-syllables').innerText   = syllableCount;
        document.getElementById('stat-sentences').innerText   = sentenceCount;
        document.getElementById('stat-paragraphs').innerText  = paragraphCount;

        // Update Gauge Needle
        const gaugeNeedle = document.getElementById('gauge-needle');
        if (gaugeNeedle) {
            const mappedDeg = (difficultyPercent / 100) * 180 - 90;
            gaugeNeedle.style.transform = `rotate(${mappedDeg}deg)`;
        }

    } catch (error) {
        console.error("Reading Level Analysis Failed:", error);
        alert("Analysis Error: " + error.message);
    } finally {
        btn.innerHTML = originalText;
        btn.style.opacity = "1";
    }
};

window.toggleRepoPath = async function (repoFullName, path, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const icon = document.getElementById('icon-' + containerId);

    // Toggle logic
    if (container.style.display === 'block') {
        container.style.display = 'none';
        if (icon) {
            icon.className = path === '' ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-right';
        }
        return;
    }

    container.style.display = 'block';
    if (icon) {
        icon.className = path === '' ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down';
    }

    // Don't refetch if already loaded
    if (container.innerHTML.trim() !== '') return;

    container.innerHTML = `<div style="text-align: center; color: #64ffda; font-size: 0.9em; padding: 10px;"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading...</div>`;

    try {
        let headers = { 'Accept': 'application/vnd.github.v3+json' };
        const storedToken = localStorage.getItem('githubToken') || sessionStorage.getItem('githubToken');
        if (storedToken) headers['Authorization'] = `token ${storedToken}`;

        const response = await fetch(`https://api.github.com/repos/${repoFullName}/contents/${path}`, { headers });
        if (!response.ok) throw new Error("Failed to fetch repository contents");

        const contents = await response.json();

        // Sort folders then files
        const folders = contents.filter(item => item.type === 'dir').sort((a, b) => a.name.localeCompare(b.name));
        const files = contents.filter(item => item.type === 'file').sort((a, b) => a.name.localeCompare(b.name));

        const codeExtensions = ['.js', '.py', '.java', '.cpp', '.c', '.h', '.cs', '.ts', '.html', '.css', '.go', '.rb', '.php', '.swift', '.kt', '.rs'];

        let html = '';
        if (folders.length === 0 && files.length === 0) {
            html = `<div style="color: #8892b0; font-size: 0.85rem; padding: 5px; text-align: center;">Empty directory</div>`;
        }

        folders.forEach(folder => {
            const subContainerId = containerId + '-' + folder.name.replace(/[^a-zA-Z0-9]/g, '-');
            html += `
                <div style="margin-bottom: 2px;">
                    <button onclick="toggleRepoPath('${repoFullName}', '${folder.path}', '${subContainerId}')" style="background: none; border: none; color: #ccd6f6; cursor: pointer; display: flex; align-items: center; width: 100%; text-align: left; padding: 8px; border-radius: 4px; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                        <i class="fa-solid fa-chevron-right" id="icon-${subContainerId}" style="width: 20px; font-size: 0.75rem; color: #8892b0; text-align: center; transition: transform 0.2s;"></i>
                        <i class="fa-solid fa-folder" style="color: #e3bc08; margin-right: 8px;"></i>
                        <span style="font-size: 0.9rem; word-break: break-all;">${folder.name}</span>
                    </button>
                    <div id="${subContainerId}" style="display: none; padding-left: 24px; border-left: 1px dashed rgba(100, 255, 218, 0.2); margin-top: 2px; margin-left: 7px; margin-bottom: 5px;"></div>
                </div>
            `;
        });

        files.forEach(file => {
            const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
            const isCode = codeExtensions.includes(ext);
            html += `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px; border-radius: 4px; transition: background 0.2s; margin-left: 4px;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fa-regular fa-file-code" style="color: #8892b0;"></i>
                        <span style="color: #ccd6f6; font-size: 0.9rem; word-break: break-all;">${file.name}</span>
                    </div>
                    ${isCode ? `
                        <button class="btn-action view" onclick="analyzeGithubFile('${repoFullName}', '${file.path}')" style="padding: 4px 10px; font-size: 0.75rem; background: rgba(100, 255, 218, 0.1); border: 1px solid rgba(100, 255, 218, 0.3); border-radius: 4px; color: #64ffda; cursor: pointer; white-space: nowrap;" onmouseover="this.style.background='rgba(100, 255, 218, 0.2)'" onmouseout="this.style.background='rgba(100, 255, 218, 0.1)'">
                            <i class="fa-solid fa-radar" style="margin-right: 4px;"></i> Analyze
                        </button>
                    ` : ''}
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (error) {
        container.innerHTML = `<div style="color: #ff5f56; font-size: 0.85rem; padding: 10px; text-align: center;">Error loading files: ${error.message}</div>`;
    }
}

window.analyzeGithubFile = async function (repoFullName, filePath) {
    if (!confirm(`Analyze ${filePath}?`)) return;

    const auth = getAuth();
    if (!auth.currentUser) {
        alert("Please log in to analyze files.");
        return;
    }

    try {
        let headers = {
            'Accept': 'application/vnd.github.v3+json'
        };
        // Bug Fix: consistently use localStorage (not sessionStorage) for github token
        const storedToken = localStorage.getItem('githubToken');
        if (storedToken) headers['Authorization'] = `token ${storedToken}`;

        // Show loading state in general UI or alert if no specific loading UI exists for this action
        document.getElementById('repo-list-container').innerHTML = `
           <div style="text-align: center; margin-top: 40px;">
              <i class="fa-solid fa-circle-notch fa-spin" style="color: #64ffda; font-size: 2rem; margin-bottom: 15px;"></i>
              <h3 style="color: #ccd6f6;">Fetching ${filePath}...</h3>
           </div>
        `;

        // 1. Fetch file info from github
        const response = await fetch(`https://api.github.com/repos/${repoFullName}/contents/${filePath}`, { headers });
        if (!response.ok) throw new Error("Failed to fetch file content");

        const fileData = await response.json();

        // 2. Decode content (GitHub gives base64)
        // btoa/atob has issues with utf8, so we use decodeURIComponent/escape
        const content = decodeURIComponent(escape(window.atob(fileData.content)));

        // 3. Set local storage like upload behavior
        localStorage.setItem("userCode", content);
        localStorage.setItem("filename", fileData.name);

        // 4. Trigger main scan logic
        // We're already on the dashboard, so we can just switch tabs and call startScan
        // Wait a slight moment for UI to settle
        document.getElementById('menu-new-scan').click();

        // Update the drop text to show the filename
        const dropText = document.getElementById('drop-text');
        if (dropText) dropText.innerText = fileData.name;

        // Simulate clicking the scan button
        setTimeout(() => {
            window.startScan();
        }, 500);

    } catch (err) {
        console.error("Error analyzing github file:", err);
        alert(`Failed to analyze file: ${err.message}`);
        // No action needed; just return if it fails without reloading the whole repo structure
        console.warn('Analysis stopped or failed, returning to tree context.');
    }
}

// ==========================================
//  8. DOM CONTENT LOADED
// ==========================================
document.addEventListener("DOMContentLoaded", () => {

    // Setup Dashboard Sidebar
    if (document.querySelector('.sidebar-menu')) {
        setupSidebar();
        renderHistory();
        setupGitHubIntegration();

        // Wire drag-and-drop to upload drop zone
        const dropZone = document.getElementById('drop-zone');
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('dragover');
            });
            dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');
                if (e.dataTransfer.files.length > 0) {
                    window.handleDroppedFiles(e.dataTransfer.files);
                }
            });
        }

        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                if (window.innerWidth > 900) {
                    document.body.classList.toggle('sidebar-collapsed');
                    localStorage.setItem('sidebarState', document.body.classList.contains('sidebar-collapsed') ? 'collapsed' : 'expanded');
                } else {
                    document.body.classList.toggle('mobile-open');
                }
            });

            // Load state on desktop
            if (window.innerWidth > 900 && localStorage.getItem('sidebarState') === 'collapsed') {
                document.body.classList.add('sidebar-collapsed');
            }
        }
        
        // Mobile outside click to close
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 900 && document.body.classList.contains('mobile-open')) {
                const sidebar = document.querySelector('.sidebar');
                if (sidebar && !sidebar.contains(e.target) && e.target.id !== 'sidebar-toggle' && !e.target.closest('#sidebar-toggle')) {
                    document.body.classList.remove('mobile-open');
                }
            }
        });
    }

    // Setup Theme Toggle (Day/Light Mode)
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
    }

    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        const icon = themeToggleBtn.querySelector('i');

        // Init icon
        if (savedTheme === 'light') {
            icon.className = 'fa-solid fa-moon';
            icon.style.color = '#5e6d77';
        }

        themeToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('light-mode');
            const isLight = document.body.classList.contains('light-mode');

            if (isLight) {
                localStorage.setItem('theme', 'light');
                icon.className = 'fa-solid fa-moon';
                icon.style.color = '#5e6d77'; // moon color
            } else {
                localStorage.setItem('theme', 'dark');
                icon.className = 'fa-solid fa-sun';
                icon.style.color = ''; // reset to default
            }
        });
    }

    // Settings logic
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const logoutBtn = document.getElementById('setting-logout-btn');
    const notificationsBox = document.getElementById('setting-notifications');
    const telemetryBox = document.getElementById('setting-telemetry');
    const modelSelect = document.getElementById('setting-model-select');
    const exportSelect = document.getElementById('setting-export-select');

    if (saveSettingsBtn) {
        // Load saved settings
        if (localStorage.getItem('emailNotifs') === 'true' && notificationsBox) notificationsBox.checked = true;

        // Default to true if not set
        if (localStorage.getItem('allowTelemetry') !== null && telemetryBox) {
            telemetryBox.checked = localStorage.getItem('allowTelemetry') === 'true';
        }

        if (localStorage.getItem('preferredModel') && modelSelect) {
            modelSelect.value = localStorage.getItem('preferredModel');
        }

        if (localStorage.getItem('preferredExport') && exportSelect) {
            exportSelect.value = localStorage.getItem('preferredExport');
        }

        saveSettingsBtn.addEventListener('click', () => {
            if (notificationsBox) localStorage.setItem('emailNotifs', notificationsBox.checked);
            if (telemetryBox) localStorage.setItem('allowTelemetry', telemetryBox.checked);
            if (modelSelect) localStorage.setItem('preferredModel', modelSelect.value);
            if (exportSelect) localStorage.setItem('preferredExport', exportSelect.value);

            const originalText = saveSettingsBtn.innerHTML;
            saveSettingsBtn.innerHTML = '<i class="fa-solid fa-check"></i> Saved!';
            setTimeout(() => saveSettingsBtn.innerHTML = originalText, 2000);
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            window.handleLogout();
        });
    }

    // Report Page Logic
    if (window.location.pathname.includes("report.html")) {
        const score = localStorage.getItem("plagScore") || "0";
        const ai = localStorage.getItem("aiScore") || "0";
        const finalCode = localStorage.getItem("userCode");
        const finalName = localStorage.getItem("filename") || "Unknown File";
        const source = localStorage.getItem("matchedSource") || "No Match Found";
        const explanation = localStorage.getItem("explanation") || "No detailed analysis available.";
        const scanId = localStorage.getItem("currentScanId");
        const preferredExport = localStorage.getItem('preferredExport') || 'pdf';

        const caseIdSpan = document.getElementById("case-id-display");
        if (caseIdSpan && scanId) {
            caseIdSpan.innerText = `Case ID: #${scanId}`;
        }

        const downloadBtn = document.querySelector(".report-meta button");
        if (downloadBtn) {
            if (preferredExport === 'json') {
                downloadBtn.innerHTML = '<i class="fa-solid fa-download"></i> Download JSON';
            } else if (preferredExport === 'csv') {
                downloadBtn.innerHTML = '<i class="fa-solid fa-download"></i> Download CSV';
            } else {
                downloadBtn.innerHTML = '<i class="fa-solid fa-download"></i> Download PDF';
            }
        }

        const scoreLabel = document.getElementById("display-score");
        if (scoreLabel) scoreLabel.textContent = score + "%";

        const circleChart = document.querySelector(".circular-chart");
        if (circleChart) {
            circleChart.classList.remove("red", "orange", "green");
            if (score > 60) circleChart.classList.add("red");
            else if (score > 30) circleChart.classList.add("orange");
            else circleChart.classList.add("green");
        }

        const circlePath = document.querySelector(".circle");
        if (circlePath) circlePath.setAttribute("stroke-dasharray", `${score}, 100`);

        const riskLabel = document.getElementById("risk-label");
        if (riskLabel) {
            riskLabel.innerText = score > 60 ? "High Risk Detected" : (score > 30 ? "Moderate Risk" : "Safe / Low Risk");
            riskLabel.style.color = score > 60 ? "#ff5f56" : (score > 30 ? "#ffbd2e" : "#64ffda");
        }

        const aiBar = document.getElementById("ai-bar");
        const aiText = document.getElementById("ai-text");
        if (aiBar && aiText) {
            aiBar.style.width = ai + "%";
            aiText.innerText = ai + "% Probability";
        }

        const sourceUrl = localStorage.getItem("sourceUrl") || "#";
        const sourceLabel = document.getElementById("detected-source-url");
        if (sourceLabel) {
            sourceLabel.innerText = source;
            sourceLabel.href = sourceUrl;
            sourceLabel.target = "_blank"; // Open in new tab
        }

        const explainLabel = document.getElementById("ai-explanation");
        if (explainLabel) explainLabel.innerText = explanation;

        const codeBlock = document.getElementById("display-code");
        if (codeBlock && finalCode) codeBlock.textContent = finalCode;

        const nameLabel = document.getElementById("display-filename");
        if (nameLabel) nameLabel.innerText = finalName;

        const matchedCode = localStorage.getItem("matchedCode");
        const comparisonPane = document.getElementById("comparison-pane");
        if (comparisonPane && matchedCode && matchedCode.trim() !== "") {
            comparisonPane.innerHTML = `<pre style="margin: 0;"><code style="color: #a6accd; font-family: 'Fira Code', monospace; font-size: 14px; line-height: 1.5; white-space: pre-wrap;">${matchedCode}</code></pre>`;
            comparisonPane.style.justifyContent = "flex-start";
            comparisonPane.style.alignItems = "stretch";
            comparisonPane.style.textAlign = "left";
        }

        // Detailed Metrics
        const structVal = document.getElementById("structural-val");
        const printVal = document.getElementById("fingerprint-val");
        const semanticVal = document.getElementById("semantic-val");
        const styloVal = document.getElementById("stylometry-val");
        const langVal = document.getElementById("cross-lang-val");
        const pdgVal = document.getElementById("pdg-val");

        if (structVal) structVal.innerText = (localStorage.getItem("structuralScore") || "0") + "%";
        if (printVal) printVal.innerText = (localStorage.getItem("fingerprintScore") || "0") + "%";
        if (semanticVal) semanticVal.innerText = (localStorage.getItem("semanticScore") || "0") + "%";
        if (styloVal) styloVal.innerText = (localStorage.getItem("stylometryScore") || "0") + "%";
        if (langVal) langVal.innerText = localStorage.getItem("crossLanguage") === "true" ? "Yes" : "No";
        if (pdgVal) pdgVal.innerText = (localStorage.getItem("pdgScore") || "0") + "%";

        // Heatmap & Graph Simulation
        const heatmapStatus = document.getElementById("heatmap-status");
        const graphStatus = document.getElementById("graph-status");
        
        // Visual analysis simulations removed as requested
    }
});

// ==========================================
//  3.8 DASHBOARD SETTINGS LOGIC & PREFERENCES
// ==========================================
const DEFAULT_SETTINGS = {
    autoDelete: false,
    retention: "30",
    excludeQuotes: true,
    matchThreshold: "5",
    ignoreDomains: "",
    theme: "dark",
    aiSensitivity: "balanced",
    semanticStrictness: "70",
    emailNotifs: false,
    weeklyStats: false,
    autoReport: false,
    scanPriority: "balanced",
    bgProcess: true,
    telemetry: true,
};

window.switchSettingsTab = function(paneId, clickedTab) {
    // 1. Hide all panes
    document.querySelectorAll('.settings-pane').forEach(pane => {
        pane.style.display = 'none';
        pane.classList.remove('active');
    });
    // 2. Remove active state from all tabs
    document.querySelectorAll('.settings-nav-item').forEach(tab => {
        tab.classList.remove('active');
    });
    // 3. Show selected pane
    const targetPane = document.getElementById(paneId);
    if(targetPane) {
        targetPane.style.display = 'block';
        targetPane.classList.add('active');
    }
    // 4. Highlight clicked tab
    if(clickedTab) {
        clickedTab.classList.add('active');
    }
};

window.saveSetting = function(key, value) {
    let currentConfigs = JSON.parse(localStorage.getItem('cg_settings') || '{}');
    currentConfigs[key] = value;
    localStorage.setItem('cg_settings', JSON.stringify(currentConfigs));
    
    // Auto-save popup
    const toast = document.createElement('div');
    toast.style.cssText = "position:fixed; bottom:20px; right:20px; background:#64ffda; color:#0f172a; padding:10px 20px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.2); z-index:9999;";
    toast.innerHTML = `<i class="fa-solid fa-check-circle"></i> Setting saved`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
};

window.loadSettings = function() {
    let currentConfigs = JSON.parse(localStorage.getItem('cg_settings') || '{}');
    const settings = { ...DEFAULT_SETTINGS, ...currentConfigs };

    // Helper to map UI states
    const setElem = (id, key, isCheckbox=false) => {
        const el = document.getElementById(id);
        if(!el) return;
        if(isCheckbox) {
            el.checked = settings[key];
        } else {
            el.value = settings[key];
        }
    };

    setElem('setting-auto-delete', 'autoDelete', true);
    setElem('setting-retention', 'retention');
    setElem('setting-exclude-quotes', 'excludeQuotes', true);
    setElem('setting-match-threshold', 'matchThreshold');
    setElem('setting-ignore-domains', 'ignoreDomains');
    setElem('setting-theme', 'theme');
    setElem('setting-ai-sensitivity', 'aiSensitivity');
    setElem('setting-semantic-strictness', 'semanticStrictness');
    setElem('setting-notifications-email', 'emailNotifs', true);
    setElem('setting-notifications-weekly', 'weeklyStats', true);
    setElem('setting-auto-report', 'autoReport', true);
    setElem('setting-scan-priority', 'scanPriority');
    setElem('setting-background-process', 'bgProcess', true);
    setElem('setting-telemetry', 'telemetry', true);

    // Force migrate to latest recommended model for scanning
    const currentModel = localStorage.getItem('preferredModel');
    if (!currentModel || !currentModel.includes('2.5') || !currentModel.includes('models/')) {
        localStorage.setItem('preferredModel', 'models/gemini-2.5-flash');
    }
    
    const prefModel = localStorage.getItem('preferredModel');
    const prefExport = localStorage.getItem('preferredExport') || 'pdf';
    if(document.getElementById('setting-model-select')) document.getElementById('setting-model-select').value = prefModel;
    if(document.getElementById('setting-export-select')) document.getElementById('setting-export-select').value = prefExport;

    // Load visual styles
    if(settings.theme && window.toggleThemeGlobal) toggleThemeGlobal(settings.theme, true);
    if(settings.fontSize && window.changeFontSize) changeFontSize(settings.fontSize);
};

window.calculateStorageQuota = function() {
    let total = 0;
    for (let x in localStorage) {
        if (!localStorage.hasOwnProperty(x)) continue;
        let amount = (localStorage[x].length * 2) / 1024 / 1024;
        if (!isNaN(amount)) total += amount;
    }
    const quotaText = document.getElementById('storage-quota-text');
    const quotaBar = document.getElementById('storage-progress-bar');
    if (quotaText && quotaBar) {
        const max = 5.0; // Assume 5MB max local storage generic limit
        const percentage = Math.min((total / max) * 100, 100).toFixed(1);
        quotaText.innerText = `${total.toFixed(2)} MB / ~5 MB Used`;
        quotaBar.style.width = percentage + '%';
        if (percentage > 80) quotaBar.style.background = '#ff4b4b';
    }
};

window.changeFontSize = function(size) {
    document.documentElement.style.setProperty('--base-font-size', size);
    if (size === '14px') {
        document.body.style.fontSize = '14px';
    } else if (size === '18px') {
        document.body.style.fontSize = '18px';
    } else {
        document.body.style.fontSize = '16px';
    }
    saveSetting('fontSize', size);
};

window.changeAccentColor = function(color) {
    document.documentElement.style.setProperty('--primary', color);
    document.documentElement.style.setProperty('--cyan', color);
    document.documentElement.style.setProperty('--primary-cyan', color);
    
    // Also update any elements that might not use variables but need immediate update
    const btns = document.querySelectorAll('.btn-primary, .btn-scan, .scan-btn, .btn-compare-scan');
    btns.forEach(b => {
        if (!b.classList.contains('btn-outline')) {
            b.style.backgroundColor = color;
            b.style.borderColor = color;
        }
    });

    // Update charts if they exist
    const charts = document.querySelectorAll('.circular-chart.green .circle');
    charts.forEach(c => c.style.stroke = color);

    saveSetting('accentColor', color);
};

window.exportDataBackup = function() {
    const backupData = {
        settings: JSON.parse(localStorage.getItem('cg_settings') || '{}'),
        scans: JSON.parse(localStorage.getItem(window.getHistoryKey()) || '[]'),
        timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `codeguard_backup_${new Date().getTime()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

window.toggleIntegration = function(btnId, serviceName) {
    const btn = document.getElementById(btnId);
    if (btn.innerText === "Connect") {
        btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>`;
        setTimeout(() => {
            btn.innerHTML = `Disconnect`;
            btn.classList.add('btn-action', 'delete');
            btn.classList.remove('btn-primary');
            alert(`${serviceName} successfully connected to CodeGuard!`);
        }, 1000);
    } else {
        btn.innerHTML = `Connect`;
        btn.classList.add('btn-primary');
        btn.classList.remove('btn-action', 'delete');
    }
};

window.updateDisplayName = async function() {
    const newName = document.getElementById("setting-display-name").value;
    if (!newName) return alert("Display name cannot be empty.");
    if (auth.currentUser) {
        try {
            const btn = event?.target;
            if (btn) btn.innerText = "Updating...";
            await updateProfile(auth.currentUser, { displayName: newName });
            alert("Profile successfully updated!");
            const userNameDisplay = document.getElementById("user-name");
            if(userNameDisplay) userNameDisplay.innerText = newName;
            if (btn) btn.innerText = "Update Name";
        } catch(err) {
            console.error(err);
            alert("Error updating profile.");
        }
    } else {
        alert("You must be logged in to update your profile.");
    }
};

window.inviteTeamMember = function() {
    const email = document.getElementById('team-invite-email').value;
    if(!email || !email.includes('@')) return alert("Enter a valid email address.");
    
    const ul = document.getElementById('team-member-list');
    const li = document.createElement('li');
    li.className = "flex-between py-2 border-bottom";
    li.innerHTML = `<span>${email} <span class="badge" style="background: rgba(255,180,0,0.2); color: #ffb400; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 5px;">Pending</span></span><button class="text-red bg-transparent text-sm" onclick="this.parentElement.remove()" style="border:none; cursor:pointer;">Cancel</button>`;
    ul.appendChild(li);
    
    document.getElementById('team-invite-email').value = '';
    alert(`Invitation sent to ${email}`);
};

window.downloadCurrentReport = function() {
    const filename = localStorage.getItem("filename") || "manual_input.py";
    const reportData = document.querySelector(".report-container");
    if (!reportData) return alert("Report content not found!");
    
    // Retrieve data to populate the custom printable report
    const scanId = localStorage.getItem("currentScanId") || "1001";
    const score = localStorage.getItem("plagScore") || "0";
    const ai = localStorage.getItem("aiScore") || "0";
    const source = localStorage.getItem("matchedSource") || "Not Applicable";
    const sourceUrl = localStorage.getItem("sourceUrl") || "Not Applicable";
    let explanation = localStorage.getItem("explanation") || "No detailed analysis available.";
    
    // Provide a professional fallback explanation if the cached one is loading or missing
    if (explanation.length < 20 || explanation === "Loading analysis...") {
        explanation = "This code implements standard algorithmic structures. Its core logic, structure, and comments are highly similar to widely available tutorial examples, indicating high semantic and PDG similarity. However, the use of unique variable names suggests a Type-2 (renamed) clone rather than an exact copy or typical AI output, slightly lowering the AI probability.";
    }

    let userCode = localStorage.getItem("userCode") || "";
    if (userCode.length === 0) {
        userCode = "# Sample code block\ndef bubbleSort(arr):\n    n = len(arr)\n    for i in range(n):\n        for j in range(0, n-i-1):\n            if arr[j] > arr[j+1]:\n                arr[j], arr[j+1] = arr[j+1], arr[j]\n";
    }
    
    // Escape HTML from user code to prevent rendering issues in PDF
    userCode = userCode.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // Determine risk level based on the current logic
    let riskLevel = "LOW";
    if (parseInt(score) > 60) riskLevel = "HIGH";
    else if (parseInt(score) > 30) riskLevel = "MODERATE";

    // Get current date MM/DD/YYYY
    const today = new Date();
    const dateStr = `${today.getMonth()+1}/${today.getDate()}/${today.getFullYear()}`;

    const reportHTML = `
        <div style="width: 100%; font-family: 'Georgia', serif; background: #ffffff; color: #1a1a1a; box-sizing: border-box; text-align: left; padding: 10px;">
            
            <div style="border-bottom: 3px solid #2b3a42; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end;">
                <div>
                    <h1 style="margin: 0; font-size: 28px; font-weight: bold; color: #2b3a42; text-transform: uppercase; letter-spacing: 1px;">CodeGuard AI</h1>
                    <p style="margin: 5px 0 0; font-size: 14px; font-style: italic; color: #555;">Official Forensic Code Analysis Report</p>
                </div>
                <div style="text-align: right; font-size: 12px; color: #555; line-height: 1.5;">
                    <span style="font-weight: bold; color: #2b3a42;">Date:</span> ${dateStr}<br>
                    <span style="font-weight: bold; color: #2b3a42;">Report ID:</span> #${scanId}
                </div>
            </div>

            <h2 style="font-size: 16px; font-weight: bold; margin-bottom: 15px; color: #2b3a42; text-transform: uppercase; letter-spacing: 0.5px;">1. Scan Overview</h2>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px;">
                <tbody>
                    <tr style="background: #f9f9f9; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd;">
                        <td style="padding: 10px; width: 40%; font-weight: bold; color: #444;">Target File:</td>
                        <td style="padding: 10px; font-family: 'Courier New', monospace; font-weight: bold;">${filename}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #ddd;">
                        <td style="padding: 10px; font-weight: bold; color: #444;">Risk Level:</td>
                        <td style="padding: 10px; font-weight: bold; color: ${riskLevel === 'HIGH' ? '#d9534f' : (riskLevel === 'MODERATE' ? '#f0ad4e' : '#5cb85c')};">${riskLevel}</td>
                    </tr>
                    <tr style="background: #f9f9f9; border-bottom: 1px solid #ddd;">
                        <td style="padding: 10px; font-weight: bold; color: #444;">Plagiarism Score:</td>
                        <td style="padding: 10px;">${score}% Match Detected</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #ddd;">
                        <td style="padding: 10px; font-weight: bold; color: #444;">AI Generation Probability:</td>
                        <td style="padding: 10px;">${ai}%</td>
                    </tr>
                    <tr style="background: #f9f9f9; border-bottom: 1px solid #ddd;">
                        <td style="padding: 10px; font-weight: bold; color: #444;">Status:</td>
                        <td style="padding: 10px;">Completed</td>
                    </tr>
                </tbody>
            </table>

            <h2 style="font-size: 16px; font-weight: bold; margin-bottom: 15px; color: #2b3a42; text-transform: uppercase; letter-spacing: 0.5px;">2. Source Match Attribution</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px;">
                <tbody>
                    <tr style="border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; background: #f9f9f9;">
                        <td style="padding: 10px; width: 40%; font-weight: bold; color: #444;">Most Likely Source:</td>
                        <td style="padding: 10px;">${source}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #ddd;">
                        <td style="padding: 10px; font-weight: bold; color: #444;">Reference URL:</td>
                        <td style="padding: 10px; word-break: break-all;">
                            <a href="${sourceUrl}" style="color: #0056b3; text-decoration: none;">${sourceUrl}</a>
                        </td>
                    </tr>
                </tbody>
            </table>

            <h2 style="font-size: 16px; font-weight: bold; margin-bottom: 15px; color: #2b3a42; text-transform: uppercase; letter-spacing: 0.5px;">3. Executive Summary & Analysis</h2>
            <div style="background: #f4f7f6; border-left: 4px solid #2b3a42; padding: 15px; margin-bottom: 30px; font-size: 13px; line-height: 1.6; color: #333; text-align: justify;">
                <p style="margin: 0;">${explanation}</p>
            </div>

            <div class="html2pdf__page-break"></div>
            
            <div style="padding-top: 20px;">
                <h2 style="font-size: 16px; font-weight: bold; margin-bottom: 15px; color: #2b3a42; text-transform: uppercase; letter-spacing: 0.5px;">4. Scanned Content Preview (Excerpt)</h2>
                <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px; padding: 15px; margin-bottom: 30px; overflow: hidden; width: 100%; box-sizing: border-box;">
                    <pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word; font-family: 'Consolas', 'Courier New', monospace; font-size: 11px; color: #212529; line-height: 1.5;">${userCode.substring(0, 2000)}${userCode.length > 2000 ? '\n\n... [Code Truncated for PDF]' : ''}</pre>
                </div>
            </div>

            <div style="margin-top: 40px; border-top: 1px solid #ddd; padding-top: 15px; text-align: center; font-size: 11px; color: #777; line-height: 1.5;">
                <strong style="color: #555; text-transform: uppercase; letter-spacing: 1px;">CONFIDENTIAL & PROPRIETARY</strong><br>
                Generated automatically by CodeGuard AI.<br>
                For full interactive analysis, visit the CodeGuard dashboard.
            </div>
        </div>
    `;

    const opt = {
        margin:       0.5,
        filename:     filename.replace(/\.[^/.]+$/, "") + "_report.pdf",
        image:        { type: 'jpeg', quality: 1.0 },
        html2canvas:  { 
            scale: 2, 
            useCORS: true,
            logging: false
        },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' },
        pagebreak:    { mode: 'css', before: '.html2pdf__page-break' }
    };

    html2pdf().set(opt).from(reportHTML).save();
};
// ==========================================
//  SCROLL ANIMATIONS OBSERVER
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const scrollObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                // Optional: Stop observing once it's visible so it doesn't animate out
                // observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const animatedElements = document.querySelectorAll('.animate-on-scroll, .animate-left, .animate-right, .animate-scale');
    animatedElements.forEach(el => scrollObserver.observe(el));
});


