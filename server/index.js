/**
 * Veo Veo Game Server
 */

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const bcrypt = require('bcrypt');

// --- Basic Setup ---
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
app.use(express.json());

// --- Constants ---
const PORT = process.env.PORT || 3001;
const MOCK_OBJECTS = ['SILLA', 'MESA', 'LAMPARA', 'LIBRO', 'ORDENADOR', 'TECLADO', 'RATON'];
const ROUND_DURATION_MS = 60000;

// --- In-memory Data Stores ---
// For production, these should be replaced with a persistent database (e.g., Redis, PostgreSQL).
const users = []; // Stores { id, username, password, playerId }
const rooms = {}; // Stores game rooms by roomCode

/**
 * Generates a unique 5-character room code.
 * @returns {string} A unique room code.
 */
const generateRoomCode = () => {
    let code;
    do { code = Math.random().toString(36).substring(2, 7).toUpperCase(); } while (rooms[code]);
    return code;
};

// --- HTTP API Endpoints ---

app.get('/', (req, res) => res.send('<h1>Veo Veo Game Server</h1>'));

app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ message: 'Username and password are required' });
        if (users.find(user => user.username === username)) return res.status(409).json({ message: 'Username already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { id: Date.now().toString(), username, password: hashedPassword, playerId: `player#${Math.floor(Math.random() * 10000)}` };
        users.push(newUser);
        res.status(201).json({ message: 'User registered successfully', userId: newUser.id });
    } catch (error) {
        console.error("Registration Error:", error);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ message: 'Username and password are required' });
        const user = users.find(u => u.username === username);
        if (!user) return res.status(401).json({ message: 'Invalid credentials' });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });
        res.status(200).json({ message: 'Login successful', userId: user.id, playerId: user.playerId, username: user.username });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: 'Server error during login' });
    }
});


// --- Game Logic Functions ---

/**
 * Starts the timer for a round. If it expires, ends the round.
 * @param {string} roomCode The code of the room.
 */
const startRoundTimer = (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;
    if (room.roundTimer) clearTimeout(room.roundTimer);

    room.roundTimer = setTimeout(() => {
        if (!rooms[roomCode]) return; // Room might have been closed
        io.to(roomCode).emit('round_over_timeout', { secretWord: room.secretWord });
        // Proceed to the next round automatically after timeout
        room.turnIndex++;
        room.roundNumber++;
        startNewRound(roomCode);
    }, ROUND_DURATION_MS);
};

/**
 * Starts a new round or ends the game if all players have had a turn.
 * @param {string} roomCode The code of the room.
 */
const startNewRound = (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;
    if (room.turnIndex >= room.players.length) {
        io.to(roomCode).emit('game_over', { scores: room.scores });
        room.gameState = 'game_over';
        return;
    }
    room.gameState = 'in_progress';
    const turnPlayer = room.players[room.turnIndex];
    io.to(roomCode).emit('new_round', { roundNumber: room.roundNumber, turnPlayerId: turnPlayer.id, turnPlayerUsername: turnPlayer.username });
};

// --- WebSocket Connection Handling ---

io.on('connection', (socket) => {

    // Lobby Management
    socket.on('create_room', ({ playerId, username, gameMode }) => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = { host: socket.id, players: [{ id: socket.id, playerId, username }], gameState: 'waiting', gameMode: gameMode || 'random' };
        socket.join(roomCode);
        socket.emit('room_created', { roomCode, players: rooms[roomCode].players });
    });

    socket.on('join_room', ({ roomCode, playerId, username }) => {
        const room = rooms[roomCode];
        if (!room) return socket.emit('error', { message: 'Room not found.' });
        if (room.players.length >= 5) return socket.emit('error', { message: 'Room is full.' });
        if (room.gameState !== 'waiting') return socket.emit('error', { message: 'Game has already started.' });
        room.players.push({ id: socket.id, playerId, username });
        socket.join(roomCode);
        io.to(roomCode).emit('player_joined', { players: room.players });
        socket.emit('join_success', { roomCode, players: room.players });
    });

    // Game Flow
    socket.on('start_game', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room || room.host !== socket.id) return;
        room.turnIndex = 0;
        room.roundNumber = 1;
        room.scores = room.players.reduce((acc, p) => ({ ...acc, [p.id]: 0 }), {});
        io.to(roomCode).emit('game_started'); // To transition clients from Lobby to Game screen
        startNewRound(roomCode);
    });

    socket.on('submit_photo', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) return;
        const turnPlayer = room.players[room.turnIndex];
        if (socket.id !== turnPlayer.id) return;

        if (room.gameMode === 'host_choice') {
            socket.emit('word_choices', { choices: MOCK_OBJECTS.slice(0, 4) });
        } else {
            room.secretWord = MOCK_OBJECTS[Math.floor(Math.random() * MOCK_OBJECTS.length)];
            io.to(roomCode).emit('round_start', { firstLetter: room.secretWord.charAt(0) });
            startRoundTimer(roomCode);
        }
    });

    socket.on('submit_word_choice', ({ roomCode, word }) => {
        const room = rooms[roomCode];
        if (!room) return;
        const turnPlayer = room.players[room.turnIndex];
        if (socket.id !== turnPlayer.id) return;

        room.secretWord = word.toUpperCase();
        io.to(roomCode).emit('round_start', { firstLetter: room.secretWord.charAt(0) });
        startRoundTimer(roomCode);
    });

    socket.on('submit_guess', ({ roomCode, guess }) => {
        const room = rooms[roomCode];
        if (!room || room.gameState !== 'in_progress') return;

        if (guess.toUpperCase() === room.secretWord) {
            if (room.roundTimer) clearTimeout(room.roundTimer);
            const winner = room.players.find(p => p.id === socket.id);
            if(winner) room.scores[winner.id] = (room.scores[winner.id] || 0) + 10;
            io.to(roomCode).emit('correct_guess', { winner, secretWord: room.secretWord, scores: room.scores });

            room.turnIndex++;
            room.roundNumber++;
            setTimeout(() => startNewRound(roomCode), 3000); // Wait 3s before next round
        }
    });

    socket.on('play_again', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room || room.host !== socket.id) return;
        // Re-initialize game state, similar to start_game
        room.turnIndex = 0;
        room.roundNumber = 1;
        room.scores = room.players.reduce((acc, p) => ({ ...acc, [p.id]: 0 }), {});
        io.to(roomCode).emit('game_started');
        startNewRound(roomCode);
    });

    socket.on('disconnect', () => {
        let roomCodeFound = Object.keys(rooms).find(rc => rooms[rc]?.players.some(p => p.id === socket.id));
        if (roomCodeFound) {
            const room = rooms[roomCodeFound];
            if (room.host === socket.id) {
                if (room.roundTimer) clearTimeout(room.roundTimer);
                io.to(roomCodeFound).emit('room_closed');
                delete rooms[roomCodeFound];
            } else {
                room.players = room.players.filter(p => p.id !== socket.id);
                io.to(roomCodeFound).emit('player_left', { players: room.players });
            }
        }
    });
});

server.listen(PORT, () => {
  console.log(`Veo Veo Server listening on *:${PORT}`);
});
