import AsyncStorage from '@react-native-async-storage/async-storage';

const RECORDINGS_KEY = 'recordings';

const displayRecordings = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(RECORDINGS_KEY);
    const recordings = jsonValue != null ? JSON.parse(jsonValue) : [];
    console.log('Current Recordings:', JSON.stringify(recordings, null, 2));
  } catch (e) {
    console.error('Failed to display recordings.', e);
  }
};

export const saveRecordings = async (recordings: any) => {
  try {
    await displayRecordings();
    const jsonValue = JSON.stringify(recordings);
    await AsyncStorage.setItem(RECORDINGS_KEY, jsonValue);
    console.log('Recordings saved successfully.');
  } catch (e) {
    console.error('Failed to save recordings.', e);
  }
};

export const loadRecordings = async () => {
  try {
    await displayRecordings();
    const jsonValue = await AsyncStorage.getItem(RECORDINGS_KEY);
    console.log('Recordings loaded successfully.');
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (e) {
    console.error('Failed to load recordings.', e);
    return [];
  }
};

export const clearRecordings = async () => {
  try {
    await displayRecordings();
    await AsyncStorage.removeItem(RECORDINGS_KEY);
    console.log('Recordings cleared successfully.');
  } catch (e) {
    console.error('Failed to clear recordings.', e);
  }
};
