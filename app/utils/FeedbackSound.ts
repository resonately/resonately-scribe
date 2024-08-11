import { Audio, AVPlaybackSource } from 'expo-av';

export const playWavFile = async (fileUri: AVPlaybackSource): Promise<void> => {
  try {

    let source;
    if (typeof fileUri === 'string') {
      // Assume it's a remote URL
      source = { uri: fileUri };
    } else {
      // Assume it's a local file (require)
      source = fileUri;
    }

    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
    });

    const { sound } = await Audio.Sound.createAsync(
      fileUri,
      { shouldPlay: true }
    );
    
    // Optionally, you can wait for the sound to finish playing
    sound.setOnPlaybackStatusUpdate((status) => {
      // console.log(">>>> status: ", status);
    });
  } catch (error) {
    console.error('Error playing WAV file:', error);
  }
};