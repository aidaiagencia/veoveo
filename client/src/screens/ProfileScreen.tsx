import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from './HomeScreen'; // Import the type from HomeScreen

type Props = NativeStackScreenProps<MainStackParamList, 'Profile'>;

const ProfileScreen = ({ route }: Props) => {
  const { userId, playerId } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.avatar}>👤</Text>
      <Text style={styles.title}>User Profile</Text>
      <View style={styles.infoContainer}>
        <Text style={styles.infoLabel}>Player ID:</Text>
        <Text style={styles.infoValue}>{playerId}</Text>
      </View>
      <View style={styles.infoContainer}>
        <Text style={styles.infoLabel}>Internal User ID:</Text>
        <Text style={styles.infoValue}>{userId}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  avatar: {
    fontSize: 100,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  infoContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: 10,
  },
  infoValue: {
    fontSize: 18,
  },
});

export default ProfileScreen;
