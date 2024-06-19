import React from 'react';
import { TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

interface RecordingButtonProps {
  isRecording: boolean;
  onPress: () => void;
  disabled: boolean;
  loading: boolean;
}

const RecordingButton = ({ isRecording, onPress, disabled, loading }: RecordingButtonProps): JSX.Element => {
  return (
    <TouchableOpacity style={[styles.button, disabled && styles.disabledButton]} onPress={onPress} disabled={disabled}>
      {loading ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <FontAwesome name={isRecording ? "stop" : "microphone"} size={24} color="white" />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: 'red',
    padding: 16,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: 'gray',
  }
});

export default RecordingButton;
