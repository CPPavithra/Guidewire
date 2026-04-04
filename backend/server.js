const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize SQLite
const db = new sqlite3.Database('./guidewire_poc.db', (err) => {
    if (err) console.error(err.message);
    else console.log('✅ Connected to SQLite database.');
});

// Create Tables & Seed Data
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS policies (
        id TEXT PRIMARY KEY, holder TEXT, basePremium REAL, 
        dynamicPremium REAL, riskScore INTEGER, status TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS claims (
        id TEXT PRIMARY KEY, policyId TEXT, amount REAL, 
        fraudScore INTEGER, status TEXT, type TEXT, description TEXT
    )`);

    // Seed Data
    db.get("SELECT COUNT(*) AS count FROM policies", (err, row) => {
        if (row.count === 0) {
            const stmt = db.prepare("INSERT INTO policies VALUES (?, ?, ?, ?, ?, ?)");
            stmt.run('POL-8821', 'Global Logistics Inc.', 12500, 12500, 22, 'Low');
            stmt.run('POL-4432', 'Sarah Jenkins', 1200, 1200, 15, 'Low');
            stmt.run('POL-9901', 'TechFlow Solutions', 8500, 8500, 45, 'Medium');
            stmt.finalize();
        }
    });
});

// --- API ROUTES ---

// Get Policies
app.get('/api/policies', (req, res) => {
    db.all("SELECT * FROM policies", [], (err, rows) => res.json(rows));
});

// Get Claims
app.get('/api/claims', (req, res) => {
    db.all("SELECT * FROM claims ORDER BY id DESC", [], (err, rows) => res.json(rows));
});

// THE INTELLIGENCE HUB: Submit FNOL & Run "AI"
app.post('/api/claims', (req, res) => {
    const { policyId, amount, type, description } = req.body;
    const claimId = `CLM-${Math.floor(1000 + Math.random() * 9000)}`;
    
    // Heuristic AI Logic
    let fraudScore = 10; 
    const descLower = description.toLowerCase();
    const redFlags = ['cash', 'unwitnessed', 'whiplash', 'lawyer', 'no police'];
    
    redFlags.forEach(word => { if (descLower.includes(word)) fraudScore += 25; });
    if (amount > 10000) fraudScore += 20;
    fraudScore = Math.min(fraudScore, 99);

    db.run(`INSERT INTO claims VALUES (?, ?, ?, ?, ?, ?, ?)`, 
        [claimId, policyId, amount, fraudScore, 'Pending', type, description], 
        function(err) {
            if (err) return res.status(500).json({error: err.message});
            
            // Agentic Action: Automatically increase premium if fraud score is very high
            if (fraudScore > 60) {
                db.get(`SELECT riskScore, basePremium FROM policies WHERE id = ?`, [policyId], (err, policy) => {
                    if (policy) {
                        const newRisk = Math.min(policy.riskScore + 40, 100);
                        const newPremium = policy.basePremium * (1 + (newRisk / 100));
                        const newStatus = newRisk > 70 ? 'High' : 'Medium';
                        
                        db.run(`UPDATE policies SET riskScore=?, dynamicPremium=?, status=? WHERE id=?`,
                            [newRisk, newPremium, newStatus, policyId]);
                    }
                });
            }
            res.json({ success: true, claimId, fraudScore });
        }
    );
});

// Update Claim Status (STP / SIU)
app.put('/api/claims/:id/status', (req, res) => {
    const { status } = req.body;
    db.run(`UPDATE claims SET status = ? WHERE id = ?`, [status, req.params.id], () => {
        res.json({ success: true });
    });
});

app.listen(3000, () => console.log('🚀 Backend running on port 3000'));
