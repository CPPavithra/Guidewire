const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const { initRabbitMQ } = require('./src/config/database');
const apiRoutes = require('./src/routes/api.routes');

const app = express();
const server = http.createServer(app);

// Initialize WebSockets and make it accessible globally
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST", "PUT"] }});
app.set('io', io); // Saves the io instance so controllers can use it

// Middleware
app.use(cors());
app.use(express.json());

// Load Routes
app.use('/api', apiRoutes);

const API_PORT = 3000;

async function startServer() {
    await initRabbitMQ(); // Connect to the Message Broker
    server.listen(API_PORT, () => {
        console.log(`🚀 Guidewire Gateway API running on http://localhost:${API_PORT}`);
        console.log(`📁 Architecture: Decoupled MVC Strategy`);
    });
}

startServer();
