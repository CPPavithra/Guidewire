const express = require('express');
const router = express.Router();
const claimController = require('../controllers/claim.controller');

// Guidewire Simulation Endpoints
router.get('/policies', claimController.getPolicies);
router.get('/claims', claimController.getClaims);
router.post('/claims', claimController.submitFNOL);

// Internal Microservice Webhooks
router.post('/internal/ml-result', claimController.processMLResult);

module.exports = router;
