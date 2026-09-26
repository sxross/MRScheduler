import AsyncStorage from '@react-native-async-storage/async-storage';
import { JsonConfigurationRepository, type TextStorage } from '@mrscheduler/application';

const storage: TextStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
};

export const localConfigurationRepository = new JsonConfigurationRepository(storage);
