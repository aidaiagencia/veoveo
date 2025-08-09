import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export type MainStackParamList = {
  Home: undefined;
  Profile: { userId: string; playerId: string };
  JoinRoom: undefined;
  Lobby: { roomCode: string; players: { id: string; playerId: string; username: string }[] };
  Game: { roomCode: string; players: { id: string; playerId: string; username: string }[] };
};

type GameMode = 'random' | 'host_choice';
type Props = NativeStackScreenProps<MainStackParamList, 'Home'>;

const HomeScreen = ({ navigation }: Props) => {
  const { userInfo, logout } = useAuth();
  const { socket } = useSocket();
  const [gameMode, setGameMode] = useState<GameMode>('random');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  useEffect(() => {
    if (!socket) return;
    const handleRoomCreated = (data: { roomCode: string; players: any[] }) => {
      setIsCreatingRoom(false);
      navigation.navigate('Lobby', { roomCode: data.roomCode, players: data.players });
    };
    socket.on('room_created', handleRoomCreated);
    return () => { socket.off('room_created', handleRoomCreated); };
  }, [socket, navigation]);

  if (!userInfo) {
    return <View style={styles.container}><Text>Loading user data...</Text></View>;
  }

  const handleCreateRoom = () => {
    if (isCreatingRoom) return;
    setIsCreatingRoom(true);
    socket?.emit('create_room', {
      playerId: userInfo.playerId,
      username: userInfo.username,
      gameMode: gameMode,
    });
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.profileIcon} onPress={() => navigation.navigate('Profile', { userId: userInfo.userId, playerId: userInfo.playerId })} disabled={isCreatingRoom}>
        <Text style={styles.profileIconText}>👤</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Veo Veo</Text>
      <Text style={styles.welcome}>Welcome, {userInfo.username}!</Text>

      <View style={styles.createRoomContainer}>
        <Text style={styles.gameModeLabel}>Game Mode:</Text>
        <View style={styles.gameModeSelector}>
            <TouchableOpacity onPress={() => setGameMode('random')} style={[styles.modeButton, gameMode === 'random' && styles.selectedMode]} disabled={isCreatingRoom}>
                <Text style={styles.modeText}>Random Word</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setGameMode('host_choice')} style={[styles.modeButton, gameMode === 'host_choice' && styles.selectedMode]} disabled={isCreatingRoom}>
                <Text style={styles.modeText}>Host Chooses</Text>
            </TouchableOpacity>
        </View>
        {isCreatingRoom ? (
          <ActivityIndicator size="large" color="#4A90E2" />
        ) : (
          <Button title="Crear Sala" onPress={handleCreateRoom} />
        )}
      </View>

      <View style={styles.joinRoomContainer}>
        <Button title="Unirse a una Sala" onPress={() => navigation.navigate('JoinRoom')} disabled={isCreatingRoom} />
      </View>

      <View style={styles.logoutButton}>
        <Button title="Logout" onPress={logout} color="red" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  profileIcon: { position: 'absolute', top: 60, right: 20, zIndex: 1 },
  profileIconText: { fontSize: 30 },
  title: { fontSize: 48, fontWeight: 'bold', marginBottom: 10 },
  welcome: { fontSize: 18, marginBottom: 40 },
  createRoomContainer: { width: '80%', padding: 20, borderWidth: 1, borderColor: '#ccc', borderRadius: 10, alignItems: 'center', marginBottom: 20, minHeight: 150, justifyContent: 'center' },
  gameModeLabel: { fontSize: 16, marginBottom: 10 },
  gameModeSelector: { flexDirection: 'row', marginBottom: 20 },
  modeButton: { padding: 10, borderWidth: 1, borderColor: '#ccc', borderRadius: 5, marginHorizontal: 5 },
  selectedMode: { backgroundColor: '#4A90E2', borderColor: '#4A90E2' },
  modeText: { color: 'black' },
  joinRoomContainer: { width: '80%', marginTop: 10 },
  logoutButton: { position: 'absolute', bottom: 40 }
});

export default HomeScreen;
