import axios from 'axios';
import { io } from 'socket.io-client';

const API_URL = 'http://localhost:3000';

// Configure Axios
export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Configure WebSockets
export const socket = io(API_URL);
