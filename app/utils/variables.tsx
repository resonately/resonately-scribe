// variables.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

interface Variables {
  variable1: string;
  variable2: number;
  nested: {
    variable3: boolean;
    variable4: string;
  };
}

const defaultVariables: Variables = {
  variable1: 'defaultString',
  variable2: 0,
  nested: {
    variable3: true,
    variable4: 'nestedString',
  },
};

const VARIABLES_KEY = 'app_variables';

export const getVariables = async (): Promise<Variables> => {
  try {
    const jsonValue = await AsyncStorage.getItem(VARIABLES_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : defaultVariables;
  } catch (e) {
    console.error(e);
    return defaultVariables;
  }
};

export const setVariables = async (variables: Variables): Promise<void> => {
  try {
    const jsonValue = JSON.stringify(variables);
    await AsyncStorage.setItem(VARIABLES_KEY, jsonValue);
  } catch (e) {
    console.error(e);
  }
};

export const updateVariablesFromAPI = async (): Promise<void> => {
  try {
    const response = await axios.get('https://api.example.com/variables');
    if (response.status === 200) {
      const newVariables: Variables = response.data;
      await setVariables(newVariables);
    }
  } catch (e) {
    console.error('API call failed, using stored values.', e);
  }
};
