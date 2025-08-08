const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const bcrypt = require('bcrypt');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const users = [];
const rooms = {};

const PORT = process.env.PORT || 3001;
const MOCK_OBJECTS = ['SILLA', 'MESA', 'LAMPARA', 'LIBRO', 'ORDENADOR', 'TECLADO', 'RATON'];

const generateRoomCode = () => {
    let code;
    do { code = Math.random().toString(36).substring(2, 7).toUpperCase(); } while (rooms[code]);
    return code;
};

// ... (register and login endpoints are fine)
app.get('/', (req, res) => res.send('<h1>Veo Veo Server</h1>'));
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).send('Username and password are required');
        if (users.find(user => user.username === username)) return res.status(409).send('Username already exists');

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { id: Date.now().toString(), username, password: hashedPassword, playerId: `player#${Math.floor(Math.random() * 10000)}` };
        users.push(newUser);
        res.status(201).send({ message: 'User registered successfully', userId: newUser.id });
    } catch (error) { res.status(500).send('Server error'); }
});
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).send('Username and password are required');
        const user = users.find(u => u.username === username);
        if (!user) return res.status(401).send('Invalid credentials');
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).send('Invalid credentials');
        res.status(200).send({ message: 'Login successful', userId: user.id, playerId: user.playerId, username: user.username });
    } catch (error) { res.status(500).send('Server error'); }
});

const startRoundTimer = (roomCode) => {
    const room = rooms[roomCode];
    if (room.roundTimer) clearTimeout(room.roundTimer);
    room.roundTimer = setTimeout(() => {
        io.to(roomCode).emit('round_over_timeout', { secretWord: room.secretWord });
        room.turnIndex++;
        room.roundNumber++;
        startNewRound(roomCode);
    }, 60000);
};

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

io.on('connection', (socket) => {
  socket.on('create_room', ({ playerId, username, gameMode }) => {
    const roomCode = generateRoomCode();
    rooms[roomCode] = { host: socket.id, players: [{ id: socket.id, playerId, username }], gameState: 'waiting', gameMode: gameMode || 'random' };
    socket.join(roomCode);
    socket.emit('room_created', { roomCode, players: rooms[roomCode].players });
  });

  socket.on('join_room', ({ roomCode, playerId, username }) => {
    const room = rooms[roomCode];
    if (!room || room.players.length >= 5) return;
    room.players.push({ id: socket.id, playerId, username });
    socket.join(roomCode);
    io.to(roomCode).emit('player_joined', { players: room.players });
    socket.emit('join_success', { roomCode, players: room.players });
  });

  socket.on('start_game', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room || room.host !== socket.id) return;
    room.turnIndex = 0;
    room.roundNumber = 1;
    room.scores = room.players.reduce((acc, p) => ({ ...acc, [p.id]: 0 }), {});
    io.to(roomCode).emit('game_started');
    startNewRound(roomCode);
  });

  socket.on('submit_photo', ({ roomCode }) => {
    const room = rooms[roomCode];
    const turnPlayer = room.players[room.turnIndex];
    if (!room || socket.id !== turnPlayer.id) return;

    if (room.gameMode === 'host_choice') {
        socket.emit('word_choices', { choices: MOCK_OBJECTS.slice(0, 4) }); // Send 4 choices
    } else { // random mode
        room.secretWord = MOCK_OBJECTS[Math.floor(Math.random() * MOCK_OBJECTS.length)];
        io.to(roomCode).emit('round_start', { firstLetter: room.secretWord.charAt(0) });
        startRoundTimer(roomCode);
    }
  });

  socket.on('submit_word_choice', ({ roomCode, word }) => {
    const room = rooms[roomCode];
    const turnPlayer = room.players[room.turnIndex];
    if (!room || socket.id !== turnPlayer.id) return;

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
      if(winner) room.scores[winner.id] += 10;
      io.to(roomCode).emit('correct_guess', { winner, secretWord: room.secretWord, scores: room.scores });
      room.turnIndex++;
      room.roundNumber++;
      setTimeout(() => startNewRound(roomCode), 3000);
    }
  });

  socket.on('play_again', ({ roomCode }) => {
      const room = rooms[roomCode];
      if (!room || room.host !== socket.id) return;
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
  console.log(`Server listening on *:${PORT}`);
});
