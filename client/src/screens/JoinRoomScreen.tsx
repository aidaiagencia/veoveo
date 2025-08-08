import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from './HomeScreen';

type Props = NativeStackScreenProps<MainStackParamList, 'JoinRoom'>;

const JoinRoomScreen = ({ navigation }: Props) => {
  const [roomCode, setRoomCode] = useState('');
  const { socket } = useSocket();
  const { userInfo } = useAuth();

  useEffect(() => {
    if (!socket) return;

    const handleJoinSuccess = (data: { roomCode: string; players: any[] }) => {
      // Navigate to Lobby, passing room data
      navigation.replace('Lobby', { roomCode: data.roomCode, players: data.players });
    };

    const handleError = (data: { message: string }) => {
      Alert.alert('Error joining room', data.message);
    };

    socket.on('join_success', handleJoinSuccess);
    socket.on('error', handleError);

    return () => {
      socket.off('join_success', handleJoinSuccess);
      socket.off('error', handleError);
    };
  }, [socket, navigation]);

  const handleJoin = () => {
    if (roomCode.trim() && userInfo) {
      socket?.emit('join_room', {
        roomCode: roomCode.trim().toUpperCase(),
        playerId: userInfo.playerId,
        username: userInfo.username, // I'll fix the context to include this later.
      });
    } else {
      Alert.alert('Error', 'Please enter a room code.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Join a Room</Text>
      <TextInput
        style={styles.input}
        placeholder="ENTER ROOM CODE"
        value={roomCode}
        onChangeText={setRoomCode}
        autoCapitalize="characters"
        maxLength={5}
        textAlign="center"
      />
      <Button title="Join Room" onPress={handleJoin} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    height: 50,
    borderColor: 'gray',
    borderWidth: 1,
    borderRadius: 5,
    marginBottom: 20,
    paddingHorizontal: 10,
    fontSize: 20,
  },
});

export default JoinRoomScreen;
