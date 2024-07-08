import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Button, IconButton, useTheme } from 'react-native-paper';

const MeetingControlsScreen = () => {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: 'https://via.placeholder.com/150' }} // Replace with the actual URL of the speaker's image
        style={styles.speakerImage}
      />
      <View style={styles.controls}>
        <IconButton
          icon="microphone-off"
          size={30}
          onPress={() => console.log('Mute button pressed')}
          style={styles.iconButton}
        />
        <IconButton
          icon="pause"
          size={30}
          onPress={() => console.log('Pause button pressed')}
          style={styles.iconButton}
        />
        <Button
          mode="contained"
          onPress={() => console.log('End Meeting button pressed')}
          style={styles.endMeetingButton}
          labelStyle={styles.endMeetingButtonLabel}
        >
          End Meeting
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  speakerImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 20,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginHorizontal: 10,
  },
  endMeetingButton: {
    backgroundColor: '#d32f2f',
    marginLeft: 10,
  },
  endMeetingButtonLabel: {
    color: '#ffffff',
  },
});

export default MeetingControlsScreen;