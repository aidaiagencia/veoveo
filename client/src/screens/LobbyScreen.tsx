import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, FlatList, Alert } from 'react-native';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from './HomeScreen';

type Player = { id: string; playerId: string; username: string };
type Props = NativeStackScreenProps<MainStackParamList, 'Lobby'>;

const LobbyScreen = ({ route, navigation }: Props) => {
  const { roomCode: initialRoomCode, players: initialPlayers } = route.params;

  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const { socket } = useSocket();
  const { userInfo } = useAuth();

  const isHost = userInfo && players.length > 0 && players[0].playerId === userInfo.playerId;

  useEffect(() => {
    if (!socket) return;

    const handlePlayerUpdate = (data: { players: Player[] }) => {
      setPlayers(data.players);
    };

    const handleRoomClosed = (data: { message: string }) => {
      Alert.alert('Room Closed', data.message, [
        { text: 'OK', onPress: () => navigation.navigate('Home') },
      ]);
    };

    const handleGameStarted = () => {
        navigation.navigate('Game', { roomCode: initialRoomCode, players: players });
    };

    socket.on('player_joined', handlePlayerUpdate);
    socket.on('player_left', handlePlayerUpdate);
    socket.on('room_closed', handleRoomClosed);
    socket.on('game_started', handleGameStarted);

    return () => {
      socket.off('player_joined', handlePlayerUpdate);
      socket.off('player_left', handlePlayerUpdate);
      socket.off('room_closed', handleRoomClosed);
      socket.off('game_started', handleGameStarted);
    };
  }, [socket, navigation]);

  const handleStartGame = () => {
    socket?.emit('start_game', { roomCode: initialRoomCode });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lobby</Text>
      <View style={styles.roomCodeContainer}>
        <Text style={styles.roomCodeText}>Room Code:</Text>
        <Text style={styles.roomCode}>{initialRoomCode}</Text>
      </View>
      <Text style={styles.playersTitle}>Players ({players.length}/5)</Text>
      <FlatList
        style={styles.playerList}
        data={players}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <View style={styles.playerItem}>
            <Text style={styles.playerName}>{item.username}</Text>
            {index === 0 && <Text style={styles.hostLabel}>(Host)</Text>}
          </View>
        )}
      />
      {isHost && (
        <Button
          title="Start Game"
          onPress={handleStartGame}
          disabled={players.length < 1} // Host can start alone for testing
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, alignItems: 'center' },
    title: { fontSize: 32, fontWeight: 'bold', marginBottom: 20 },
    roomCodeContainer: { marginBottom: 20, alignItems: 'center' },
    roomCodeText: { fontSize: 18, color: 'gray' },
    roomCode: { fontSize: 40, fontWeight: 'bold', letterSpacing: 5 },
    playersTitle: { fontSize: 22, fontWeight: '600', marginBottom: 10 },
    playerList: { width: '100%' },
    playerItem: { flexDirection: 'row', justifyContent: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
    playerName: { fontSize: 18 },
    hostLabel: { fontSize: 18, color: 'green', marginLeft: 10 },
});

export default LobbyScreen;
