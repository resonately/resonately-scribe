import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Dimensions } from 'react-native';
import { Button } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from './_layout'; // Adjust the path according to your project structure

const { height } = Dimensions.get('window');

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'InviteScreen'>;
const LandingScreen = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const handlePress = () => {
    
    navigation.navigate('InviteScreen');
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.welcomeText}>Welcome to Resonately</Text>
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          By clicking below, you accept our
          <Text style={styles.link} onPress={() => openLink('https://example.com/terms')}> terms and conditions </Text>
          and
          <Text style={styles.link} onPress={() => openLink('https://example.com/privacy')}> Privacy Policy</Text>.
        </Text>
        <Button
          mode="contained"
          onPress={handlePress}
          style={styles.button}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
          uppercase={false}
          theme={{ colors: { primary: '#3949ab' } }}
        >
          Accept and Continue
        </Button>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#e8eaf6',
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#1a237e',
    textAlign: 'center',
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#e8eaf6',
    borderTopWidth: 1,
    borderTopColor: '#dcdcdc',
  },
  footerText: {
    fontSize: 14,
    color: '#1a237e',
    textAlign: 'center',
    marginBottom: 10,
  },
  link: {
    color: '#3949ab',
    textDecorationLine: 'underline',
  },
  button: {
    width: '100%',
    borderRadius: 30,
    backgroundColor: '#3949ab',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  buttonContent: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  buttonLabel: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  }
});

export default LandingScreen;
