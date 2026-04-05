const { pool, getChannel, getQueueName } = require('../config/database');

// Helper to handle PostgreSQL's lowercase folding
const normalizeNumber = (val) => Number(val ?? 0);

exports.getPolicies = async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT * FROM policies");
        const mappedRows = rows.map(p => ({
            id: p.id,
            holder: p.holder,
            basePremium: normalizeNumber(p.basepremium || p.basePremium),
            dynamicPremium: normalizeNumber(p.dynamicpremium || p.dynamicPremium),
            riskScore: normalizeNumber(p.riskscore || p.riskScore),
            status: p.status
        }));
        res.json(mappedRows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getClaims = async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT * FROM claims ORDER BY id DESC");
        const mappedRows = rows.map(c => ({
            ...c,
            policyId: c.policyid || c.policyId,
            amount: normalizeNumber(c.amount),
            fraudScore: normalizeNumber(c.fraudscore || c.fraudScore),
            auditLog: c.audit_log ? JSON.parse(c.audit_log) : []
        }));
        res.json(mappedRows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// FNOL Ingestion - Publishes to RabbitMQ
exports.submitFNOL = async (req, res) => {
    const { policyId, amount, type, description } = req.body;
    if (!policyId) return res.status(400).json({ error: "policyId is required" });

    const claimId = `CLM-${Math.floor(1000 + Math.random() * 9000)}`;
    const amountNum = normalizeNumber(amount);

    try {
        await pool.query(
            `INSERT INTO claims (id, policyId, amount, status, type, description) VALUES ($1, $2, $3, $4, $5, $6)`,
            [claimId, policyId, amountNum, 'Pending', type || 'Unknown', description || '']
        );

        // Publish to Event Broker
        const channel = getChannel();
        if (channel) {
            const eventPayload = { claimId, policyId, amount: amountNum, description };
            channel.sendToQueue(getQueueName(), Buffer.from(JSON.stringify(eventPayload)), { persistent: true });
        }

        // We use req.app.get('io') to access the Socket.io instance from the main server
        req.app.get('io').emit('intelligenceUpdate', { type: 'NEW_CLAIM', claimId });
        res.json({ success: true, message: "Claim queued for ML processing", claimId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Webhook for the Python ML Engine
exports.processMLResult = async (req, res) => {
    const { claimId, policyId, fraudScore, auditLog, newRiskScore, newStatus } = req.body;
    const io = req.app.get('io');

    try {
        await pool.query(
            `UPDATE claims SET fraudScore = $1, status = $2, audit_log = $3 WHERE id = $4`,
            [fraudScore, fraudScore > 60 ? 'Flagged' : 'Approved', JSON.stringify(auditLog), claimId]
        );

        if (fraudScore > 60) {
            const policyResult = await pool.query(`SELECT "basepremium" FROM policies WHERE id = $1`, [policyId]);
            if (policyResult.rows.length > 0) {
                const basePremium = normalizeNumber(policyResult.rows[0].basepremium);
                const newPremium = basePremium * (1 + (newRiskScore / 100));

                await pool.query(
                    `UPDATE policies SET riskScore = $1, dynamicPremium = $2, status = $3 WHERE id = $4`,
                    [newRiskScore, newPremium, newStatus, policyId]
                );
                io.emit('intelligenceUpdate', { type: 'RISK_ESCALATION', policyId, newPremium });
            }
        } else {
            io.emit('intelligenceUpdate', { type: 'STATUS_CHANGE', claimId });
        }
        res.json({ success: true });
    } catch (err) {
        console.error("❌ Webhook Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};
