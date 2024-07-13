import React, { useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Button, Text, Title, useTheme, IconButton } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { WebView } from 'react-native-webview';
import { RootStackParamList } from './_layout';


interface WelcomeScreenProps {
    updateHasAcceptedTermsInLayout: () => Promise<void>;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ updateHasAcceptedTermsInLayout }) => {
  const theme = useTheme();
  type InviteScreenNavigationProp = StackNavigationProp<RootStackParamList, 'LoginScreen'>;
  const navigation = useNavigation<InviteScreenNavigationProp>();
  const [modalVisible, setModalVisible] = useState(false);
  const [modalUrl, setModalUrl] = useState('');

  const handleAccept = async () => {
    await AsyncStorage.setItem('hasAcceptedTerms', 'true');
    await updateHasAcceptedTermsInLayout();
    navigation.navigate('PermissionScreen');
  };

  const openModal = (url: string) => {
    setModalUrl(url);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setModalUrl('');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Title style={[styles.title, { color: theme.colors.primary }]}>Welcome to Resonately</Title>
      <Text style={[styles.subtitle, { color: theme.colors.onBackground }]}>
        The audiologist's companion
      </Text>
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <IconButton
              icon="close"
              size={30}
              onPress={closeModal}
              style={[styles.closeButton, { color: theme.colors.onBackground }]}
            />
          </View>
          <WebView source={{ uri: modalUrl }} style={styles.webView} />
        </View>
      </Modal>
      <View style={styles.bottomContainer}>
        <Text style={[styles.description, { color: theme.colors.onBackground }]}>
          By clicking the following button, you accept the{' '}
          <Text style={styles.link} onPress={() => openModal('https://example.com/terms')}>
            terms and conditions
          </Text>{' '}
          and{' '}
          <Text style={styles.link} onPress={() => openModal('https://example.com/privacy')}>
            privacy policy
          </Text>
          .
        </Text>
        <Button
          mode="contained"
          onPress={handleAccept}
          style={styles.button}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
        >
          Accept and Continue
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 20,
  },
  description: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 20,
  },
  link: {
    color: 'blue',
    textDecorationLine: 'underline',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 20,
    width: '100%',
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  button: {
    width: '100%',
    borderRadius: 25,
  },
  buttonContent: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  buttonLabel: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 40, // Add some padding to the top
    paddingHorizontal: 10,
  },
  closeButton: {
    alignSelf: 'flex-end',
  },
  webView: {
    flex: 1,
  },
});

export default WelcomeScreen;
