import AsyncStorage from '@react-native-async-storage/async-storage';

const RECORDINGS_KEY = 'recordings';

export const displayRecordings = async () => {
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
    const jsonValue = JSON.stringify(recordings);
    await AsyncStorage.setItem(RECORDINGS_KEY, jsonValue);
    // console.log('Recordings saved successfully.');
    // await displayRecordings();
  } catch (e) {
    console.error('Failed to save recordings.', e);
  }
};

export const loadRecordings = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(RECORDINGS_KEY);
    // console.log('Recordings loaded successfully.');
    // await displayRecordings();
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (e) {
    console.error('Failed to load recordings.', e);
    return [];
  }
};

export const clearRecordings = async () => {
  try {
    await AsyncStorage.removeItem(RECORDINGS_KEY);
    // await displayRecordings();
    console.log('Recordings cleared successfully.');
  } catch (e) {
    console.error('Failed to clear recordings.', e);
  }
};
