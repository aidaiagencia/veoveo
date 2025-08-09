import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, Linking } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

const API_URL = 'https://veoveo-server.onrender.com';

const RegisterScreen = ({ navigation }: Props) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please enter both username and password.');
      return;
    }
    try {
      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Registration successful! You can now log in.');
        navigation.navigate('Login');
      } else {
        Alert.alert('Registration Failed', data.message || 'An error occurred.');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not connect to the server.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <TextInput style={styles.input} placeholder="Username" value={username} onChangeText={setUsername} autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <Button title="Register" onPress={handleRegister} />
      <View style={{ marginTop: 20 }} />
      <Button title="Already have an account? Login" onPress={() => navigation.navigate('Login')} />
      <Text style={styles.privacyText}>
        By registering, you agree to our
        <Text style={styles.link} onPress={() => Linking.openURL('https://your-website.com/privacy-policy')}>
          {' '}Privacy Policy
        </Text>.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 16 },
  title: { fontSize: 24, marginBottom: 24, textAlign: 'center' },
  input: { height: 40, borderColor: 'gray', borderWidth: 1, marginBottom: 12, paddingHorizontal: 8, borderRadius: 5 },
  privacyText: {
    marginTop: 30,
    textAlign: 'center',
    color: 'gray',
  },
  link: {
    color: 'blue',
    textDecorationLine: 'underline',
  },
});

export default RegisterScreen;
