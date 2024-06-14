import React, { useState } from 'react';
import { BottomNavigation } from 'react-native-paper';
import AudioChunkUpload from './Record'; // Ensure this points to your Record screen
import ProfileScreen from './ProfileScreen'; // Ensure this points to your Profile screen
import { MaterialCommunityIcons } from '@expo/vector-icons';

const MyTabs = () => {
  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'record', title: 'Record', icon: 'microphone' },
    { key: 'profile', title: 'Profile', icon: 'account' },
  ]);

  const renderScene = BottomNavigation.SceneMap({
    record: AudioChunkUpload,
    profile: ProfileScreen,
  });

  const renderIcon = ({ route, focused, color }) => {
    let iconName;

    switch (route.key) {
      case 'record':
        iconName = 'microphone';
        break;
      case 'profile':
        iconName = 'account';
        break;
      default:
        iconName = 'circle';
    }

    return <MaterialCommunityIcons name={iconName} size={24} color={color} />;
  };

  return (
    <BottomNavigation
      navigationState={{ index, routes }}
      onIndexChange={setIndex}
      renderScene={renderScene}
      renderIcon={renderIcon}
    />
  );
};

export default MyTabs;
