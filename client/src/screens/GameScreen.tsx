import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, Button, FlatList } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from './HomeScreen';
import { launchCamera, CameraOptions } from 'react-native-image-picker';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

type GameState = 'waiting_for_turn' | 'is_turn_to_photo' | 'choosing_word' | 'guessing' | 'round_over' | 'game_over';
type Player = { id: string; playerId: string; username: string };
type Scores = { [key: string]: number };
type Props = NativeStackScreenProps<MainStackParamList, 'Game'>;

const GameScreen = ({ route, navigation }: Props) => {
  const { roomCode, players } = route.params;
  const { socket } = useSocket();
  const { userInfo } = useAuth();

  const [gameState, setGameState] = useState<GameState>('waiting_for_turn');
  const [roundNumber, setRoundNumber] = useState(1);
  const [turnPlayerUsername, setTurnPlayerUsername] = useState('');
  const [wordChoices, setWordChoices] = useState<string[]>([]);
  const [firstLetter, setFirstLetter] = useState('');
  const [guess, setGuess] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [roundResult, setRoundResult] = useState('');
  const [scores, setScores] = useState<Scores>({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    navigation.addListener('beforeRemove', (e) => {
      if (gameState !== 'game_over') {
        e.preventDefault();
        Alert.alert('Leave Game?', 'Are you sure you want to leave?',
          [{ text: "Don't leave", style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) }]
        );
      }
    });
  }, [navigation, gameState]);

  useEffect(() => {
    if (!socket || !userInfo) return;

    const handleNewRound = ({ roundNumber, turnPlayerId, turnPlayerUsername }: { roundNumber: number, turnPlayerId: string, turnPlayerUsername: string }) => {
      setRoundNumber(roundNumber);
      setGameState(turnPlayerId === socket.id ? 'is_turn_to_photo' : 'waiting_for_turn');
      setTurnPlayerUsername(turnPlayerUsername);
      setRoundResult('');
    };

    const handleWordChoices = ({ choices }: { choices: string[] }) => {
        setWordChoices(choices);
        setGameState('choosing_word');
    };

    const handleRoundStart = ({ firstLetter }: { firstLetter: string }) => {
      setFirstLetter(firstLetter);
      setGameState('guessing');
      setTimeLeft(60);
      timerRef.current = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    };

    const handleCorrectGuess = ({ winner, secretWord, scores }: { winner: Player, secretWord: string, scores: Scores }) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setGameState('round_over');
      setScores(scores);
      setRoundResult(`${winner.username} guessed it: ${secretWord}`);
    };

    const handleTimeout = ({ secretWord }: { secretWord: string }) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setGameState('round_over');
      setRoundResult(`Time's up! The word was: ${secretWord}`);
    };

    const handleGameOver = ({ scores }: { scores: Scores }) => {
      setGameState('game_over');
      setScores(scores);
    };

    const handleGameRestarted = () => { setGameState('waiting_for_turn'); setRoundNumber(1); setScores({}); setRoundResult(''); };

    socket.on('new_round', handleNewRound);
    socket.on('word_choices', handleWordChoices);
    socket.on('round_start', handleRoundStart);
    socket.on('correct_guess', handleCorrectGuess);
    socket.on('round_over_timeout', handleTimeout);
    socket.on('game_over', handleGameOver);
    socket.on('game_started', handleGameRestarted);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      socket.off('new_round'); socket.off('word_choices'); socket.off('round_start'); socket.off('correct_guess'); socket.off('round_over_timeout'); socket.off('game_over'); socket.off('game_started');
    };
  }, [socket, userInfo, navigation]);

  const handleTakePhoto = async () => {
    try {
      const result = await launchCamera({ mediaType: 'photo', quality: 0.5 });
      if (result.assets) {
        socket?.emit('submit_photo', { roomCode });
        setGameState('waiting_for_turn');
      }
    } catch (error) { Alert.alert('Error', 'Failed to launch camera.'); }
  };

  const handleWordChoice = (word: string) => {
    socket?.emit('submit_word_choice', { roomCode, word });
    setGameState('waiting_for_turn');
  };

  const handleGuess = () => { if (guess.trim()) { socket?.emit('submit_guess', { roomCode, guess: guess.trim() }); setGuess(''); } };
  const handlePlayAgain = () => { socket?.emit('play_again', { roomCode }); };

  const renderContent = () => {
    switch (gameState) {
      case 'is_turn_to_photo': return <View style={styles.contentView}><Text style={styles.instructionText}>It's your turn!</Text><TouchableOpacity style={styles.cameraButton} onPress={handleTakePhoto}><Text style={styles.cameraButtonText}>📷 Take Photo</Text></TouchableOpacity></View>;
      case 'choosing_word': return <View style={styles.contentView}><Text style={styles.instructionText}>Choose a word for others to guess:</Text>{wordChoices.map(w => <Button key={w} title={w} onPress={() => handleWordChoice(w)} />)}</View>;
      case 'guessing': return <View style={styles.contentView}><Text style={styles.instructionText}>The word starts with:</Text><Text style={styles.firstLetter}>{firstLetter}</Text><TextInput style={styles.input} placeholder="Enter your guess" value={guess} onChangeText={setGuess} autoCapitalize="characters" /><Button title="Guess" onPress={handleGuess} /></View>;
      case 'round_over': return <View style={styles.contentView}><Text style={styles.resultText}>{roundResult}</Text><Text>Waiting for next round...</Text></View>;
      case 'game_over':
        const isRoomHost = userInfo?.playerId === players[0]?.playerId;
        const finalScores = players.map(p => ({ ...p, score: scores[p.id] || 0 }));
        return <View style={styles.contentView}><Text style={styles.resultText}>Game Over!</Text><FlatList data={finalScores} renderItem={({ item }) => <Text style={styles.scoreItem}>{item.username}: {item.score}</Text>} keyExtractor={item => item.id} />{isRoomHost && <Button title="Play Again" onPress={handlePlayAgain} />}</View>;
      default: return <View style={styles.contentView}><Text style={styles.instructionText}>Waiting for {turnPlayerUsername} to play...</Text></View>;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Round {roundNumber}</Text>
      {renderContent()}
      <View style={styles.timerContainer}><Text style={styles.timerText}>{timeLeft}s</Text></View>
    </View>
  );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FA', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 80, paddingBottom: 40 },
    header: { fontSize: 28, fontWeight: 'bold', color: '#333333' },
    contentView: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' },
    instructionText: { fontSize: 22, color: '#333333', textAlign: 'center', marginBottom: 10 },
    firstLetter: { fontSize: 80, fontWeight: 'bold', marginBottom: 20, color: '#4A90E2' },
    input: { height: 50, width: '90%', borderColor: 'gray', borderWidth: 1, borderRadius: 5, marginBottom: 20, paddingHorizontal: 10, fontSize: 18, textAlign: 'center' },
    cameraButton: { backgroundColor: '#4A90E2', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30 },
    cameraButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
    timerContainer: { paddingVertical: 5, paddingHorizontal: 15, borderRadius: 10, backgroundColor: '#e9ecef' },
    timerText: { fontSize: 20, fontWeight: 'bold', color: '#333333' },
    resultText: { fontSize: 22, textAlign: 'center', marginBottom: 20, fontWeight: 'bold' },
    scoreItem: { fontSize: 18, paddingVertical: 5 },
});

export default GameScreen;
