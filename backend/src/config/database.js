const { Pool } = require('pg');
const amqp = require('amqplib');

// 1. PostgreSQL Connection
const pool = new Pool({
    user: 'admin',
    host: 'localhost',
    database: 'guidewire_poc',
    password: 'password123',
    port: 5432,
});

pool.on('error', (err) => console.error('Unexpected error on idle client', err));

// 2. RabbitMQ Connection State
let channel = null;
const QUEUE_NAME = 'fnol_processing';

async function initRabbitMQ() {
    try {
        const connection = await amqp.connect('amqp://guest:guest@localhost:5672');
        channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });
        console.log('✅ RabbitMQ Connected & Queue Asserted');
    } catch (error) {
        console.error('RabbitMQ Connection Failed:', error);
    }
}

const getChannel = () => channel;
const getQueueName = () => QUEUE_NAME;

module.exports = {
    pool,
    initRabbitMQ,
    getChannel,
    getQueueName
};
